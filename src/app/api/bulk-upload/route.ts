import { createHash } from "crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { addDays, addHours, addYears } from "date-fns";
import { apiError } from "@/lib/api-response";
import { requireAnyPermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { csvResponse, parseCsv } from "@/lib/csv";
import { privateFileUrl, privateUploadRoot } from "@/lib/private-files";
import { prisma } from "@/lib/prisma";

type Row = Record<string, string>;
type ImportResult = {
  action: string;
  recordType: string;
  recordId?: string;
  recordKey?: string;
  displayName?: string;
};

type ImportEntry = ImportResult & { row: number; status: "SUCCESS" | "FAILED"; module: string; message?: string };
type ImportFailure = { row: number; message: string };
type BulkUploadUser = { id?: string; name?: string; email?: string; role?: string } | null;
type UploadedDocumentFile = { file: File; name: string; size: number };
type ImportContext = { documentFiles?: Map<string, UploadedDocumentFile> };
type ManualLibraryRecord = { checksum: string; fileName: string; fileSize: number; fileUrl: string; mimeType: string; originalName: string };

const BACKGROUND_ROW_THRESHOLD = 5000;
const BULK_UPLOAD_CHUNK_SIZE = 500;
const MAX_DOCUMENT_FILE_SIZE = 60 * 1024 * 1024;
const documentCategories: Record<string, string> = {
  OM_MANUAL: "operation-maintenance-management",
  WARRANTY_GUARANTEE: "equipment-warranties-and-guarantees",
  SUPPORT_CONTRACT_SLA: "support-contracts-and-slas",
};
const allowedDocumentExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".txt", ".csv", ".xlsx", ".docx", ".pptx"]);
const allowedManualRoots = [
  path.resolve("C:\\Users\\HP\\Documents\\FADHILI DATA FINAL\\EAM\\SYSTEM O&M MANUALS"),
  path.resolve("C:\\Users\\HP\\Documents\\FADHILI_CAFM_UPLOAD_PACK"),
];
const documentSourceCache = new Map<string, { checksum: string; ext: string; size: number }>();
const copiedDocumentCache = new Set<string>();
let manualLibraryManifestCache: Record<string, ManualLibraryRecord> | null = null;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const { error } = await requireAnyPermission(["assets.manage", "work.manage", "requests.manage", "users.manage", "documents.upload"]);
    if (error) return error;

    const job = jobId
      ? await prisma.bulkUploadJob.findUnique({ where: { id: jobId } })
      : await prisma.bulkUploadJob.findFirst({
        where: { status: { in: ["QUEUED", "PROCESSING"] } },
        orderBy: { createdAt: "desc" },
      });

    return NextResponse.json({ job: job ? serializeBulkUploadJob(job) : null });
  } catch (error) {
    return apiError(error, "Bulk upload progress could not be loaded");
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const module = String(formData.get("module") || "");
    const { error, user } = await requireAnyPermission(bulkUploadPermissions(module));
    if (error) return error;
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError(new Error("CSV file is required."), "CSV file is required", 400);
    }

    const rows = parseCsv(await file.text());
    const context = buildImportContext(module, formData);

    if (rows.length > BACKGROUND_ROW_THRESHOLD) {
      const job = await prisma.bulkUploadJob.create({
        data: {
          module,
          fileName: file.name,
          fileSize: file.size,
          totalRows: rows.length,
          status: "QUEUED",
          message: "Bulk upload has been queued for background processing.",
          actorId: user?.id || null,
          actorName: user?.name || user?.email || "System",
          role: user?.role || "System",
        },
      });

      void processBulkUploadJob(job.id, module, rows, { name: file.name, size: file.size }, user, context);

      return NextResponse.json({
        jobId: job.id,
        status: "QUEUED",
        module,
        fileName: file.name,
        fileSize: file.size,
        totalRows: rows.length,
        processedRows: 0,
        createdRows: 0,
        failedRows: 0,
        completion: 0,
        startedAt: job.createdAt,
        message: "Bulk upload has been queued for background processing.",
      }, { status: 202 });
    }

    const { created, failed, entries, result } = await processRows(module, rows, context);

    await auditAction({
      user,
      action: "BULK_UPLOAD",
      entity: "bulk_upload",
      entityId: module || "unknown",
      details: {
        module,
        fileName: file.name,
        fileSize: file.size,
        totalRows: rows.length,
        created,
        failed,
        entries,
        result,
      },
    });
    return NextResponse.json(result, { status: failed.length ? 207 : 201 });
  } catch (error) {
    return apiError(error, "Bulk upload failed");
  }
}

async function processRows(
  module: string,
  rows: Row[],
  context: ImportContext = {},
  onProgress?: (progress: { processedRows: number; createdRows: number; failedRows: number; failed: ImportFailure[]; entries: ImportEntry[] }) => Promise<void>,
) {
  const failed: ImportFailure[] = [];
  const entries: ImportEntry[] = [];
  let created = 0;

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    try {
      const imported = await importRow(module, row, context);
      entries.push({ row: rowNumber, status: "SUCCESS", module, ...imported });
      created += 1;
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Import failed for this row.";
      failed.push({ row: rowNumber, message });
      entries.push({
        row: rowNumber,
        status: "FAILED",
        module,
        action: "SKIPPED",
        recordType: module || "unknown",
        recordKey: rowIdentifier(module, row),
        displayName: rowDisplayName(row),
        message,
      });
    }

    const processedRows = index + 1;
    if (onProgress && (processedRows % BULK_UPLOAD_CHUNK_SIZE === 0 || processedRows === rows.length)) {
      await onProgress({ processedRows, createdRows: created, failedRows: failed.length, failed, entries });
    }
  }

  return { created, failed, entries, result: csvResponse(created, failed) };
}

