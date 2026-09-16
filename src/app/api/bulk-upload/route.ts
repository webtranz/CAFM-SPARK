import { cleanHousingDepartment, preservedHousingDepartment } from "@/lib/housing-departments";
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
import { allowsCustomPpmLocation } from "@/lib/scoped-ppm-custom-locations";

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
type ImportMode = "keepExisting" | "replaceExisting" | "deleteExisting";
type ImportContext = { documentFiles?: Map<string, UploadedDocumentFile>; mode?: ImportMode; deletedRows?: number };
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
    const { error } = await requireAnyPermission(["assets.manage", "work.manage", "requests.manage", "users.manage", "documents.upload", "housing.manage"]);
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
    const requestedModule = String(formData.get("module") || "");
    const context = buildImportContext(requestedModule, formData);
    const file = formData.get("file");
    const deleteOnly = context.mode === "deleteExisting";

    if (!(file instanceof File) && !deleteOnly) {
      return apiError(new Error("CSV file is required."), "CSV file is required", 400);
    }

    const uploadFile = file instanceof File ? file : null;
    const rows = uploadFile ? parseCsv(await uploadFile.text()) : [];
    const module = detectBulkUploadModule(requestedModule, rows);
    const { error, user } = await requireAnyPermission(bulkUploadPermissions(module));
    if (error) return error;

    if (deleteOnly) {
      const deleted = await clearExistingBulkUploadData(module);
      const result = {
        created: 0,
        skipped: 0,
        failed: [],
        deleted,
        message: `${deleted.toLocaleString()} existing ${bulkModuleLabel(module)} records deleted.`,
      };
      await auditAction({
        user,
        action: "BULK_DELETE_EXISTING",
        entity: "bulk_upload",
        entityId: module || "unknown",
        details: { module, deleted, importMode: context.mode },
      });
      return NextResponse.json(result, { status: 200 });
    }

    if (rows.length > BACKGROUND_ROW_THRESHOLD) {
      const job = await prisma.bulkUploadJob.create({
        data: {
          module,
          fileName: uploadFile?.name || "CSV upload",
          fileSize: uploadFile?.size || 0,
          totalRows: rows.length,
          status: "QUEUED",
          message: "Bulk upload has been queued for background processing.",
          actorId: user?.id || null,
          actorName: user?.name || user?.email || "System",
          role: user?.role || "System",
        },
      });

      void processBulkUploadJob(job.id, module, rows, { name: uploadFile?.name || "CSV upload", size: uploadFile?.size || 0 }, user, context);

      return NextResponse.json({
        jobId: job.id,
        status: "QUEUED",
        module,
        fileName: uploadFile?.name || "CSV upload",
        fileSize: uploadFile?.size || 0,
        totalRows: rows.length,
        processedRows: 0,
        createdRows: 0,
        failedRows: 0,
        completion: 0,
        startedAt: job.createdAt,
        message: "Bulk upload has been queued for background processing.",
      }, { status: 202 });
    }

    const { created, skipped, failed, entries, result } = await processRows(module, rows, context);

    await auditAction({
      user,
      action: "BULK_UPLOAD",
      entity: "bulk_upload",
      entityId: module || "unknown",
      details: {
        module,
        fileName: uploadFile?.name || "CSV upload",
        fileSize: uploadFile?.size || 0,
        totalRows: rows.length,
        created,
        skipped,
        failed,
        entries,
        result,
        importMode: context.mode || "keepExisting",
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
  if (shouldDeleteBeforeImport(context)) {
    context.deletedRows = await clearExistingBulkUploadData(module);
  } else if (typeof context.deletedRows !== "number") {
    await syncHierarchyModuleBeforeImport(module, rows, context);
  }
  const failed: ImportFailure[] = [];
  const entries: ImportEntry[] = [];
  let created = 0;
  let skipped = 0;

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    try {
      const imported = await importRow(module, row, context);
      entries.push({ row: rowNumber, status: "SUCCESS", module, ...imported });
      if (imported.action === "EXISTS" || imported.action === "SKIPPED") skipped += 1;
      else created += 1;
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

  const result = csvResponse(created, failed, skipped);
  if (context.deletedRows) {
    result.message = `${context.deletedRows.toLocaleString()} old ${bulkModuleLabel(module)} records deleted. ${result.message}`;
    (result as typeof result & { deleted: number }).deleted = context.deletedRows;
  }
  return { created, skipped, failed, entries, result };
}

async function processBulkUploadJob(jobId: string, module: string, rows: Row[], file: { name: string; size: number }, user: BulkUploadUser, context: ImportContext = {}) {
  try {
    await prisma.bulkUploadJob.update({
      where: { id: jobId },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
        message: shouldDeleteBeforeImport(context)
          ? `Deleting old ${bulkModuleLabel(module)} records before importing ${rows.length} rows.`
          : `Processing ${rows.length} rows in chunks of ${BULK_UPLOAD_CHUNK_SIZE}.`,
      },
    });

    if (shouldDeleteBeforeImport(context)) {
      context.deletedRows = await clearExistingBulkUploadData(module);
      await prisma.bulkUploadJob.update({
        where: { id: jobId },
        data: {
          message: `${context.deletedRows.toLocaleString()} old ${bulkModuleLabel(module)} records deleted. Importing ${rows.length} rows in chunks of ${BULK_UPLOAD_CHUNK_SIZE}.`,
        },
      });
    }

    const { created, skipped, failed, entries, result } = await processRows(module, rows, context, async ({ processedRows, createdRows, failedRows }) => {
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
        skipped,
        failed,
        entries,
        result,
        jobId,
        background: true,
        chunkSize: BULK_UPLOAD_CHUNK_SIZE,
        importMode: context.mode || "keepExisting",
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

function detectBulkUploadModule(requestedModule: string, rows: Row[]) {
  const first = rows[0] || {};
  const headers = new Set(Object.keys(first).map(normalizeRowKey));
  if (headers.has("bookingno") && (headers.has("occupancystatus") || headers.has("checkin") || headers.has("checkout"))) return "housingOccupancy";
  if (headers.has("residentno") && (headers.has("guestid") || headers.has("companyname")) && !headers.has("bookingno")) return "housingGuests";
  if (headers.has("roomcode") && headers.has("roomnumber") && headers.has("roomtype") && !headers.has("bookingno")) return "housingRooms";
  if ((headers.has("ackevent") || headers.has("ack_event")) && (headers.has("ackdesc") || headers.has("ack_desc"))) return "ppmChecklistHistory";
  return requestedModule;
}
function bulkUploadPermissions(module: string) {
  if (module === "omManuals") return ["documents.upload"];
  if (module === "ppm") return ["ppm.manage", "assets.manage"];
  if (module === "ppmChecklistHistory") return ["ppm.manage", "work.manage", "assets.manage"];
  if (["housingAssets", "housingRooms", "housingGuests", "housingOccupancy"].includes(module)) return ["housing.manage", "assets.manage"];
  if (["workOrders", "workOrderComments", "commentHistory"].includes(module)) return ["work.manage", "assets.manage"];
  if (module === "requests") return ["requests.manage"];
  if (["teams", "services", "departments", "employees"].includes(module)) return ["users.manage", "requests.manage"];
  return ["assets.manage"];
}

function buildImportContext(module: string, formData: FormData): ImportContext {
  const requestedMode = String(formData.get("importMode") || "keepExisting");
  const mode: ImportMode = requestedMode === "replaceExisting" || requestedMode === "deleteExisting" ? requestedMode : "keepExisting";
  if (module !== "omManuals") return { mode };
  const documentFiles = new Map<string, UploadedDocumentFile>();
  formData.getAll("manualFiles").forEach((item) => {
    if (item instanceof File && item.size > 0) {
      documentFiles.set(item.name.trim().toLowerCase(), { file: item, name: item.name, size: item.size });
    }
  });
  return { documentFiles, mode };
}

async function importRow(module: string, row: Row, context: ImportContext = {}) {
  if (module === "sites") return importSite(row, context);
  if (module === "buildings") return importBuilding(row, context);
  if (module === "spaces") return importSpace(row, context);
  if (module === "assets") return importAsset(row, context);
  if (module === "housingAssets") return importHousingAsset(row, context);
  if (module === "housingRooms") return importHousingRoom(row, context);
  if (module === "housingGuests") return importHousingGuest(row, context);
  if (module === "housingOccupancy") return importHousingOccupancy(row, context);
  if (module === "inventory") return importInventory(row, context);
  if (module === "requests") return importRequest(row);
  if (module === "workOrders") return importWorkOrder(row, context);
  if (module === "workOrderComments") return importWorkOrderComment(row);
  if (module === "commentHistory") return importCommentHistory(row, context);
  if (module === "teams") return importTeam(row, context);
  if (module === "services") return importService(row, context);
  if (module === "departments") return importDepartment(row, context);
  if (module === "employees") return importEmployee(row, context);
  if (module === "categories") return importCategory(row, context);
  if (module === "inspections") return importInspection(row, context);
  if (module === "locations") return importLocation(row, context);
  if (module === "jobPlans") return importJobPlan(row, context);
  if (module === "ppm") return importPpm(row, context);
  if (module === "ppmChecklistHistory") return importPpmChecklistHistory(row, context);
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

function shouldReplace(context: ImportContext = {}) {
  return context.mode === "replaceExisting";
}

function shouldDeleteBeforeImport(context: ImportContext = {}) {
  return context.mode === "replaceExisting" && typeof context.deletedRows !== "number";
}

function bulkModuleLabel(module: string) {
  return module.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

async function clearExistingBulkUploadData(module: string) {
  let deleted = 0;
  const add = (result: { count: number }) => { deleted += result.count; };

  if (module === "ppm") {
    add(await prisma.preventiveMaintenance.deleteMany({}));
    return deleted;
  }
  if (module === "ppmChecklistHistory") {
    add(await prisma.ppmChecklistHistory.deleteMany({}));
    return deleted;
  }
  if (module === "workOrderComments") {
    add(await prisma.workOrder.updateMany({ where: { workNotes: { not: "" } }, data: { workNotes: "" } }));
    return deleted;
  }
  if (module === "commentHistory") {
    add(await prisma.commentHistory.deleteMany({}));
    return deleted;
  }
  if (module === "workOrders") {
    add(await prisma.inventoryIssue.deleteMany({}));
    add(await prisma.workOrder.deleteMany({}));
    return deleted;
  }
  if (module === "requests") {
    await prisma.workOrder.updateMany({ where: { requestId: { not: null } }, data: { requestId: null } });
    add(await prisma.serviceRequest.deleteMany({}));
    return deleted;
  }
  if (module === "assets") {
    await prisma.workOrder.updateMany({ where: { assetId: { not: null } }, data: { assetId: null } });
    await prisma.meter.updateMany({ where: { assetId: { not: null } }, data: { assetId: null } });
    add(await prisma.asset.deleteMany({}));
    return deleted;
  }
  if (module === "locations") {
    add(await prisma.location.deleteMany({}));
    return deleted;
  }
  if (module === "sites") {
    await clearExistingBulkUploadData("assets");
    add(await prisma.space.deleteMany({}));
    add(await prisma.building.deleteMany({}));
    add(await prisma.site.deleteMany({}));
    return deleted;
  }
  if (module === "buildings") {
    await prisma.asset.updateMany({ where: { buildingId: { not: null } }, data: { buildingId: null } });
    add(await prisma.space.deleteMany({}));
    add(await prisma.building.deleteMany({}));
    return deleted;
  }
  if (module === "spaces") {
    add(await prisma.space.deleteMany({}));
    return deleted;
  }
  if (module === "housingOccupancy") {
    const bookings = await prisma.housingBooking.findMany({ select: { id: true } });
    const bookingIds = bookings.map((booking) => booking.id);
    if (bookingIds.length) {
      add(await prisma.housingApproval.deleteMany({ where: { bookingId: { in: bookingIds } } }));
      add(await prisma.housingNotification.deleteMany({ where: { bookingId: { in: bookingIds } } }));
      add(await prisma.housingHistory.deleteMany({ where: { bookingId: { in: bookingIds } } }));
    }
    add(await prisma.housingBooking.deleteMany({}));
    await prisma.housingRoom.updateMany({ data: { occupancy: 0, status: "AVAILABLE" } });
    await prisma.housingBed.updateMany({ data: { occupant: null, occupantId: null, status: "AVAILABLE" } });
    return deleted;
  }
  if (module === "housingGuests") {
    await clearExistingBulkUploadData("housingOccupancy");
    add(await prisma.housingResident.deleteMany({}));
    return deleted;
  }
  if (module === "housingRooms") {
    await clearExistingBulkUploadData("housingOccupancy");
    add(await prisma.housingRoomHold.deleteMany({}));
    add(await prisma.housingInspection.deleteMany({}));
    add(await prisma.housingHistory.deleteMany({ where: { roomId: { not: null } } }));
    await prisma.housingAsset.updateMany({ where: { roomId: { not: null } }, data: { roomId: null } });
    await prisma.housingInventory.updateMany({ where: { roomId: { not: null } }, data: { roomId: null } });
    add(await prisma.housingBed.deleteMany({}));
    add(await prisma.housingRoom.deleteMany({}));
    add(await prisma.housingBlock.deleteMany({}));
    add(await prisma.housingProperty.deleteMany({}));
    return deleted;
  }
  if (module === "housingAssets") {
    add(await prisma.housingHistory.deleteMany({ where: { assetId: { not: null } } }));
    add(await prisma.housingAsset.deleteMany({}));
    return deleted;
  }
  if (module === "inventory") {
    add(await prisma.inventoryIssue.deleteMany({}));
    add(await prisma.inventoryItem.deleteMany({}));
    return deleted;
  }
  if (module === "omManuals") {
    add(await prisma.documentUpload.deleteMany({}));
    return deleted;
  }
  if (module === "jobPlans") {
    add(await prisma.jobPlan.deleteMany({}));
    return deleted;
  }
  if (module === "inspections") {
    add(await prisma.inspection.deleteMany({}));
    return deleted;
  }
  if (module === "teams") {
    await prisma.user.updateMany({ where: { teamId: { not: null } }, data: { teamId: null } });
    await prisma.serviceCatalog.updateMany({ where: { teamId: { not: null } }, data: { teamId: null } });
    add(await prisma.team.deleteMany({}));
    return deleted;
  }
  if (module === "services") {
    add(await prisma.serviceCatalog.deleteMany({}));
    return deleted;
  }
  if (module === "departments") {
    add(await prisma.department.deleteMany({}));
    return deleted;
  }
  if (module === "employees") {
    add(await prisma.employee.deleteMany({}));
    return deleted;
  }
  if (module === "categories") {
    add(await prisma.assetCategory.deleteMany({}));
    return deleted;
  }
  throw new Error(`Delete existing data is not supported for module: ${module}`);
}

function existingResult(recordType: string, record: { id?: string } | null | undefined, recordKey?: string, displayName?: string): ImportResult {
  return importResult(recordType, "EXISTS", record, recordKey, displayName);
}

async function syncHierarchyModuleBeforeImport(module: string, rows: Row[], context: ImportContext = {}) {
  if (!shouldReplace(context)) return;
  if (module === "locations") {
    const codes = rows.map((row) => value(row, "code", "Code", "LOCATION", "Location", "location")).filter(Boolean);
    if (!codes.length) return;
    await prisma.location.updateMany({
      where: { code: { notIn: codes } },
      data: { active: false, outOfService: true },
    });
    return;
  }
  if (module === "spaces") {
    const incomingBuildingCodes = rows.map((row) => value(row, "buildingCode", "Building code", "Building Code", "building", "BLDG")).filter(Boolean);
    const incoming = new Set(rows.map((row) => [value(row, "buildingCode", "Building code", "Building Code", "building", "BLDG"), value(row, "floor", "FLOOR"), value(row, "name", "space", "room", "locationCode", "Location code", "code")].join("|").toUpperCase()));
    const spaces = await prisma.space.findMany({ select: { id: true, name: true, floor: true, building: { select: { code: true } } } });
    const staleIds = spaces
      .filter((space) => !incoming.has([space.building.code, space.floor, space.name].join("|").toUpperCase()))
      .map((space) => space.id);
    if (staleIds.length) await prisma.space.deleteMany({ where: { id: { in: staleIds } } });
    if (incomingBuildingCodes.length) {
      await prisma.building.deleteMany({
        where: {
          code: { notIn: incomingBuildingCodes },
          assets: { none: {} },
          spaces: { none: {} },
        },
      });
    }
    return;
  }
  if (module === "buildings") {
    const codes = rows.map((row) => value(row, "buildingCode", "Building code", "Building Code", "code", "building", "Building", "BLDG")).filter(Boolean);
    if (!codes.length) return;
    await prisma.building.deleteMany({
      where: {
        code: { notIn: codes },
        assets: { none: {} },
        spaces: { none: {} },
      },
    });
    return;
  }
  if (module === "sites") {
    const names = rows.map((row) => value(row, "site", "siteName", "name", "Site")).filter(Boolean);
    if (!names.length) return;
    await prisma.site.deleteMany({
      where: {
        name: { notIn: names },
        assets: { none: {} },
        buildings: { none: {} },
      },
    });
  }
}

async function ensureSite(row: Row = {}, context: ImportContext = {}) {
  const name = value(row, "site", "siteName", "name", "Site") || "Fadhili Bachelor Camp";
  const city = value(row, "city", "City") || "Fadhili";
  const country = value(row, "country", "Country") || "Saudi Arabia";
  const type = value(row, "type", "siteType", "Type") || "Accommodation Camp";
  const areaSqm = integer(value(row, "areaSqm", "area", "AreaSqm"), 0);
  const existing = await prisma.site.findUnique({ where: { name_city_country: { name, city, country } } });
  if (existing && !shouldReplace(context)) return existing;
  return prisma.site.upsert({
    where: { name_city_country: { name, city, country } },
    update: { type, areaSqm },
    create: { name, city, country, type, areaSqm },
  });
}

async function ensureBuilding(row: Row = {}, siteInput?: { id: string }, context: ImportContext = {}) {
  const site = siteInput || await ensureSite(row, context);
  const code = value(row, "buildingCode", "code", "building", "Building", "BLDG") || "FBC";
  const name = value(row, "buildingName", "name", "description", "Description") || code;
  const floors = integer(value(row, "floors", "floorCount"), 1);
  const areaSqm = integer(value(row, "areaSqm", "area", "AreaSqm"), 0);
  const existing = await prisma.building.findUnique({ where: { code } });
  if (existing && !shouldReplace(context)) return existing;
  return prisma.building.upsert({
    where: { code },
    update: { name, siteId: site.id, floors, areaSqm },
    create: { code, name, siteId: site.id, floors, areaSqm },
  });
}

async function siteAndBuildingForAsset(location: { site?: string | null; building?: string | null; description?: string | null } | null, row: Row, context: ImportContext = {}) {
  const site = await ensureSite({
    site: value(row, "siteCode", "SITE") || location?.site || "Fadhili Bachelor Camp",
    city: value(row, "siteCity") || "Fadhili",
    country: value(row, "siteCountry") || "Saudi Arabia",
    type: value(row, "siteType") || "Accommodation Camp",
  }, context);
  const buildingCode = value(row, "buildingCode", "BLDG") || location?.building || "FBC";
  const building = await ensureBuilding({
    code: buildingCode,
    name: location?.description || buildingCode,
    floors: value(row, "buildingFloors") || "1",
    areaSqm: value(row, "buildingAreaSqm") || "0",
  }, site, context);
  return { site, building };
}

async function importSite(row: Row, context: ImportContext = {}) {
  const name = value(row, "site", "siteName", "name", "Site") || "Fadhili Bachelor Camp";
  const city = value(row, "city", "City") || "Fadhili";
  const country = value(row, "country", "Country") || "Saudi Arabia";
  const existing = await prisma.site.findUnique({ where: { name_city_country: { name, city, country } } });
  if (existing && !shouldReplace(context)) return existingResult("site", existing, existing.name, existing.name);
  const site = await ensureSite(row, context);
  return importResult("site", existing ? "UPDATE" : "CREATE", site, site.name, site.name);
}

async function importBuilding(row: Row, context: ImportContext = {}) {
  const code = value(row, "buildingCode", "code", "building", "Building", "BLDG") || "FBC";
  const existing = await prisma.building.findUnique({ where: { code } });
  if (existing && !shouldReplace(context)) return existingResult("building", existing, code, existing.name);
  const site = await ensureSite(row, context);
  const building = await ensureBuilding(row, site, context);
  return importResult("building", existing ? "UPDATE" : "CREATE", building, building.code, building.name);
}

async function importSpace(row: Row, context: ImportContext = {}) {
  const site = await ensureSite(row, context);
  const building = await ensureBuilding(row, site, context);
  const name = value(row, "name", "space", "room", "code") || "Space";
  const floor = value(row, "floor", "FLOOR") || "Ground";
  const type = value(row, "type", "spaceType", "locationClass") || "Space";
  const capacity = integer(value(row, "capacity"), 0);
  const areaSqm = integer(value(row, "areaSqm", "area"), 0);
  const occupancy = integer(value(row, "occupancy"), 0);
  const existing = await prisma.space.findUnique({ where: { buildingId_floor_name: { buildingId: building.id, floor, name } } });
  if (existing && !shouldReplace(context)) return existingResult("space", existing, `${building.code}/${floor}/${name}`, name);
  const space = await prisma.space.upsert({
    where: { buildingId_floor_name: { buildingId: building.id, floor, name } },
    update: { type, capacity, areaSqm, occupancy },
    create: { buildingId: building.id, name, floor, type, capacity, areaSqm, occupancy },
  });
  return importResult("space", existing ? "UPDATE" : "CREATE", space, `${building.code}/${floor}/${name}`, name);
}

async function importAsset(row: Row, context: ImportContext = {}) {
  const tag = value(row, "EQUIPMENTNO", "tag", "ASSET NUMBER", "assetNumber", "Asset Code");
  if (!tag) throw new Error("EQUIPMENTNO is required");
  const existing = await prisma.asset.findUnique({ where: { tag } });
  if (existing && !shouldReplace(context)) return existingResult("asset", existing, tag, existing.name);
  const locationCode = value(row, "LOCATION", "Location", "Location Name", "location", "ROOM", "room");
  const location = locationCode ? await prisma.location.findUnique({ where: { code: locationCode } }) : null;
  const hierarchy = location || value(row, "siteCode", "SITE", "buildingCode", "BLDG") ? await siteAndBuildingForAsset(location, row, context) : { site: await firstSite(), building: null };
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
  return importResult("asset", existing ? "UPDATE" : "CREATE", asset, tag, name);
}

async function ensureHousingProperty(row: Row) {
  const code = value(row, "propertyCode", "Property Code", "property", "Property", "site", "Site") || "FBC";
  const name = value(row, "propertyName", "Property Name", "siteName", "Site Name") || (code === "FBC" ? "Fadhili Base Camp" : code);
  return prisma.housingProperty.upsert({
    where: { code },
    update: {
      name,
      site: value(row, "site", "Site") || name,
      city: value(row, "city", "City") || "Fadhili",
      manager: value(row, "manager", "Manager") || "Housing Operations",
      active: true,
    },
    create: {
      code,
      name,
      site: value(row, "site", "Site") || name,
      city: value(row, "city", "City") || "Fadhili",
      manager: value(row, "manager", "Manager") || "Housing Operations",
      active: true,
    },
  });
}

async function ensureHousingBlock(row: Row, propertyId: string, propertyCode: string) {
  const code = value(row, "blockCode", "Block Code", "buildingNumber", "Building Number", "building", "Building") || `${propertyCode}-BLOCK`;
  const name = value(row, "blockName", "Block Name", "buildingName", "Building Name", "building", "Building") || code;
  return prisma.housingBlock.upsert({
    where: { code },
    update: {
      name,
      propertyId,
      floors: Math.max(1, integer(value(row, "floors", "Floors", "floorNumber", "Floor Number"), 1)),
    },
    create: {
      code,
      name,
      propertyId,
      floors: Math.max(1, integer(value(row, "floors", "Floors", "floorNumber", "Floor Number"), 1)),
    },
  });
}

async function ensureHousingBeds(roomId: string, roomCode: string, capacity: number) {
  const target = Math.max(1, capacity);
  const existing = await prisma.housingBed.findMany({ where: { roomId }, orderBy: { label: "asc" } });
  for (let index = existing.length + 1; index <= target; index += 1) {
    const code = `${roomCode}-B${index}`;
    await prisma.housingBed.upsert({
      where: { code },
      update: { roomId, label: `Bed ${index}` },
      create: { code, roomId, label: `Bed ${index}`, status: "AVAILABLE" },
    });
  }
}

async function refreshHousingPropertyRoomCount(propertyId: string) {
  const totalRooms = await prisma.housingRoom.count({ where: { propertyId } });
  await prisma.housingProperty.update({ where: { id: propertyId }, data: { totalRooms } });
}

async function refreshHousingRoomFromBookings(roomId: string) {
  const room = await prisma.housingRoom.findUnique({ where: { id: roomId } });
  if (!room) return;
  if (["MAINTENANCE", "BLOCKED"].includes(room.status)) return;
  const activeBookings = await prisma.housingBooking.count({ where: { roomId, status: "CHECKED_IN" } });
  const reservedBookings = await prisma.housingBooking.count({ where: { roomId, status: "APPROVED" } });
  const occupancy = Math.min(room.capacity, activeBookings);
  const status = occupancy > 0 ? "OCCUPIED" : reservedBookings > 0 ? "RESERVED" : "AVAILABLE";
  await prisma.housingRoom.update({ where: { id: roomId }, data: { occupancy, status } });
}

async function importHousingRoom(row: Row, context: ImportContext = {}) {
  const code = required(row, "roomCode", "Room Code", "code", "Room", "roomNumber", "Room Number");
  const existing = await prisma.housingRoom.findUnique({ where: { code } });
  if (existing && !shouldReplace(context)) return existingResult("housing_room", existing, code, existing.roomNumber);

  const property = await ensureHousingProperty(row);
  const block = await ensureHousingBlock(row, property.id, property.code);
  const capacity = Math.max(1, integer(value(row, "capacity", "Capacity"), 1));
  const floor = value(row, "floor", "floorNumber", "Floor", "Floor Number") || "Ground";
  const payload = {
    roomNumber: value(row, "roomNumber", "Room Number", "Room") || code,
    propertyId: property.id,
    blockId: block.id,
    floor,
    roomType: value(row, "roomType", "Room Type", "type") || "Standard",
    genderRestriction: value(row, "genderRestriction", "Gender Restriction") || "MIXED",
    capacity,
    status: housingRoomStatus(value(row, "status", "Status")),
    qrCode: value(row, "qrCode", "QR Code") || `HOUSING-ROOM:${code}`,
    remarks: value(row, "remarks", "Remarks", "sourceDescription", "Source Description") || null,
  };
  const room = await prisma.housingRoom.upsert({
    where: { code },
    update: payload,
    create: { code, ...payload },
  });
  await ensureHousingBeds(room.id, code, capacity);
  await refreshHousingPropertyRoomCount(property.id);
  await prisma.housingHistory.create({
    data: {
      entity: "room",
      entityId: room.id,
      roomId: room.id,
      actor: "Bulk Upload",
      action: existing ? "Housing room bulk updated" : "Housing room bulk imported",
      details: `${code} / ${room.roomNumber}`,
    },
  });
  return importResult("housing_room", existing ? "UPDATE" : "CREATE", room, code, room.roomNumber);
}

async function importHousingGuest(row: Row, context: ImportContext = {}) {
  const residentNo = required(row, "residentNo", "Resident No", "guestId", "Guest ID", "Budge No.", "Badge No.", "code");
  const existing = await prisma.housingResident.findUnique({ where: { residentNo } });
  if (existing && !shouldReplace(context)) return existingResult("housing_guest", existing, residentNo, existing.name);
  const submittedDepartment = value(row, "departmentCode", "Department Code", "department");
  const linkedDepartmentCode = existing?.departmentCode || await findHousingResidentDepartmentBackup(residentNo, existing?.id);
  const payload = {
    name: value(row, "name", "guestName", "Guest Name", "residentName", "Resident Name") || residentNo,
    email: value(row, "email", "Email") || null,
    phone: value(row, "phone", "Phone", "contactNumber", "Contact Number") || null,
    companyId: value(row, "companyId", "Company ID") || null,
    companyName: value(row, "companyName", "Company Name") || null,
    gender: value(row, "gender", "Gender") || null,
    nationality: value(row, "nationality", "Nationality") || null,
    departmentCode: preservedHousingDepartment(submittedDepartment, linkedDepartmentCode) || null,
    status: value(row, "status", "Status") || "ACTIVE",
  };
  const guest = await prisma.housingResident.upsert({
    where: { residentNo },
    update: payload,
    create: { residentNo, ...payload },
  });
  if (existing && !cleanHousingDepartment(submittedDepartment) && cleanHousingDepartment(linkedDepartmentCode)) {
    await prisma.housingHistory.create({
      data: {
        entity: "resident",
        entityId: guest.id,
        actor: "Bulk Upload",
        action: "Guest department backup kept",
        details: `Incoming bulk department was blank. Backup department retained: ${linkedDepartmentCode}`,
      },
    });
  }
  return importResult("housing_guest", existing ? "UPDATE" : "CREATE", guest, residentNo, guest.name);
}

async function importHousingOccupancy(row: Row, context: ImportContext = {}) {
  const bookingNo = required(row, "bookingNo", "Booking No", "reservationNumber", "Reservation Number", "Confirmation Number", "code");
  const existing = await prisma.housingBooking.findUnique({ where: { bookingNo } });
  if (existing && !shouldReplace(context)) return existingResult("housing_booking", existing, bookingNo, existing.residentName);

  const room = await housingRoomForOccupancy(row);
  const residentNo = value(row, "residentNo", "Resident No", "guestId", "Guest ID", "Agreement/ Budge No.", "Budge No.", "Badge No.");
  const resident = residentNo ? await findOrCreateHousingResident(row, residentNo) : null;
  const checkIn = optionalDate(value(row, "checkIn", "Check-In Date", "Arrival Date", "arrivalDate")) || new Date();
  const checkOut = optionalDate(value(row, "checkOut", "Check-Out Date", "Departure Date", "departureDate")) || undefined;
  const status = housingBookingStatus(value(row, "bookingStatus", "occupancyStatus", "sourceStatus", "Status"));
  const residentName = value(row, "residentName", "guestName", "Guest Name", "Resident Name") || resident?.name || residentNo || "Guest";
  const submittedDepartment = value(row, "departmentCode", "Department Code");
  const payload = {
    residentId: resident?.id,
    residentName,
    departmentCode: preservedHousingDepartment(
      submittedDepartment,
      resident?.departmentCode,
      existing?.departmentCode,
      value(row, "bookingType", "Booking Type").toUpperCase() === "PERMANENT",
    ) || null,
    employeeId: residentNo || null,
    companyName: value(row, "companyName", "Company Name") || resident?.companyName || null,
    nationality: value(row, "nationality", "Nationality") || resident?.nationality || null,
    contactNumber: value(row, "contactNumber", "phone", "Phone") || resident?.phone || null,
    gender: value(row, "gender", "Gender") || resident?.gender || null,
    buildingNumber: value(row, "buildingNumber", "Building Number") || room.block?.name || room.property.name,
    floorNumber: value(row, "floorNumber", "Floor Number", "floor") || room.floor,
    roomNumber: value(row, "roomNumber", "Room Number", "scheduledRoom", "Scheduled Room") || room.roomNumber,
    bedNumber: value(row, "bedNumber", "Bed Number") || null,
    bookingType: value(row, "bookingType", "Booking Type") || "TEMPORARY",
    allocationType: value(row, "allocationType", "Allocation Type") || value(row, "ratePlan", "Rate Plan") || "STANDARD",
    roomId: room.id,
    checkIn,
    checkOut,
    status,
    priority: priority(value(row, "priority", "Priority")),
    requestedBy: value(row, "requestedBy", "Requested By") || "Bulk Upload",
    notes: [value(row, "notes", "Notes"), value(row, "sourceStatus", "Source Status") ? `Source status: ${value(row, "sourceStatus", "Source Status")}` : ""].filter(Boolean).join("\n") || null,
  };
  const booking = await prisma.housingBooking.upsert({
    where: { bookingNo },
    update: payload,
    create: { bookingNo, ...payload },
  });
  if (resident?.id && payload.departmentCode && !cleanHousingDepartment(resident.departmentCode)) {
    await prisma.housingResident.update({
      where: { id: resident.id },
      data: { departmentCode: payload.departmentCode },
    });
    await prisma.housingHistory.create({
      data: {
        entity: "resident",
        entityId: resident.id,
        bookingId: booking.id,
        actor: "Bulk Upload",
        action: "Guest department restored from booking",
        details: `Backup recovered from booking ${booking.bookingNo}. Department: ${payload.departmentCode}`,
      },
    });
  }
  await refreshHousingRoomFromBookings(room.id);
  await prisma.housingHistory.create({
    data: {
      entity: "booking",
      entityId: booking.id,
      bookingId: booking.id,
      roomId: room.id,
      actor: "Bulk Upload",
      action: existing ? "Housing occupancy bulk updated" : "Housing occupancy bulk imported",
      details: `${bookingNo} / ${residentName} / ${room.code}`,
    },
  });
  return importResult("housing_booking", existing ? "UPDATE" : "CREATE", booking, bookingNo, residentName);
}

async function housingRoomForOccupancy(row: Row) {
  const requestedCode = value(row, "roomCode", "Room Code", "roomNumber", "Room Number", "Room");
  const fallbackCode = value(row, "scheduledRoom", "Scheduled Room") || "UNASSIGNED-HOUSING";
  const code = requestedCode || fallbackCode;
  const existing = await prisma.housingRoom.findUnique({ where: { code }, include: { property: true, block: true } });
  if (existing) return existing;

  const property = await ensureHousingProperty(row);
  const block = await ensureHousingBlock(row, property.id, property.code);
  const capacity = Math.max(1, integer(value(row, "capacity", "Capacity"), 1));
  const room = await prisma.housingRoom.upsert({
    where: { code },
    update: {},
    create: {
      code,
      roomNumber: requestedCode || value(row, "roomNumber", "Room Number", "scheduledRoom", "Scheduled Room") || code,
      propertyId: property.id,
      blockId: block.id,
      floor: value(row, "floorNumber", "Floor Number", "floor") || "Ground",
      roomType: value(row, "roomType", "Room Type") || "Standard",
      genderRestriction: "MIXED",
      capacity,
      status: "AVAILABLE",
      qrCode: `HOUSING-ROOM:${code}`,
      remarks: requestedCode ? "Created automatically from occupancy bulk upload" : "Placeholder for occupancy rows without a room in the source file",
    },
    include: { property: true, block: true },
  });
  await ensureHousingBeds(room.id, code, capacity);
  await refreshHousingPropertyRoomCount(property.id);
  return room;
}

async function findHousingResidentDepartmentBackup(residentNo?: string | null, residentId?: string | null) {
  if (!residentNo && !residentId) return "";
  const bookings = await prisma.housingBooking.findMany({
    where: {
      OR: [
        ...(residentId ? [{ residentId }] : []),
        ...(residentNo ? [{ employeeId: residentNo }] : []),
      ],
      departmentCode: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { departmentCode: true },
  });
  return bookings.map((booking) => cleanHousingDepartment(booking.departmentCode)).find(Boolean) || "";
}

async function findOrCreateHousingResident(row: Row, residentNo: string) {
  const existing = await prisma.housingResident.findUnique({ where: { residentNo } });
  if (existing) return existing;
  return prisma.housingResident.create({
    data: {
      residentNo,
      name: value(row, "residentName", "guestName", "Guest Name", "Resident Name") || residentNo,
      email: value(row, "email", "Email") || null,
      phone: value(row, "phone", "Phone", "contactNumber", "Contact Number") || null,
      companyId: value(row, "companyId", "Company ID") || null,
      companyName: value(row, "companyName", "Company Name") || null,
      gender: value(row, "gender", "Gender") || null,
      nationality: value(row, "nationality", "Nationality") || null,
      departmentCode: preservedHousingDepartment(value(row, "departmentCode", "Department Code")) || null,
      status: "ACTIVE",
    },
  });
}

function housingRoomStatus(input: string | undefined) {
  const normalized = String(input || "AVAILABLE").trim().toUpperCase().replace(/[-_]+/g, " ");
  if (["OCCUPIED", "ON HOUSE", "IN HOUSE", "CHECKED IN"].includes(normalized)) return "OCCUPIED" as const;
  if (["RESERVED", "RESERVE", "HOLD", "HELD", "BOOKED"].includes(normalized)) return "RESERVED" as const;
  if (["MAINTENANCE", "UNDER MAINTENANCE"].includes(normalized)) return "MAINTENANCE" as const;
  if (["BLOCKED", "BLOCK"].includes(normalized)) return "BLOCKED" as const;
  return "AVAILABLE" as const;
}

function housingBookingStatus(input: string | undefined) {
  const normalized = String(input || "REQUESTED").trim().toUpperCase().replace(/[-_]+/g, " ");
  if (["ON HOUSE", "IN HOUSE", "CHECKED IN", "CHECK IN"].includes(normalized)) return "CHECKED_IN" as const;
  if (["CHECK OUT", "CHECKED OUT", "DEPARTED"].includes(normalized)) return "CHECKED_OUT" as const;
  if (["NO SHOW", "NOSHOW"].includes(normalized)) return "NO_SHOW" as const;
  if (["CANCEL", "CANCELLED", "CANCELED"].includes(normalized)) return "CANCELLED" as const;
  if (["RESERVED", "RESERVE", "APPROVED"].includes(normalized)) return "APPROVED" as const;
  if (["PENDING", "PENDING APPROVAL"].includes(normalized)) return "PENDING_APPROVAL" as const;
  if (["REJECTED", "TRANSFERRED", "REQUESTED"].includes(normalized)) return normalized.replace(/ /g, "_") as "REJECTED" | "TRANSFERRED" | "REQUESTED";
  return "REQUESTED" as const;
}
async function importHousingAsset(row: Row, context: ImportContext = {}) {
  const tag = value(row, "tag", "code", "Asset Code", "Housing Asset Code", "assetCode");
  if (!tag) throw new Error("Asset Code is required");
  const existing = await prisma.housingAsset.findUnique({ where: { tag } });
  if (existing && !shouldReplace(context)) return existingResult("housing_asset", existing, tag, existing.name);

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
  return importResult("housing_asset", existing ? "UPDATE" : "CREATE", asset, tag, asset.name);
}

async function importInventory(row: Row, context: ImportContext = {}) {
  const sku = required(row, "sku");
  const existing = await prisma.inventoryItem.findUnique({ where: { sku } });
  if (existing && !shouldReplace(context)) return existingResult("inventory_item", existing, sku, existing.name);
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
  return importResult("inventory_item", existing ? "UPDATE" : "CREATE", item, sku, item.name);
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

async function importWorkOrder(row: Row, context: ImportContext = {}) {
  const count = await prisma.workOrder.count();
  const asset = row.assetTag ? await prisma.asset.findUnique({ where: { tag: row.assetTag } }) : null;
  const woNo = row.woNo || `WO-${String(count + 81001).padStart(5, "0")}`;
  const existing = await prisma.workOrder.findUnique({ where: { woNo } });
  if (existing && !shouldReplace(context)) return existingResult("work_order", existing, woNo, existing.title);
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
  return importResult("work_order", existing ? "UPDATE" : "CREATE", workOrder, workOrder.woNo, workOrder.title);
}


async function importCommentHistory(row: Row, context: ImportContext = {}) {
  const woNo = required(row, "woNo", "workOrder", "Work Order", "add_code", "ACK_EVENT");
  const commentText = required(row, "commentText", "comment", "add_text", "Work Notes");
  const sourceFile = value(row, "sourceFile", "SOURCE_FILE") || "Comment History";
  const sourceRowValue = integer(value(row, "sourceRow", "SOURCE_ROW"), 0);
  const sourceLine = value(row, "sourceLine", "add_line") || "";
  const uploadKey = value(row, "uploadKey", "UPLOAD_KEY") || [sourceFile, sourceRowValue, woNo, sourceLine, commentText].join("|").slice(0, 500);
  const existing = await prisma.commentHistory.findUnique({ where: { uploadKey } });
  if (existing && !shouldReplace(context)) return existingResult("comment_history", existing, uploadKey, commentText.slice(0, 120));

  const workOrder = await prisma.workOrder.findUnique({ where: { woNo } });
  const sourceYear = value(row, "sourceYear", "SOURCE_YEAR") || (sourceFile.match(/20\d{2}/)?.[0] ?? "");
  const data = {
    sourceYear,
    sourceFile,
    sourceRow: sourceRowValue || null,
    woNo,
    commentText,
    commentedAt: optionalDate(value(row, "commentedAt", "add_created", "createdAt")),
    commentedBy: value(row, "commentedBy", "usr_desc_cre", "add_user") || "Bulk Upload",
    sourceLine,
    sourceUserCode: value(row, "sourceUserCode", "usr_code_cre", "add_user") || "",
    sourceUpdateUserCode: value(row, "sourceUpdateUserCode", "usr_code_upd", "add_upduser") || "",
    addEntity: value(row, "add_entity") || "",
    addType: value(row, "add_type") || "",
    addLanguage: value(row, "add_lang") || "",
    addPrint: value(row, "add_print") || "",
    updatedAtSource: optionalDate(value(row, "add_updated", "updatedAt")),
    updateCount: integer(value(row, "add_updatecount"), 0) || null,
    systemWorkOrderMatch: Boolean(workOrder),
    linkStatus: workOrder ? "LINKED" : "WORK_ORDER_NOT_FOUND",
    workOrderId: workOrder?.id,
  };

  const comment = await prisma.commentHistory.upsert({
    where: { uploadKey },
    update: data,
    create: { uploadKey, ...data },
  });
  return importResult("comment_history", existing ? "UPDATE" : "CREATE", comment, uploadKey, commentText.slice(0, 120));
}
async function importWorkOrderComment(row: Row) {
  const woNo = required(row, "woNo", "workOrder", "Work Order", "add_code");
  const commentText = required(row, "commentText", "comment", "add_text", "Work Notes");
  const workOrder = await prisma.workOrder.findUnique({ where: { woNo } });
  if (!workOrder) throw new Error(`Work order not found for comment: ${woNo}`);

  const commentedAt = value(row, "commentedAt", "add_created", "createdAt");
  const commentedBy = value(row, "commentedBy", "usr_desc_cre", "add_user") || "Bulk Upload";
  const sourceLine = value(row, "sourceLine", "add_line");
  const sourceStamp = [commentedAt, commentedBy, sourceLine ? `Line ${sourceLine}` : ""].filter(Boolean).join(" / ");
  const formattedComment = sourceStamp ? `[${sourceStamp}] ${commentText}` : commentText;
  const existingNotes = workOrder.workNotes || "";

  if (existingNotes.includes(commentText) || existingNotes.includes(formattedComment)) {
    return existingResult("work_order_comment", workOrder, woNo, commentText.slice(0, 120));
  }

  const updated = await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: { workNotes: existingNotes ? `${existingNotes}\n${formattedComment}` : formattedComment },
  });
  return importResult("work_order_comment", "UPDATE", updated, woNo, commentText.slice(0, 120));
}

async function importTeam(row: Row, context: ImportContext = {}) {
  const code = row.departmentCode || required(row, "code");
  const existing = await prisma.team.findUnique({ where: { code } });
  if (existing && !shouldReplace(context)) return existingResult("team", existing, code, existing.name);
  const team = await prisma.team.upsert({
    where: { code },
    update: teamPayload(row),
    create: { code, ...teamPayload(row) },
  });
  return importResult("team", existing ? "UPDATE" : "CREATE", team, code, team.name);
}

async function importDepartment(row: Row, context: ImportContext = {}) {
  const code = required(row, "code");
  const existing = await prisma.department.findUnique({ where: { code } });
  if (existing && !shouldReplace(context)) return existingResult("department", existing, code, existing.name);
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
  return importResult("department", existing ? "UPDATE" : "CREATE", department, code, department.name);
}

async function importEmployee(row: Row, context: ImportContext = {}) {
  const companyId = required(row, "companyId");
  const existing = await prisma.employee.findUnique({ where: { companyId } });
  if (existing && !shouldReplace(context)) return existingResult("employee", existing, companyId, existing.name);
  const employee = await prisma.employee.upsert({
    where: { companyId },
    update: employeePayload(row),
    create: { companyId, ...employeePayload(row) },
  });
  return importResult("employee", existing ? "UPDATE" : "CREATE", employee, companyId, employee.name);
}

async function importService(row: Row, context: ImportContext = {}) {
  const teamCode = value(row, "teamCode", "Team Code", "assignedTeamCode");
  const team = teamCode ? await prisma.team.findUnique({ where: { code: teamCode } }) : null;
  const code = serviceImportCode(row);
  const existing = await prisma.serviceCatalog.findUnique({ where: { code } });
  if (existing && !shouldReplace(context)) return existingResult("service_catalog", existing, code, existing.name);
  const service = await prisma.serviceCatalog.upsert({
    where: { code },
    update: servicePayload(row, team?.id),
    create: { code, ...servicePayload(row, team?.id) },
  });
  return importResult("service_catalog", existing ? "UPDATE" : "CREATE", service, code, service.name);
}

async function importCategory(row: Row, context: ImportContext = {}) {
  const code = required(row, "code");
  const existing = await prisma.assetCategory.findUnique({ where: { code } });
  if (existing && !shouldReplace(context)) return existingResult("asset_category", existing, code, existing.name);
  const category = await prisma.assetCategory.upsert({
    where: { code },
    update: categoryPayload(row),
    create: { code, ...categoryPayload(row) },
  });
  return importResult("asset_category", existing ? "UPDATE" : "CREATE", category, code, category.name);
}

async function importInspection(row: Row, context: ImportContext = {}) {
  const count = await prisma.inspection.count();
  const code = row.code || `INS-${String(count + 1001).padStart(5, "0")}`;
  const existing = await prisma.inspection.findUnique({ where: { code } });
  if (existing && !shouldReplace(context)) return existingResult("inspection", existing, code, existing.title);
  const payload = {
    title: required(row, "title", "Description", "Case Description"),
    area: value(row, "area", "Location", "location") || "General",
    inspector: value(row, "inspector", "Created By", "createdBy", "add_user") || "Bulk Upload",
    risk: risk(value(row, "risk", "Priority")),
    score: integer(value(row, "score"), 85),
    status: workStatus(value(row, "status", "Status"), "NEW"),
    dueAt: date(value(row, "dueAt", "Date Created", "dateCreated", "requestedAt"), addDays(new Date(), 7)),
    findings: value(row, "findings", "Type", "type", "Case Type") || "Customer Complaint",
  };
  const inspection = await prisma.inspection.upsert({
    where: { code },
    update: payload,
    create: { code, ...payload },
  });
  return importResult("inspection", existing ? "UPDATE" : "CREATE", inspection, inspection.code, inspection.title);
}

async function importLocation(row: Row, context: ImportContext = {}) {
  const code = required(row, "code", "Location");
  const existing = await prisma.location.findUnique({ where: { code } });
  if (existing && !shouldReplace(context)) return existingResult("location", existing, code, existing.description || code);
  const location = await prisma.location.upsert({
    where: { code },
    update: locationPayload(row),
    create: { code, ...locationPayload(row) },
  });
  return importResult("location", existing ? "UPDATE" : "CREATE", location, code, location.description || code);
}

async function importJobPlan(row: Row, context: ImportContext = {}) {
  const code = required(row, "code");
  const existing = await prisma.jobPlan.findUnique({ where: { code } });
  if (existing && !shouldReplace(context)) return existingResult("job_plan", existing, code, existing.name);
  const jobPlan = await prisma.jobPlan.upsert({
    where: { code },
    update: jobPlanPayload(row),
    create: { code, ...jobPlanPayload(row) },
  });
  return importResult("job_plan", existing ? "UPDATE" : "CREATE", jobPlan, code, jobPlan.name);
}

async function importPpm(row: Row, context: ImportContext = {}) {
  const baseCode = required(row, "code", "PPM CODE", "ppmCode");
  const ppmCode = value(row, "ppmCode", "PPM CODE") || baseCode;
  const canUseCustomLocation = allowsCustomPpmLocation(ppmCode) || allowsCustomPpmLocation(baseCode);
  const rawAssetTag = value(row, "assetTag", "asset", "assetCode", "EQUIPMENTNO", "OBJECT (ASSET/LOCATION)");
  const rawLocationCode = value(row, "locationCode", "location", "Location", "LOCATION", "OBJECTS LOCATIONS");
  const assetTag = rawAssetTag && !rawAssetTag.startsWith("L-") ? rawAssetTag : "";
  const inputLocationCode = rawLocationCode || (rawAssetTag.startsWith("L-") ? rawAssetTag : "");
  const asset = assetTag ? await prisma.asset.findUnique({ where: { tag: assetTag } }) : null;
  const fallbackCustomLocation = canUseCustomLocation ? rawAssetTag || rawLocationCode || ppmCode : "";
  const locationCode = inputLocationCode || asset?.locationCode || fallbackCustomLocation || "";
  const location = locationCode ? await prisma.location.findUnique({ where: { code: locationCode } }) : null;

  if (assetTag && !asset && !canUseCustomLocation) throw new Error(`Asset not found for PPM: ${assetTag}`);
  if (locationCode && !location && !asset?.locationCode && !canUseCustomLocation) throw new Error(`Location not found for PPM: ${locationCode}`);
  if (!assetTag && !locationCode && !canUseCustomLocation) throw new Error("assetTag or locationCode is required");

  const targetKey = assetTag || locationCode || ppmCode;
  const code = value(row, "uniqueCode") || uniquePpmCode(baseCode, targetKey);
  const existing = await prisma.preventiveMaintenance.findUnique({ where: { code } });
  const periodUom = value(row, "periodUom", "PERIOD UOM", "Period UOM", "period", "PERIOD") || "";
  const workflowStatus = value(row, "workflowStatus", "WORKFLOW STATUS", "PPM STATUS").toUpperCase().replace(/[ -]/g, "_");
  const workflowStatusValue = ["DRAFT", "SCHEDULED", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "SUBMITTED", "REWORK", "COMPLETED", "CLOSED", "OVERDUE", "CANCELLED"].includes(workflowStatus) ? workflowStatus : undefined;
  const assignedTeamCode = value(row, "assignedTeamCode", "TEAM", "TEAM CODE", "ASSIGNED TEAM");
  const technicianEmail = value(row, "technicianEmail", "TECHNICIAN", "TECHNICIAN EMAIL");
  const supervisorEmail = value(row, "supervisorEmail", "SUPERVISOR", "SUPERVISOR EMAIL");
  if (existing && !shouldReplace(context) && !canUseCustomLocation) {
    const existingUpdate = Object.fromEntries(Object.entries({
      periodUom: periodUom && existing.periodUom !== periodUom ? periodUom : undefined,
      workflowStatus: workflowStatusValue as any,
      assignedTeamCode: assignedTeamCode || undefined,
      technicianEmail: technicianEmail || undefined,
      supervisorEmail: supervisorEmail || undefined,
    }).filter(([, next]) => next !== undefined));
    if (Object.keys(existingUpdate).length) {
      const updated = await prisma.preventiveMaintenance.update({ where: { code }, data: existingUpdate });
      return importResult("preventive_maintenance", "UPDATE", updated, code, updated.name);
    }
    return existingResult("preventive_maintenance", existing, code, existing.name);
  }
  const nextDue = optionalDate(value(row, "nextDue", "DUE DATE", "dueAt")) || addDays(new Date(), 7);
  const activeValue = value(row, "active");
  const data = {
    ppmCode,
    name: value(row, "name", "PPM DESCRIPTION", "description") || baseCode,
    assetTag: assetTag || "",
    locationCode,
    equipmentDescription: value(row, "equipmentDescription", "OBJECT (ASSET/LOCATION) DESCRIPTION") || asset?.assetDescription || asset?.name || "",
    objectType: value(row, "objectType", "OBJECT TYPE") || (assetTag ? "Asset" : "Location"),
    objectClass: value(row, "objectClass", "OBJECT CLASS") || asset?.classCode || "",
    objectCategory: value(row, "objectCategory", "OBJECT CATEGORY") || asset?.category || "",
    checklistLink: value(row, "checklistLink", "ACTIVITY CHECKLIST") || "",
    departmentCode: value(row, "departmentCode", "DEPARTMENT", "DEPARTMENT ") || asset?.departmentCode || "",
    priority: priority(value(row, "priority", "OBJECT CRITICALITY")),
    frequency: value(row, "frequency", "FREQUENCY") || "Monthly",
    periodUom,
    nextDue,
    durationHrs: number(value(row, "durationHrs", "duration", "PPA_DURATION"), 2),
    checklist: ppmChecklistValue(row),
    active: activeValue ? yesNo(activeValue, true) : true,
    workflowStatus: (workflowStatusValue || "DRAFT") as any,
    assignedTeamCode,
    technicianEmail,
    supervisorEmail,
    checklistMandatory: true,
  };
  const ppm = await prisma.preventiveMaintenance.upsert({
    where: { code },
    update: data,
    create: { code, ...data },
  });
  return importResult("preventive_maintenance", existing ? "UPDATE" : "CREATE", ppm, code, data.name);
}

async function importPpmChecklistHistory(row: Row, context: ImportContext = {}) {
  const ackEvent = required(row, "ACK_EVENT", "ackEvent");
  const ackCode = required(row, "ACK_CODE", "ackCode");
  const ackDescription = required(row, "ACK_DESC", "ackDescription", "description");
  const ackObject = value(row, "ACK_OBJECT", "ackObject", "assetTag", "equipmentNo");
  const ackAct = value(row, "ACK_ACT", "ackAct");
  const ackSequence = value(row, "ACK_SEQUENCE", "ackSequence");
  const uploadKey = value(row, "UPLOAD_KEY", "uploadKey") || [ackEvent, ackObject, ackCode, ackAct, ackSequence, ackDescription].join("|").slice(0, 500);

  const [workOrder, asset, ppm] = await Promise.all([
    prisma.workOrder.findFirst({
      where: { OR: [{ woNo: ackEvent }, { woNo: `WO-${ackEvent}` }, { woNo: { endsWith: ackEvent } }] },
      select: { id: true, woNo: true },
    }),
    ackObject ? prisma.asset.findUnique({ where: { tag: ackObject }, select: { id: true, tag: true } }) : null,
    ackCode ? prisma.preventiveMaintenance.findFirst({
      where: { OR: [{ ppmCode: ackCode }, { code: ackCode }, { code: { startsWith: `${ackCode}-` } }] },
      select: { id: true, code: true, ppmCode: true },
    }) : null,
  ]);

  const computedLinkStatus = [
    workOrder ? "" : "MISSING_WORK_ORDER",
    ackObject && !asset ? "MISSING_ASSET" : "",
    ppm ? "" : "NO_MATCH_PPM_CODE",
  ].filter(Boolean).join("; ") || "LINKED";
  const linkStatus = value(row, "LINK_STATUS", "linkStatus") || computedLinkStatus;

  const data = {
    sourceYear: value(row, "SOURCE_YEAR", "sourceYear"),
    sourceFile: value(row, "SOURCE_FILE", "sourceFile"),
    ackEvent,
    eventCreated: optionalDate(value(row, "EVT_CREATED", "eventCreated")),
    eventDescription: value(row, "EVT_DESC", "eventDescription"),
    ackObject,
    ackType: value(row, "ACK_TYPE", "ackType"),
    ackCode,
    ackAct,
    ackSequence,
    ackDescription,
    ackNotes: value(row, "ACK_NOTES", "ackNotes"),
    ackUpdated: optionalDate(value(row, "ACK_UPDATED", "ackUpdated")),
    ackUpdatedBy: value(row, "ACK_UPDATEDBY", "ackUpdatedBy"),
    ackUpdateCount: numberOrNull(value(row, "ACK_UPDATECOUNT", "ackUpdateCount")),
    ackObjectOrg: value(row, "ACK_OBJECT_ORG", "ackObjectOrg"),
    ackYes: value(row, "ACK_YES", "ackYes"),
    ackNo: value(row, "ACK_NO", "ackNo"),
    ackFinding: value(row, "ACK_FINDING", "ackFinding"),
    ackValue: value(row, "ACK_VALUE", "ackValue"),
    ackUom: value(row, "ACK_UOM", "ackUom"),
    ackFollowup: value(row, "ACK_FOLLOWUP", "ackFollowup"),
    ackFollowupEvent: value(row, "ACK_FOLLOWUPEVENT", "ackFollowupEvent"),
    ackLastSaved: optionalDate(value(row, "ACK_LASTSAVED", "ackLastSaved")),
    systemWorkOrderMatch: Boolean(workOrder) || yesNo(value(row, "SYSTEM_WORK_ORDER_MATCH", "systemWorkOrderMatch"), false),
    systemAssetMatch: Boolean(asset) || yesNo(value(row, "SYSTEM_ASSET_MATCH", "systemAssetMatch"), false),
    systemPpmMatch: Boolean(ppm) || yesNo(value(row, "SYSTEM_PPM_MATCH", "systemPpmMatch"), false),
    linkStatus,
    workOrderId: workOrder?.id || null,
    assetId: asset?.id || null,
    ppmId: ppm?.id || null,
  };

  const existing = await prisma.ppmChecklistHistory.findUnique({ where: { uploadKey } });
  if (existing && !shouldReplace(context)) return existingResult("ppm_checklist_history", existing, uploadKey, ackDescription);
  const record = await prisma.ppmChecklistHistory.upsert({
    where: { uploadKey },
    update: data,
    create: { uploadKey, ...data },
  });
  return importResult("ppm_checklist_history", existing ? "UPDATE" : "CREATE", record, uploadKey, ackDescription.slice(0, 120));
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
  return value(row, "UPLOAD_KEY", "uploadKey", "ACK_EVENT", "ackEvent", "ACK_CODE", "ackCode", "tag", "Asset Code", "Housing Asset Code", "EQUIPMENTNO", "ASSET NUMBER", "sku", "ticketNo", "woNo", "commentText", "code", "Location", "locationCode", "assetTag", "companyId", "email") || module || "unknown";
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

function cleanServiceCode(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function serviceImportCode(row: Row) {
  const departmentCode = cleanServiceCode(value(row, "departmentCode", "Department", "Department Code", "sourceSheet", "category"));
  const explicitCode = cleanServiceCode(value(row, "code", "Code"));
  const sourceServiceCode = cleanServiceCode(value(row, "serviceCode", "Service Code", "ServiceCode"));
  const sourceCode = explicitCode || sourceServiceCode;
  if (sourceCode) return sourceCode.startsWith(`${departmentCode}-`) || !departmentCode ? sourceCode : `${departmentCode}-${sourceCode}`;
  return departmentCode || required(row, "code", "serviceCode", "Service Code", "departmentCode");
}

function servicePayload(row: Row, teamId?: string) {
  const departmentCode = cleanServiceCode(value(row, "departmentCode", "Department", "Department Code", "sourceSheet", "category"));
  const sourceServiceCode = cleanServiceCode(value(row, "serviceCode", "Service Code", "ServiceCode"));
  const name = value(row, "name", "Description", "description", "departmentName") || serviceImportCode(row);
  return {
    serviceCode: sourceServiceCode || cleanServiceCode(value(row, "code", "Code")) || serviceImportCode(row),
    name,
    category: departmentCode || value(row, "category") || "General",
    type: value(row, "type") || "Service Code",
    priority: priority(value(row, "priority", "Priority")),
    slaHours: integer(value(row, "slaHours", "SLA Hours", "sla"), 24),
    teamId,
    description: value(row, "description", "Description") || name,
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

  const normalized = new Map(Object.entries(row).map(([key, found]) => [normalizeRowKey(key), found]));
  for (const key of keys) {
    const found = normalized.get(normalizeRowKey(key));
    if (found !== undefined && found !== null && String(found).trim() !== "") return String(found).trim();
  }
  return "";
}

function normalizeRowKey(key: string) {
  return key.replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
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

function isInvalidPpmChecklistValue(value: unknown) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  return !raw ||
    normalized === "no match" ||
    raw.startsWith("=") ||
    normalized.includes("iferror(") ||
    normalized.includes("hyperlink(") ||
    normalized.includes("activities & checklist") ||
    normalized.includes("#n/a") ||
    normalized.includes("#value");
}

function ppmChecklistValue(row: Row) {
  const directChecklist = value(row, "checklist", "steps");
  if (directChecklist && !isInvalidPpmChecklistValue(directChecklist)) return directChecklist;
  const activityChecklist = value(row, "ACTIVITY CHECKLIST");
  if (activityChecklist && !isInvalidPpmChecklistValue(activityChecklist)) return activityChecklist;
  return "No match";
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
  if (["INITIATED", "INITIATE"].includes(normalized)) return "NEW";
  if (["CONFIRMED", "CONFIRM"].includes(normalized)) return "ASSIGNED";
  if (["CANCEL", "CANCELLED", "CANCELED"].includes(normalized)) return "REJECTED";
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