async function processBulkUploadJob(jobId: string, module: string, rows: Row[], file: { name: string; size: number }, user: BulkUploadUser, context: ImportContext = {}) {
  try {
    await prisma.bulkUploadJob.update({
      where: { id: jobId },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
        message: `Processing ${rows.length} rows in chunks of ${BULK_UPLOAD_CHUNK_SIZE}.`,
      },
    });

    const { created, failed, entries, result } = await processRows(module, rows, context, async ({ processedRows, createdRows, failedRows }) => {
      await prisma.bulkUploadJob.update({
        where: { id: jobId },
        data: {
          processedRows,
          createdRows,
          failedRows,
          message: `Processed ${processedRows} of ${rows.length} rows.`,
        },
      });
    });

    const completedStatus = failed.length ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
    await prisma.bulkUploadJob.update({
      where: { id: jobId },
      data: {
        status: completedStatus,
        processedRows: rows.length,
        createdRows: created,
        failedRows: failed.length,
        failed: JSON.stringify(failed),
        entries: JSON.stringify(entries),
        result: JSON.stringify(result),
        completedAt: new Date(),
        message: result.message,
      },
    });

    await auditAction({
      user,
      action: "BULK_UPLOAD",
      entity: "bulk_upload",
      entityId: module || "unknown",
      details: {
        module,
        fileName: file.name,
        fileSize: file.size,
        totalRows: rows.length,
        created,
        failed,
        entries,
        result,
        jobId,
        background: true,
        chunkSize: BULK_UPLOAD_CHUNK_SIZE,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background bulk upload failed.";
    await prisma.bulkUploadJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        message,
      },
    }).catch(() => undefined);
  }
}

function serializeBulkUploadJob(job: {
  id: string;
  module: string;
  fileName: string;
  fileSize: number;
  totalRows: number;
  processedRows: number;
  createdRows: number;
  failedRows: number;
  status: string;
  message: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const completion = job.totalRows > 0 ? Math.min(100, Math.round((job.processedRows / job.totalRows) * 100)) : 0;
  return {
    id: job.id,
    module: job.module,
    fileName: job.fileName,
    fileSize: job.fileSize,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    createdRows: job.createdRows,
    failedRows: job.failedRows,
    status: job.status,
    message: job.message,
    completion,
    startedAt: job.startedAt ?? job.createdAt,
    completedAt: job.completedAt,
    updatedAt: job.updatedAt,
  };
}

function bulkUploadPermissions(module: string) {
  if (module === "omManuals") return ["documents.upload"];
  if (module === "ppm") return ["ppm.manage", "assets.manage"];
  if (module === "workOrders") return ["work.manage", "assets.manage"];
  if (module === "requests") return ["requests.manage"];
  if (["teams", "services", "departments", "employees"].includes(module)) return ["users.manage", "requests.manage"];
  return ["assets.manage"];
}

function buildImportContext(module: string, formData: FormData): ImportContext {
  if (module !== "omManuals") return {};
  const documentFiles = new Map<string, UploadedDocumentFile>();
  formData.getAll("manualFiles").forEach((item) => {
    if (item instanceof File && item.size > 0) {
      documentFiles.set(item.name.trim().toLowerCase(), { file: item, name: item.name, size: item.size });
    }
  });
  return { documentFiles };
}

async function importRow(module: string, row: Row, context: ImportContext = {}) {
  if (module === "sites") return importSite(row);
  if (module === "buildings") return importBuilding(row);
  if (module === "spaces") return importSpace(row);
  if (module === "assets") return importAsset(row);
  if (module === "housingAssets") return importHousingAsset(row);
  if (module === "inventory") return importInventory(row);
  if (module === "requests") return importRequest(row);
  if (module === "workOrders") return importWorkOrder(row);
  if (module === "teams") return importTeam(row);
  if (module === "services") return importService(row);
  if (module === "departments") return importDepartment(row);
  if (module === "employees") return importEmployee(row);
  if (module === "categories") return importCategory(row);
  if (module === "inspections") return importInspection(row);
  if (module === "locations") return importLocation(row);
  if (module === "jobPlans") return importJobPlan(row);
  if (module === "ppm") return importPpm(row);
  if (module === "omManuals") return importDocumentIndex(row, context);
  throw new Error(`Unsupported module: ${module}`);
}

async function firstSite() {
  const site = await prisma.site.findFirst({ include: { buildings: { take: 1 } } });
  if (site) return site;

  return prisma.site.create({
    data: {
      name: "Fadhili Bachelor Camp",
      city: "Fadhili",
      country: "Saudi Arabia",
      type: "Accommodation Camp",
      areaSqm: 0,
      buildings: {
        create: {
          name: "Fadhili Bachelor Camp",
          code: "FBC",
          floors: 1,
          areaSqm: 0,
        },
      },
    },
    include: { buildings: { take: 1 } },
  });
}

async function ensureSite(row: Row = {}) {
  const name = value(row, "site", "siteName", "name", "Site") || "Fadhili Bachelor Camp";
  const city = value(row, "city", "City") || "Fadhili";
  const country = value(row, "country", "Country") || "Saudi Arabia";
  const type = value(row, "type", "siteType", "Type") || "Accommodation Camp";
  const areaSqm = integer(value(row, "areaSqm", "area", "AreaSqm"), 0);
  return prisma.site.upsert({
    where: { name_city_country: { name, city, country } },
    update: { type, areaSqm },
    create: { name, city, country, type, areaSqm },
  });
}

async function ensureBuilding(row: Row = {}, siteInput?: { id: string }) {
  const site = siteInput || await ensureSite(row);
  const code = value(row, "buildingCode", "code", "building", "Building", "BLDG") || "FBC";
  const name = value(row, "buildingName", "name", "description", "Description") || code;
  const floors = integer(value(row, "floors", "floorCount"), 1);
  const areaSqm = integer(value(row, "areaSqm", "area", "AreaSqm"), 0);
  return prisma.building.upsert({
    where: { code },
    update: { name, siteId: site.id, floors, areaSqm },
    create: { code, name, siteId: site.id, floors, areaSqm },
  });
}

async function siteAndBuildingForAsset(location: { site?: string | null; building?: string | null; description?: string | null } | null, row: Row) {
  const site = await ensureSite({
    site: value(row, "siteCode", "SITE") || location?.site || "Fadhili Bachelor Camp",
    city: value(row, "siteCity") || "Fadhili",
    country: value(row, "siteCountry") || "Saudi Arabia",
    type: value(row, "siteType") || "Accommodation Camp",
  });
  const buildingCode = value(row, "buildingCode", "BLDG") || location?.building || "FBC";
  const building = await ensureBuilding({
    code: buildingCode,
    name: location?.description || buildingCode,
    floors: value(row, "buildingFloors") || "1",
    areaSqm: value(row, "buildingAreaSqm") || "0",
  }, site);
  return { site, building };
}

async function importSite(row: Row) {
  const site = await ensureSite(row);
  return importResult("site", "UPSERT", site, site.name, site.name);
}

async function importBuilding(row: Row) {
  const site = await ensureSite(row);
  const building = await ensureBuilding(row, site);
  return importResult("building", "UPSERT", building, building.code, building.name);
}

async function importSpace(row: Row) {
  const site = await ensureSite(row);
  const building = await ensureBuilding(row, site);
  const name = value(row, "name", "space", "room", "code") || "Space";
  const floor = value(row, "floor", "FLOOR") || "Ground";
  const type = value(row, "type", "spaceType", "locationClass") || "Space";
  const capacity = integer(value(row, "capacity"), 0);
  const areaSqm = integer(value(row, "areaSqm", "area"), 0);
  const occupancy = integer(value(row, "occupancy"), 0);
  const space = await prisma.space.upsert({
    where: { buildingId_floor_name: { buildingId: building.id, floor, name } },
    update: { type, capacity, areaSqm, occupancy },
    create: { buildingId: building.id, name, floor, type, capacity, areaSqm, occupancy },
  });
  return importResult("space", "UPSERT", space, `${building.code}/${floor}/${name}`, name);
}

async function importAsset(row: Row) {
  const tag = value(row, "EQUIPMENTNO", "tag", "ASSET NUMBER", "assetNumber", "Asset Code");
  if (!tag) throw new Error("EQUIPMENTNO is required");
  const locationCode = value(row, "LOCATION", "Location", "Location Name", "location", "ROOM", "room");
  const location = locationCode ? await prisma.location.findUnique({ where: { code: locationCode } }) : null;
  const hierarchy = location || value(row, "siteCode", "SITE", "buildingCode", "BLDG") ? await siteAndBuildingForAsset(location, row) : { site: await firstSite(), building: null };
  const name = value(row, "EQUIPMENTDESC", "name", "Asset Name", "Asset Description", "Asset Description ", "assetDescription") || tag;
  const description = value(row, "ADDITIONAL_NOTE", "Description", "Additional description", "additionalDescription");
  const category = value(row, "CATEGORY", "category", "Asset Type", "Asset Group", "Asset Group ", "assetGroup") || "General";
  const system = value(row, "PRIMARYSYSTEM", "system", "Entity Name", "Asset Type") || category;
  const floor = value(row, "floor", "FLOOR") || location?.floor || "Unassigned";
  const room = locationCode || value(row, "room", "ROOM", "ROOM ") || location?.code || "Unassigned";
  const departmentCode = value(row, "DEPARTMENT", "departmentCode", "Department", "Assigned To") || "";
  const cost = number(value(row, "EQUIPMENTVALUE", "purchaseCost", "Purchase Cost"), 0);
  const replacementCost = number(value(row, "replacementCost", "Replacement Cost"), cost);
  const lifeMonths = integer(value(row, "SERVICELIFE", "Life Expectancy (in months)", "lifeExpectancyMonths"), 96);
  const installDate = date(value(row, "COMMISSIONDATE", "installDate", "Purchase Date"), new Date());
  const outOfService = yesNo(value(row, "OUTOFSERVICE", "outOfService"), false);
  const status = outOfService ? "RETIRED" : assetStatusFromImport(value(row, "ASSETSTATUS", "status"));
  const documentationUrl = [value(row, "documentationUrl", "URL 1"), value(row, "URL 2")].filter(Boolean).join("\n") || null;
  const remarks = [
    value(row, "remarks", "Remarks"),
    value(row, "Vendors") ? `Vendors: ${value(row, "Vendors")}` : "",
    value(row, "Parts") ? `Parts: ${value(row, "Parts")}` : "",
    replacementCost ? `Replacement Cost: SAR ${replacementCost}` : "",
  ].filter(Boolean).join("\n");
  const assetData = {
    name,
    category,
    system,
    eqType: value(row, "EQTYPE") || "ASSET",
    organization: value(row, "ORGANIZATION") || null,
    criticality: priority(row.criticality),
    status,
    assetStatusText: value(row, "ASSETSTATUS") || status,
    serialNumber: value(row, "SERIALNUMBER", "serialNumber", "Serial No.") || `${tag}-SN`,
    siteCode: value(row, "siteCode", "SITE") || location?.site || "",
    zone: value(row, "zone", "ZONE") || location?.parentLocation || "",
    buildingCode: value(row, "buildingCode", "BLDG") || location?.building || "",
    assetGroup: value(row, "CLASS", "classCode") || category,
    assetDescription: name,
    additionalDescription: description,
    departmentDesc: value(row, "DEPARTMENT_DESC") || null,
    classCode: value(row, "CLASS") || null,
    classDesc: value(row, "CLASS_DESC") || null,
    categoryDesc: value(row, "CATEGORY_DESC") || null,
    gsrc: value(row, "GSRC") || null,
    attribute: value(row, "ATTRIBUTE") || null,
    environment: value(row, "ENVIRONMENT") || null,
    pressureBar: value(row, "PRESSURE_BAR") || null,
    flowLps: value(row, "FLOW_LPS") || null,
    supplyVoltageVolt: value(row, "SUPPLY_VOLTAGE_Volt") || null,
    outOfService,
    serviceLife: value(row, "SERVICELIFE") || null,
    locationCode: locationCode || null,
    locationDesc: value(row, "LOCATION_DESC") || location?.description || null,
    position: value(row, "POSITION") || null,
    classOrganization: value(row, "CLASSORGANIZATION") || null,
    primarySystem: value(row, "PRIMARYSYSTEM") || null,
    additionalNote: value(row, "ADDITIONAL_NOTE") || null,
    parentAsset: value(row, "parentAsset", "Parent Asset", "Parent Asset ") || "TOP LEVEL",
    departmentCode,
    assignedTeamCode: value(row, "assignedTeamCode", "Assigned Team", "Team Code"),
    assignedSupervisorEmail: value(row, "assignedSupervisorEmail", "Supervisor", "Supervisor Email"),
    remarks,
    manufacturer: value(row, "MANUFACTURER", "manufacturer", "Manufacturer") || "Not specified",
    model: value(row, "MODEL", "model", "Model No.") || "Not specified",
    floor,
    room,
    installDate,
    replacementDate: date(value(row, "ENDOFUSEFULLIFE"), addDays(installDate, lifeMonths * 30)),
    warrantyExpiry: date(value(row, "warrantyExpiry", "Warranty Expiry Date"), addYears(new Date(), 1)),
    contractRef: value(row, "contractRef", "Vendors") || "Not assigned",
    documentationUrl,
    purchaseCost: cost,
    salvageValue: number(value(row, "salvageValue", "Salvage Value"), Math.round(cost * 0.1)),
    depreciationRate: number(row.depreciationRate, 10),
    conditionScore: number(row.conditionScore, 85),
    qrCode: value(row, "qrCode", "QR Code") || `CAFM-ASSET:${tag}`,
  };
  const asset = await prisma.asset.upsert({
    where: { tag },
    update: assetData,
    create: {
      tag,
      ...assetData,
      siteId: hierarchy.site.id,
      buildingId: hierarchy.building?.id ?? ("buildings" in hierarchy.site ? hierarchy.site.buildings[0]?.id : undefined),
    },
  });

  await prisma.assetHistory.create({
    data: {
      assetId: asset.id,
      eventType: "BULK_IMPORT",
      title: "Asset bulk imported",
      details: `Imported or updated from CSV: ${tag}`,
      actor: "Admin",
    },
  });
  return importResult("asset", "UPSERT", asset, tag, name);
}

async function importHousingAsset(row: Row) {
  const tag = value(row, "tag", "code", "Asset Code", "Housing Asset Code", "assetCode");
  if (!tag) throw new Error("Asset Code is required");

  const room = await housingRoomForAsset(row);
  const assetValue = number(value(row, "assetValue", "Asset Value", "purchaseCost", "Purchase Cost"), 0);
  const depreciationRate = number(value(row, "depreciationRate", "Depreciation Rate"), 0);
  const purchaseDate = optionalDate(value(row, "purchaseDate", "Purchase Date"));
  const currentValueInput = value(row, "currentValue", "Current Value");
  const years = purchaseDate ? Math.max(0, (Date.now() - purchaseDate.getTime()) / (365 * 24 * 60 * 60 * 1000)) : 0;
  const currentValue = currentValueInput
    ? number(currentValueInput, assetValue)
    : Math.max(0, Math.round((assetValue * Math.max(0, 1 - (depreciationRate / 100) * years)) * 100) / 100);
  const roomLocation = value(row, "roomLocation", "Room Location", "roomNumber", "Room Number") || room?.roomNumber || "";
  const buildingLocation = value(row, "buildingLocation", "Building Location", "building", "Building") || room?.block?.name || room?.property?.name || "";
  const payload = {
    name: value(row, "name", "Asset Name") || value(row, "description", "Description") || tag,
    category: value(row, "category", "Category") || "Furniture",
    description: value(row, "description", "Description", "notes", "Notes") || "",
    brand: value(row, "brand", "Brand") || "",
    model: value(row, "model", "Model") || "",
    purchaseDate: purchaseDate || undefined,
    supplierName: value(row, "supplierName", "Supplier Name") || "",
    assetValue,
    buildingLocation,
    roomLocation,
    custodianName: value(row, "custodianName", "Custodian Name") || "",
    custodianContact: value(row, "custodianContact", "Custodian Contact") || "",
    issuedTo: value(row, "issuedTo", "Issued To") || "",
    issuedAt: optionalDate(value(row, "issuedAt", "Issued At")) || undefined,
    transferredFrom: value(row, "transferredFrom", "Transferred From") || "",
    transferredTo: value(row, "transferredTo", "Transferred To") || "",
    transferredAt: optionalDate(value(row, "transferredAt", "Transferred At")) || undefined,
    replacementOf: value(row, "replacementOf", "Replacement Of") || "",
    replacedAt: optionalDate(value(row, "replacedAt", "Replaced At")) || undefined,
    pmSchedule: value(row, "pmSchedule", "PM Schedule") || "",
    nextPmDue: optionalDate(value(row, "nextPmDue", "Next PM Due")) || undefined,
    depreciationRate,
    currentValue,
    lastInspectionAt: optionalDate(value(row, "lastInspectionAt", "Last Inspection At")) || undefined,
    roomId: room?.id,
    status: value(row, "status", "Status") || "ACTIVE",
    serialNumber: value(row, "serialNumber", "Serial Number") || "",
    warrantyExpiry: optionalDate(value(row, "warrantyExpiry", "Warranty Expiry")) || undefined,
    qrCode: value(row, "qrCode", "QR Code") || `QR:${tag}`,
    photoUrls: value(row, "photoUrls", "Photo URLs", "attachmentUrls", "Attachment URLs") || "",
  };

  const asset = await prisma.housingAsset.upsert({
    where: { tag },
    update: payload,
    create: { tag, ...payload },
  });
  await prisma.housingHistory.create({
    data: {
      entity: "asset",
      entityId: asset.id,
      assetId: asset.id,
      roomId: asset.roomId,
      actor: "Bulk Upload",
      action: value(row, "movementAction", "Movement Action") || "Housing asset bulk imported",
      details: value(row, "notes", "Notes", "remarks", "Remarks") || `${asset.tag} / ${asset.status}`,
    },
  });
  return importResult("housing_asset", "UPSERT", asset, tag, asset.name);
}

async function importInventory(row: Row) {
  const sku = required(row, "sku");
  const item = await prisma.inventoryItem.upsert({
    where: { sku },
    update: {
      name: required(row, "name"),
      category: row.category || "General",
      unit: row.unit || "pcs",
      onHand: integer(row.onHand, 0),
      reorderPoint: integer(row.reorderPoint, 0),
      unitCost: number(row.unitCost, 0),
      vendor: row.vendor || "Not assigned",
      location: row.location || "Central Store",
    },
    create: {
      sku,
      name: required(row, "name"),
      category: row.category || "General",
      unit: row.unit || "pcs",
      onHand: integer(row.onHand, 0),
      reorderPoint: integer(row.reorderPoint, 0),
      unitCost: number(row.unitCost, 0),
      vendor: row.vendor || "Not assigned",
      location: row.location || "Central Store",
    },
  });
  return importResult("inventory_item", "UPSERT", item, sku, item.name);
}

async function importRequest(row: Row) {
  const count = await prisma.serviceRequest.count();
  const slaHours = integer(row.slaHours, priority(row.priority) === "CRITICAL" ? 4 : 24);
  const request = await prisma.serviceRequest.create({
    data: {
      ticketNo: row.ticketNo || `SR-${String(count + 24001).padStart(5, "0")}`,
      title: required(row, "title"),
      category: row.category || "General",
      departmentCode: row.departmentCode || "",
      serviceCode: row.serviceCode || "",
      assignedTeamCode: row.assignedTeamCode || "",
      requester: row.requester || "Bulk Upload",
      channel: row.channel || "Bulk Upload",
      priority: priority(row.priority),
      status: workStatus(row.status, "NEW"),
      location: row.location || "Unassigned",
      attachmentUrls: row.attachmentUrls || "",
      rejectionReason: row.rejectionReason || "",
      slaHours,
      dueAt: addHours(new Date(), slaHours),
      description: row.description || row.title || "Bulk uploaded request",
    },
  });
  return importResult("service_request", "CREATE", request, request.ticketNo, request.title);
}

async function importWorkOrder(row: Row) {
  const count = await prisma.workOrder.count();
  const asset = row.assetTag ? await prisma.asset.findUnique({ where: { tag: row.assetTag } }) : null;
  const woNo = row.woNo || `WO-${String(count + 81001).padStart(5, "0")}`;
  const plannedStart = date(value(row, "plannedStart", "schedStartDate", "Sched. Start Date"), new Date());
  const finishedAt = optionalDate(value(row, "finishedAt", "dateCompleted", "Date Completed"));
  const resolutionAt = optionalDate(value(row, "resolutionAt", "dateCompleted", "Date Completed")) || finishedAt;
  const dueAt = date(value(row, "dueAt", "dateCompleted", "Date Completed"), addHours(plannedStart, integer(row.dueHours, 24)));
  const importedCreatedAt = optionalDate(value(row, "dateTimeCreated", "createdAt", "Date/Time Created"));
  const actualHours = numberOrNull(value(row, "actualHours"));
  const payload = {
    title: required(row, "title"),
    type: row.type || "Corrective Maintenance",
    assetType: row.assetType || asset?.assetGroup || asset?.category || "",
    departmentCode: row.departmentCode || "",
    serviceCode: row.serviceCode || "",
    assignedTeamCode: row.assignedTeamCode || "",
    jobPlanCode: row.jobPlanCode || "",
    priority: priority(row.priority),
    status: workStatus(row.status, "ASSIGNED"),
    assetId: asset?.id,
    plannedStart,
    dueAt,
    responseAt: importedCreatedAt,
    resolutionAt,
    finishedAt,
    estimatedHours: number(row.estimatedHours, actualHours ?? 2),
    actualHours,
    cost: number(row.cost, 0),
    jobPlan: row.jobPlan || "Review, execute, document and close.",
    safetyNotes: row.safetyNotes || "Verify PPE and permits before work starts.",
    workNotes: row.workNotes || "",
    materialRequest: row.materialRequest || "",
    photoUrls: row.photoUrls || "",
    assetsUsed: row.assetsUsed || row.assetTag || "",
    inventoryUsed: row.inventoryUsed || "",
    supervisorDecision: row.supervisorDecision || "",
  };
  const workOrder = await prisma.workOrder.upsert({
    where: { woNo },
    update: payload,
    create: {
      woNo,
      ...payload,
      createdAt: importedCreatedAt || undefined,
    },
  });
  if (asset?.id) {
    await prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        eventType: "WORK_ORDER_IMPORT",
        title: `${workOrder.woNo} imported`,
        details: `${workOrder.title} / ${workOrder.status} / ${workOrder.departmentCode || "No department"}.`,
        actor: "Bulk Upload",
      },
    });
  }
  return importResult("work_order", "CREATE", workOrder, workOrder.woNo, workOrder.title);
}

async function importTeam(row: Row) {
  const code = row.departmentCode || required(row, "code");
  const team = await prisma.team.upsert({
    where: { code },
    update: teamPayload(row),
    create: { code, ...teamPayload(row) },
  });
  return importResult("team", "UPSERT", team, code, team.name);
}

async function importDepartment(row: Row) {
  const code = required(row, "code");
  const department = await prisma.department.upsert({
    where: { code },
    update: {
      name: required(row, "name"),
      siteLocation: row.siteLocation || "Unassigned",
      description: row.description || "",
    },
    create: {
      code,
      name: required(row, "name"),
      siteLocation: row.siteLocation || "Unassigned",
      description: row.description || "",
    },
  });
  return importResult("department", "UPSERT", department, code, department.name);
}

async function importEmployee(row: Row) {
  const companyId = required(row, "companyId");
  const employee = await prisma.employee.upsert({
    where: { companyId },
    update: employeePayload(row),
    create: { companyId, ...employeePayload(row) },
  });
  return importResult("employee", "UPSERT", employee, companyId, employee.name);
}

async function importService(row: Row) {
  const team = row.teamCode ? await prisma.team.findUnique({ where: { code: row.teamCode } }) : null;
  const code = row.departmentCode || required(row, "code");
  const service = await prisma.serviceCatalog.upsert({
    where: { code },
    update: servicePayload(row, team?.id),
    create: { code, ...servicePayload(row, team?.id) },
  });
  return importResult("service_catalog", "UPSERT", service, code, service.name);
}

async function importCategory(row: Row) {
  const code = required(row, "code");
  const category = await prisma.assetCategory.upsert({
    where: { code },
    update: categoryPayload(row),
    create: { code, ...categoryPayload(row) },
  });
  return importResult("asset_category", "UPSERT", category, code, category.name);
}

async function importInspection(row: Row) {
  const count = await prisma.inspection.count();
  const inspection = await prisma.inspection.create({
    data: {
      code: row.code || `INS-${String(count + 1001).padStart(5, "0")}`,
      title: required(row, "title"),
      area: row.area || "General",
      inspector: row.inspector || "Bulk Upload",
      risk: risk(row.risk),
      score: integer(row.score, 85),
      status: workStatus(row.status, "NEW"),
      dueAt: date(row.dueAt, addDays(new Date(), 7)),
      findings: row.findings || "No findings recorded.",
    },
  });
  return importResult("inspection", "CREATE", inspection, inspection.code, inspection.title);
}

async function importLocation(row: Row) {
  const code = required(row, "code", "Location");
  const location = await prisma.location.upsert({
    where: { code },
    update: locationPayload(row),
    create: { code, ...locationPayload(row) },
  });
  return importResult("location", "UPSERT", location, code, location.description || code);
}

async function importJobPlan(row: Row) {
  const code = required(row, "code");
  const jobPlan = await prisma.jobPlan.upsert({
    where: { code },
    update: jobPlanPayload(row),
    create: { code, ...jobPlanPayload(row) },
  });
  return importResult("job_plan", "UPSERT", jobPlan, code, jobPlan.name);
}

async function importPpm(row: Row) {
  const baseCode = required(row, "code", "PPM CODE", "ppmCode");
  const rawAssetTag = value(row, "assetTag", "asset", "assetCode", "EQUIPMENTNO", "OBJECT (ASSET/LOCATION)");
  const rawLocationCode = value(row, "locationCode", "location", "Location", "LOCATION", "OBJECTS LOCATIONS");
  const assetTag = rawAssetTag && !rawAssetTag.startsWith("L-") ? rawAssetTag : "";
  const inputLocationCode = rawLocationCode || (rawAssetTag.startsWith("L-") ? rawAssetTag : "");
  const asset = assetTag ? await prisma.asset.findUnique({ where: { tag: assetTag } }) : null;
  const locationCode = inputLocationCode || asset?.locationCode || "";
  const location = locationCode ? await prisma.location.findUnique({ where: { code: locationCode } }) : null;

  if (assetTag && !asset) throw new Error(`Asset not found for PPM: ${assetTag}`);
  if (locationCode && !location && !asset?.locationCode) throw new Error(`Location not found for PPM: ${locationCode}`);
  if (!assetTag && !locationCode) throw new Error("assetTag or locationCode is required");

  const targetKey = assetTag || locationCode;
  const code = value(row, "uniqueCode") || uniquePpmCode(baseCode, targetKey);
  const nextDue = optionalDate(value(row, "nextDue", "DUE DATE", "dueAt")) || addDays(new Date(), 7);
  const activeValue = value(row, "active");
  const data = {
    name: value(row, "name", "PPM DESCRIPTION", "description") || baseCode,
    assetTag: assetTag || "",
    locationCode,
    departmentCode: value(row, "departmentCode", "DEPARTMENT", "DEPARTMENT ") || asset?.departmentCode || "",
    priority: priority(value(row, "priority", "OBJECT CRITICALITY")),
    frequency: value(row, "frequency", "FREQUENCY") || "Monthly",
    nextDue,
    durationHrs: number(value(row, "durationHrs", "duration", "PPA_DURATION"), 2),
    checklist: value(row, "checklist", "ACTIVITY CHECKLIST", "steps") || "Checklist to be defined.",
    active: activeValue ? yesNo(activeValue, true) : true,
  };
  const ppm = await prisma.preventiveMaintenance.upsert({
    where: { code },
    update: data,
    create: { code, ...data },
  });
  return importResult("preventive_maintenance", "UPSERT", ppm, code, data.name);
}

async function importDocumentIndex(row: Row, context: ImportContext = {}) {
  const category = value(row, "category") || "OM_MANUAL";
  const folder = documentCategories[category];
  if (!folder) throw new Error(`Invalid document category: ${category}`);

  const assetTag = required(row, "assetTag", "EQUIPMENTNO", "Asset Number");
  const originalName = value(row, "fileName") || path.basename(value(row, "sourcePath", "filePath", "path"));
  const uploadedFile = originalName ? context.documentFiles?.get(originalName.trim().toLowerCase()) : undefined;

  const asset = await prisma.asset.findUnique({ where: { tag: assetTag } });
  if (!asset) throw new Error(`Asset not found for document upload: ${assetTag}`);

  if (uploadedFile) return importUploadedDocument(row, assetTag, category, folder, uploadedFile, originalName);
  const libraryRecord = await getManualLibraryRecord(originalName);
  if (libraryRecord) return importLibraryDocument(assetTag, category, libraryRecord);

  const sourcePath = required(row, "sourcePath", "filePath", "path");
  const resolvedSource = path.resolve(sourcePath);
  if (!allowedManualRoots.some((root) => resolvedSource === root || resolvedSource.startsWith(`${root}${path.sep}`))) {
    throw new Error(`${originalName || "Document"} was not uploaded with the CSV and the server cannot read this local source path. Attach manual files in the O&M upload form.`);
  }

  const ext = path.extname(resolvedSource).toLowerCase();
  if (!allowedDocumentExtensions.has(ext)) throw new Error(`Unsupported document type: ${ext || "unknown"}`);

  let sourceInfo = documentSourceCache.get(resolvedSource);
  if (!sourceInfo) {
    const fileStats = await stat(resolvedSource);
    if (!fileStats.isFile()) throw new Error("Document source path is not a file");
    if (fileStats.size > MAX_DOCUMENT_FILE_SIZE) throw new Error(`${path.basename(resolvedSource)} exceeds the 60 MB document size limit`);
    sourceInfo = {
      checksum: createHash("sha256").update(await readFile(resolvedSource)).digest("hex"),
      ext,
      size: fileStats.size,
    };
    documentSourceCache.set(resolvedSource, sourceInfo);
  }

  const checksum = sourceInfo.checksum;
  const existing = await prisma.documentUpload.findUnique({
    where: { category_assetTag_checksum: { category, assetTag, checksum } },
  });
  if (existing) return importResult("document_upload", "EXISTS", existing, assetTag, existing.fileName);

  const uploadDir = path.join(privateUploadRoot, "document-management", folder, "_manual-library");
  await mkdir(uploadDir, { recursive: true });
  const storedName = `${checksum}-${safeSegment(path.basename(originalName, ext)) || "document"}${ext}`;
  const storedPath = path.join(uploadDir, storedName);
  if (!copiedDocumentCache.has(storedPath)) {
    try {
      await stat(storedPath);
    } catch {
      await copyFile(resolvedSource, storedPath);
    }
    copiedDocumentCache.add(storedPath);
  }

  const record = await prisma.documentUpload.create({
    data: {
      category,
      assetTag,
      fileName: originalName,
      fileUrl: privateFileUrl(`document-management/${folder}/_manual-library/${storedName}`),
      fileSize: sourceInfo.size,
      mimeType: mimeTypeFromExtension(ext),
      checksum,
      uploadedBy: "Bulk Upload",
    },
  });
  return importResult("document_upload", "CREATE", record, assetTag, originalName);
}

async function getManualLibraryRecord(originalName: string) {
  if (!originalName) return null;
  if (!manualLibraryManifestCache) {
    const manifestPath = path.join(privateUploadRoot, "document-management", documentCategories.OM_MANUAL, "_manual-library", "manifest.json");
    try {
      manualLibraryManifestCache = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, ManualLibraryRecord>;
    } catch {
      manualLibraryManifestCache = {};
    }
  }
  return manualLibraryManifestCache[originalName.trim().toLowerCase()] ?? null;
}

async function importLibraryDocument(assetTag: string, category: string, libraryRecord: ManualLibraryRecord) {
  const existing = await prisma.documentUpload.findUnique({
    where: { category_assetTag_checksum: { category, assetTag, checksum: libraryRecord.checksum } },
  });
  if (existing) return importResult("document_upload", "EXISTS", existing, assetTag, existing.fileName);

  const record = await prisma.documentUpload.create({
    data: {
      category,
      assetTag,
      fileName: libraryRecord.originalName,
      fileUrl: libraryRecord.fileUrl,
      fileSize: libraryRecord.fileSize,
      mimeType: libraryRecord.mimeType,
      checksum: libraryRecord.checksum,
      uploadedBy: "Bulk Upload",
    },
  });
  return importResult("document_upload", "CREATE", record, assetTag, libraryRecord.originalName);
}

async function importUploadedDocument(_row: Row, assetTag: string, category: string, folder: string, uploadedFile: UploadedDocumentFile, originalName: string) {
  const ext = path.extname(originalName).toLowerCase();
  if (!allowedDocumentExtensions.has(ext)) throw new Error(`Unsupported document type: ${ext || "unknown"}`);
  if (uploadedFile.size > MAX_DOCUMENT_FILE_SIZE) throw new Error(`${originalName} exceeds the 60 MB document size limit`);

  const cacheKey = `uploaded:${uploadedFile.name}:${uploadedFile.size}`;
  let sourceInfo = documentSourceCache.get(cacheKey);
  let buffer: Buffer | null = null;
  if (!sourceInfo) {
    buffer = Buffer.from(await uploadedFile.file.arrayBuffer());
    sourceInfo = {
      checksum: createHash("sha256").update(buffer).digest("hex"),
      ext,
      size: uploadedFile.size,
    };
    documentSourceCache.set(cacheKey, sourceInfo);
  }

  const checksum = sourceInfo.checksum;
  const existing = await prisma.documentUpload.findUnique({
    where: { category_assetTag_checksum: { category, assetTag, checksum } },
  });
  if (existing) return importResult("document_upload", "EXISTS", existing, assetTag, existing.fileName);

  const uploadDir = path.join(privateUploadRoot, "document-management", folder, "_manual-library");
  await mkdir(uploadDir, { recursive: true });
  const storedName = `${checksum}-${safeSegment(path.basename(originalName, ext)) || "document"}${ext}`;
  const storedPath = path.join(uploadDir, storedName);
  if (!copiedDocumentCache.has(storedPath)) {
    try {
      await stat(storedPath);
    } catch {
      if (!buffer) buffer = Buffer.from(await uploadedFile.file.arrayBuffer());
      await writeFile(storedPath, buffer, { mode: 0o644 });
    }
    copiedDocumentCache.add(storedPath);
  }

  const record = await prisma.documentUpload.create({
    data: {
      category,
      assetTag,
      fileName: originalName,
      fileUrl: privateFileUrl(`document-management/${folder}/_manual-library/${storedName}`),
      fileSize: sourceInfo.size,
      mimeType: mimeTypeFromExtension(ext),
      checksum,
      uploadedBy: "Bulk Upload",
    },
  });
  return importResult("document_upload", "CREATE", record, assetTag, originalName);
}

function importResult(recordType: string, action: string, record: { id?: string } | null | undefined, recordKey?: string, displayName?: string): ImportResult {
  return {
    action,
    recordType,
    recordId: record?.id,
    recordKey,
    displayName,
  };
}

function rowIdentifier(module: string, row: Row) {
  return value(row, "tag", "Asset Code", "Housing Asset Code", "EQUIPMENTNO", "ASSET NUMBER", "sku", "ticketNo", "woNo", "code", "Location", "locationCode", "assetTag", "companyId", "email") || module || "unknown";
}

function safeSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function mimeTypeFromExtension(ext: string) {
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".csv") return "text/csv";
  if (ext === ".txt") return "text/plain";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

function rowDisplayName(row: Row) {
  return value(row, "name", "title", "EQUIPMENTDESC", "Asset Name", "description", "Description");
}

function teamPayload(row: Row) {
  return {
    name: required(row, "name"),
    type: row.service || row.type || "Service Team",
    supervisor: row.companyIdNumber || row.supervisor || "Unassigned",
    phone: row.phone || "",
    email: row.email || "",
    shift: row.shift || "General",
    coverage: row.service || row.coverage || "Site-wide",
  };
}

function servicePayload(row: Row, teamId?: string) {
  return {
    name: row.departmentName || required(row, "name"),
    category: row.departmentName || row.category || "General",
    type: row.type || "Department Service",
    priority: priority(row.priority),
    slaHours: integer(row.slaHours, 24),
    teamId,
    description: row.description || `Department ${row.departmentCode || row.code || ""}`,
  };
}

function categoryPayload(row: Row) {
  return {
    name: required(row, "name"),
    type: row.type || "Asset",
    defaultLifeYrs: integer(row.defaultLifeYrs, 10),
    statutory: ["true", "yes", "1"].includes(String(row.statutory || "").toLowerCase()),
    description: row.description || "",
  };
}

function employeePayload(row: Row) {
  return {
    name: required(row, "name"),
    email: required(row, "email"),
    nationalityType: row.nationalityType || "Unspecified",
    departmentCode: row.departmentCode || "UNASSIGNED",
    siteLocation: row.siteLocation || "Unassigned",
  };
}

function locationPayload(row: Row) {
  const parentLocation = value(row, "parentLocation", "Parent Location", "ParentLocation", "zone");
  const locationClass = value(row, "locationClass", "Class", "class", "type") || "Facility Location";
  const outOfService = yesNo(value(row, "outOfService", "Out of Service"), false);
  return {
    site: value(row, "site", "Site") || "Fadhili Bachelor Camp",
    zone: parentLocation,
    building: row.building || row.BLDG || "Unassigned",
    floor: row.floor || row.FLOOR || "Unassigned",
    room: row.room || row.ROOM || "Unassigned",
    type: locationClass,
    parentLocation,
    locationClass,
    outOfService,
    residential: yesNo(value(row, "residential", "Residential"), false),
    active: !outOfService,
    description: value(row, "description", "Description") || "",
  };
}

function jobPlanPayload(row: Row) {
  return {
    name: required(row, "name"),
    assetType: required(row, "assetType"),
    departmentCode: row.departmentCode || "",
    serviceCode: row.serviceCode || "",
    estimatedHours: number(row.estimatedHours, 2),
    priority: priority(row.priority),
    steps: row.steps || row.jobPlan || "Inspect, execute, test and close.",
    safetyNotes: row.safetyNotes || "",
  };
}

async function housingRoomForAsset(row: Row) {
  const roomId = value(row, "roomId", "Room Id");
  if (roomId) return prisma.housingRoom.findUnique({ where: { id: roomId }, include: { property: true, block: true } });
  const code = value(row, "roomCode", "Room Code");
  if (code) return prisma.housingRoom.findUnique({ where: { code }, include: { property: true, block: true } });
  const roomNumber = value(row, "roomNumber", "Room Number", "roomLocation", "Room Location");
  if (!roomNumber) return null;
  return prisma.housingRoom.findFirst({ where: { roomNumber }, include: { property: true, block: true } });
}

function required(row: Row, ...keys: string[]) {
  const found = value(row, ...keys);
  if (!found) throw new Error(`${keys[0]} is required`);
  return found;
}

function value(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const found = row[key];
    if (found !== undefined && found !== null && String(found).trim() !== "") return String(found).trim();
  }
  return "";
}

function uniquePpmCode(baseCode: string, targetKey: string) {
  const normalizedTarget = targetKey.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const normalizedBase = baseCode.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${normalizedBase || "PPM"}-${normalizedTarget || "TARGET"}`.slice(0, 120);
}

function number(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numberOrNull(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: string | undefined, fallback: number) {
  return Math.round(number(value, fallback));
}

function yesNo(value: string | undefined, fallback: boolean) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["yes", "true", "1", "y"].includes(normalized)) return true;
  if (["no", "false", "0", "n"].includes(normalized)) return false;
  return fallback;
}

function date(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function optionalDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function priority(value: string | undefined) {
  const normalized = String(value || "MEDIUM").trim().toUpperCase();
  if (["URGENT", "EMERGENCY", "CRITICAL", "P1"].includes(normalized)) return "CRITICAL";
  if (["IMPORTANT", "HIGH", "P2"].includes(normalized)) return "HIGH";
  if (["LOW", "P4"].includes(normalized)) return "LOW";
  return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(normalized) ? normalized as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" : "MEDIUM";
}

function assetStatus(value: string | undefined) {
  const normalized = String(value || "ACTIVE").toUpperCase();
  return ["ACTIVE", "STANDBY", "DOWN", "RETIRED"].includes(normalized) ? normalized as "ACTIVE" | "STANDBY" | "DOWN" | "RETIRED" : "ACTIVE";
}

function assetStatusFromImport(value: string | undefined) {
  const normalized = String(value || "INSTALLED").toUpperCase();
  if (["INSTALLED", "OPERATING", "ONLINE"].includes(normalized)) return "ACTIVE";
  if (["OUT OF SERVICE", "OUTOFSERVICE", "INACTIVE"].includes(normalized)) return "RETIRED";
  return assetStatus(normalized);
}

function workStatus(value: string | undefined, fallback: "NEW" | "ASSIGNED") {
  const normalized = String(value || fallback).trim().toUpperCase().replace(/[-_]+/g, " ");
  if (["CLOSE CM", "CLOSED CM", "CLOSE", "CLOSED", "COMPLETED", "COMPLETE"].includes(normalized)) return "CLOSED";
  if (normalized.includes("PROGRESS")) return "IN_PROGRESS";
  if (normalized.includes("HOLD")) return "ON_HOLD";
  if (normalized.includes("REOPEN")) return "REOPENED";
  if (normalized.includes("ASSIGN")) return "ASSIGNED";
  const enumValue = normalized.replace(/\s+/g, "_");
  return ["OPEN", "NEW", "TRIAGED", "APPROVED", "REJECTED", "PENDING_ASSIGNMENT", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "PENDING_SUPERVISOR_REVIEW", "VERIFIED", "REOPENED", "CLOSED"].includes(enumValue)
    ? enumValue as "OPEN" | "NEW" | "TRIAGED" | "APPROVED" | "REJECTED" | "PENDING_ASSIGNMENT" | "ASSIGNED" | "ACCEPTED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "PENDING_SUPERVISOR_REVIEW" | "VERIFIED" | "REOPENED" | "CLOSED"
    : fallback;
}

function risk(value: string | undefined) {
  const normalized = String(value || "MODERATE").toUpperCase();
  return ["LOW", "MODERATE", "HIGH", "EXTREME"].includes(normalized) ? normalized as "LOW" | "MODERATE" | "HIGH" | "EXTREME" : "MODERATE";
}
