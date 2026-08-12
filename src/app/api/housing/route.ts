import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { ensureHousingNotificationSettings } from "@/lib/housing-alerts";
import { syncHousingResidentToBookings } from "@/lib/housing-resident-sync";
import { prisma } from "@/lib/prisma";

const activeBookingStatuses = ["REQUESTED", "PENDING_APPROVAL", "APPROVED", "CHECKED_IN"];
const closedBookingStatuses = ["CHECKED_OUT", "REJECTED", "CANCELLED", "NO_SHOW", "TRANSFERRED"];
const activeExtensionStatuses = ["EXTEND_PENDING", "EXTENDED"];
const unavailableRoomStatuses = ["BLOCKED", "MAINTENANCE", "RESERVED", "OCCUPIED", "HOLD", "ON_HOLD"];
const bookingStatuses = ["REQUESTED", "PENDING_APPROVAL", "APPROVED", "CHECKED_IN", "CHECKED_OUT", "REJECTED", "CANCELLED", "NO_SHOW", "TRANSFERRED"];
const bookingApprovalSteps = [
  { step: 1, level: "Housing Coordinator Review", approver: "Housing Coordinator" },
  { step: 2, level: "Housing Supervisor Approval", approver: "Housing Supervisor" },
  { step: 3, level: "Camp Manager Final Approval", approver: "Camp Manager" },
  { step: 4, level: "Reception Allocation", approver: "Reception Team" },
];

class HousingInputError extends Error {
  status = 400;
}

function prismaErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
}

function prismaErrorTargetIncludes(error: unknown, field: string) {
  const target =
    typeof error === "object" && error !== null && "meta" in error
      ? (error as { meta?: { target?: unknown } }).meta?.target
      : undefined;
  const normalizedField = field.toLowerCase();
  if (Array.isArray(target)) {
    return target.some((item) => String(item).toLowerCase() === normalizedField);
  }
  return String(target || "").toLowerCase().includes(normalizedField);
}

function isPrismaError(error: unknown, code: string) {
  return prismaErrorCode(error) === code;
}

function normalizeHousingSaveError(error: unknown) {
  if (error instanceof HousingInputError) return error;
  if (isPrismaError(error, "P2002")) {
    if (prismaErrorTargetIncludes(error, "bookingNo")) {
      return new HousingInputError("Booking number already exists. Save again and the system will generate the next available booking number.");
    }
    if (prismaErrorTargetIncludes(error, "residentNo")) {
      return new HousingInputError("Employee ID already exists in guest profile. Select the existing guest or use a different employee ID.");
    }
    return new HousingInputError("A duplicate housing record already exists. Check the employee, room, bed, and booking details.");
  }
  if (isPrismaError(error, "P2003")) {
    return new HousingInputError("Selected guest, room, or bed is no longer valid. Re-select the employee and available room, then save again.");
  }
  return error;
}

const housingSchema = z.object({
  type: z.string(),
  code: z.string().optional(),
  name: z.string().optional(),
  site: z.string().optional(),
  city: z.string().optional(),
  manager: z.string().optional(),
  propertyId: z.string().optional(),
  blockId: z.string().optional(),
  roomId: z.string().optional(),
  bedId: z.string().optional(),
  roomNumber: z.string().optional(),
  floor: z.string().optional(),
  roomType: z.string().optional(),
  genderRestriction: z.string().optional(),
  capacity: z.coerce.number().int().min(1).optional(),
  status: z.string().optional(),
  residentId: z.string().optional(),
  residentNo: z.string().optional(),
  residentName: z.string().optional(),
  employeeId: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  gender: z.string().optional(),
  nationality: z.string().optional(),
  contactNumber: z.string().optional(),
  departmentCode: z.string().optional(),
  buildingNumber: z.string().optional(),
  floorNumber: z.string().optional(),
  bedNumber: z.string().optional(),
  bookingType: z.string().optional(),
  allocationType: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  priority: z.string().optional(),
  requestedBy: z.string().optional(),
  approvedBy: z.string().optional(),
  approvalLevel: z.string().optional(),
  attachmentUrls: z.string().optional(),
  notes: z.string().optional(),
  remarks: z.string().optional(),
  keyHandoverBy: z.string().optional(),
  keyHandoverAt: z.string().optional(),
  campIdNumber: z.string().optional(),
  campIdIssuedAt: z.string().optional(),
  cancellationReason: z.string().optional(),
  transferReason: z.string().optional(),
  blacklistReason: z.string().optional(),
  noShowAt: z.string().optional(),
  inspectionType: z.string().optional(),
  inspector: z.string().optional(),
  occupantId: z.string().optional(),
  occupantName: z.string().optional(),
  assetId: z.string().optional(),
  workOrderRef: z.string().optional(),
  furnitureCondition: z.string().optional(),
  mattressCondition: z.string().optional(),
  bedSheetCondition: z.string().optional(),
  tvCondition: z.string().optional(),
  refrigeratorCondition: z.string().optional(),
  acCondition: z.string().optional(),
  waterLeakageCheck: z.string().optional(),
  lightingCondition: z.string().optional(),
  curtainCondition: z.string().optional(),
  doorLockCondition: z.string().optional(),
  smokeDetectorCondition: z.string().optional(),
  fireExtinguisherAvailability: z.string().optional(),
  bathroomCleanliness: z.string().optional(),
  generalRoomCleanliness: z.string().optional(),
  missingAssetVerification: z.string().optional(),
  damageFound: z.coerce.boolean().optional(),
  damageReport: z.string().optional(),
  missingAssetFound: z.coerce.boolean().optional(),
  missingAssetReport: z.string().optional(),
  repairRequired: z.coerce.boolean().optional(),
  estimatedRepairCost: z.coerce.number().optional(),
  occupantLiability: z.string().optional(),
  beforePhotoUrls: z.string().optional(),
  afterPhotoUrls: z.string().optional(),
  maintenanceTicketNo: z.string().optional(),
  createMaintenanceTicket: z.coerce.boolean().optional(),
  score: z.coerce.number().int().min(0).max(100).optional(),
  findings: z.string().optional(),
  photoUrls: z.string().optional(),
  dueAt: z.string().optional(),
  completedAt: z.string().optional(),
  tag: z.string().optional(),
  qrCode: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  purchaseDate: z.string().optional(),
  supplierName: z.string().optional(),
  assetValue: z.coerce.number().optional(),
  buildingLocation: z.string().optional(),
  roomLocation: z.string().optional(),
  custodianName: z.string().optional(),
  custodianContact: z.string().optional(),
  issuedTo: z.string().optional(),
  issuedAt: z.string().optional(),
  transferredFrom: z.string().optional(),
  transferredTo: z.string().optional(),
  transferredAt: z.string().optional(),
  replacementOf: z.string().optional(),
  replacedAt: z.string().optional(),
  pmSchedule: z.string().optional(),
  nextPmDue: z.string().optional(),
  depreciationRate: z.coerce.number().optional(),
  currentValue: z.coerce.number().optional(),
  lastInspectionAt: z.string().optional(),
  movementAction: z.string().optional(),
  serialNumber: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  sku: z.string().optional(),
  onHand: z.coerce.number().int().min(0).optional(),
  minimumStock: z.coerce.number().int().min(0).optional(),
  reorderPoint: z.coerce.number().int().min(0).optional(),
  unit: z.string().optional(),
  unitCost: z.coerce.number().optional(),
  storeLocation: z.string().optional(),
  supplierContact: z.string().optional(),
  preferredSupplier: z.string().optional(),
  expiryDate: z.string().optional(),
  movementType: z.string().optional(),
  movementQty: z.coerce.number().int().min(0).optional(),
  movementBy: z.string().optional(),
  transferFrom: z.string().optional(),
  transferTo: z.string().optional(),
  adjustmentReason: z.string().optional(),
  purchaseRequestNo: z.string().optional(),
  purchaseRequestStatus: z.string().optional(),
  generatePurchaseRequest: z.coerce.boolean().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  bookingId: z.string().optional(),
  level: z.string().optional(),
  approver: z.string().optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  recipient: z.string().optional(),
  severity: z.string().optional(),
  alertType: z.string().optional(),
  channel: z.string().optional(),
  role: z.string().optional(),
  channels: z.string().optional(),
  roles: z.string().optional(),
  enabled: z.coerce.boolean().optional(),
  leadDays: z.coerce.number().int().min(0).optional(),
  thresholdDays: z.coerce.number().int().min(0).optional(),
  label: z.string().optional(),
  holdStartDate: z.string().optional(),
  holdEndDate: z.string().optional(),
  reason: z.string().optional(),
  holdStatus: z.string().optional(),
});

export async function GET() {
  const { error } = await requirePermission("housing.view");
  if (error) return error;
  await expireRoomHolds();
  const [
    properties,
    blocks,
    rooms,
    beds,
    residents,
    bookings,
    inspections,
    assets,
    inventory,
    approvals,
    notifications,
    notificationSettings,
    history,
    holds,
  ] = await Promise.all([
    prisma.housingProperty.findMany({ orderBy: { name: "asc" } }),
    prisma.housingBlock.findMany({ include: { property: true }, orderBy: { code: "asc" } }),
    prisma.housingRoom.findMany({ include: { property: true, block: true, beds: true }, orderBy: [{ property: { name: "asc" } }, { roomNumber: "asc" }] }),
    prisma.housingBed.findMany({ include: { room: true }, orderBy: { code: "asc" } }),
    prisma.housingResident.findMany({ orderBy: { name: "asc" } }),
    prisma.housingBooking.findMany({ include: { room: { include: { property: true, block: true } }, bed: true, resident: true, approvals: true }, orderBy: { createdAt: "desc" } }),
    prisma.housingInspection.findMany({ include: { room: { include: { property: true, block: true } } }, orderBy: { dueAt: "asc" } }),
    prisma.housingAsset.findMany({ include: { room: { include: { property: true, block: true } } }, orderBy: { tag: "asc" } }),
    prisma.housingInventory.findMany({ include: { room: { include: { property: true, block: true } } }, orderBy: { sku: "asc" } }),
    prisma.housingApproval.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.housingNotification.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    ensureHousingNotificationSettings(),
    prisma.housingHistory.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.housingRoomHold.findMany({ include: { room: { include: { property: true, block: true } } }, orderBy: [{ status: "asc" }, { startDate: "desc" }] }),
  ]);

  const bookingIndex = indexHousingRows(
    bookings.filter((booking) => bookingKeepsRoomUnavailable(booking)),
    bookingRoomLookupKeys,
  );
  const holdIndex = indexHousingRows(holds, (hold) => [
    hold?.roomId,
    hold?.room?.id,
  ]);
  const normalizedRooms = rooms.map((room) =>
    normalizeRoomAvailabilitySnapshot(
      room,
      collectIndexedHousingRows(bookingIndex, housingRoomLookupKeys(room)),
      collectIndexedHousingRows(holdIndex, [room?.id]),
    ),
  );

  return NextResponse.json({ properties, blocks, rooms: normalizedRooms, beds, residents, bookings, inspections, assets, inventory, approvals, notifications, notificationSettings, history, holds });
}

function addIndexedHousingRow<T>(index: Map<string, T[]>, key: unknown, row: T) {
  const normalizedKey = compactHousingToken(key);
  if (!normalizedKey) return;
  const existing = index.get(normalizedKey);
  if (existing) existing.push(row);
  else index.set(normalizedKey, [row]);
}

function indexHousingRows<T>(
  rows: T[],
  keysForRow: (row: T) => unknown[],
) {
  const index = new Map<string, T[]>();
  rows.forEach((row) => {
    keysForRow(row).forEach((key) => addIndexedHousingRow(index, key, row));
  });
  return index;
}

function collectIndexedHousingRows<T>(index: Map<string, T[]>, keys: unknown[]) {
  const seen = new Set<string>();
  const rows: T[] = [];
  keys.forEach((key) => {
    const indexedRows = index.get(compactHousingToken(key)) || [];
    indexedRows.forEach((row: any) => {
      const rowKey = String(row?.id || row?.bookingNo || row?.code || rows.length);
      if (seen.has(rowKey)) return;
      seen.add(rowKey);
      rows.push(row);
    });
  });
  return rows;
}

function housingRoomLookupKeys(room: any) {
  return [room?.id, room?.code, room?.roomNumber];
}

function bookingRoomLookupKeys(booking: any) {
  return [
    booking?.roomId,
    booking?.room?.id,
    booking?.room?.code,
    booking?.roomCode,
    booking?.roomNumber,
    booking?.room?.roomNumber,
  ];
}

export async function POST(request: Request) {
  try {
    const { error } = await requirePermission("housing.create");
    if (error) return error;
    const input = housingSchema.parse(await request.json());
    const user = await getCurrentUser();
    const actor = user?.name || user?.email || "System";
    const result = await createHousingRecord(input, actor);
    await auditAction({ user, action: `HOUSING_${input.type.toUpperCase()}_CREATE`, entity: `housing_${input.type}`, entityId: result.id, details: { input, createdRecord: result } });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const normalizedError = normalizeHousingSaveError(error);
    const status =
      typeof (normalizedError as { status?: unknown }).status === "number"
        ? (normalizedError as { status: number }).status
        : 500;
    return apiError(normalizedError, "Unable to save housing record", status);
  }
}

async function createHousingRecord(input: z.infer<typeof housingSchema>, actor: string) {
  if (input.type === "property") {
    const count = await prisma.housingProperty.count();
    const code = input.code || `HSP-${String(count + 1).padStart(3, "0")}`;
    return prisma.housingProperty.upsert({
      where: { code },
      update: {
        name: input.name || code,
        site: input.site || "Main Housing Site",
        city: input.city || "Jazan",
        manager: input.manager || actor,
        active: input.status !== "INACTIVE",
      },
      create: {
        code,
        name: input.name || code,
        site: input.site || "Main Housing Site",
        city: input.city || "Jazan",
        manager: input.manager || actor,
      },
    });
  }

  if (input.type === "block") {
    const property = await firstProperty(input.propertyId);
    const count = await prisma.housingBlock.count();
    const code = input.code || `HSB-${String(count + 1).padStart(3, "0")}`;
    return prisma.housingBlock.upsert({
      where: { code },
      update: { name: input.name || code, propertyId: property.id },
      create: { code, name: input.name || code, propertyId: property.id, floors: input.capacity || 1 },
    });
  }

  if (input.type === "room") {
    const property = await firstProperty(input.propertyId);
    const block = input.blockId ? await prisma.housingBlock.findUnique({ where: { id: input.blockId } }) : await prisma.housingBlock.findFirst({ where: { propertyId: property.id } });
    const count = await prisma.housingRoom.count();
    const code = input.code || `HSR-${String(count + 1).padStart(4, "0")}`;
    const capacity = input.capacity || 1;
    const room = await prisma.housingRoom.upsert({
      where: { code },
      update: {
        roomNumber: input.roomNumber || code,
        propertyId: property.id,
        blockId: block?.id,
        floor: input.floor || "Ground",
        roomType: input.roomType || "Standard",
        genderRestriction: input.genderRestriction || "MIXED",
        capacity,
        status: input.status === "MAINTENANCE" ? "MAINTENANCE" : "AVAILABLE",
        qrCode: input.code || `QR:${code}`,
        remarks: input.remarks || input.notes || "",
      },
      create: {
        code,
        roomNumber: input.roomNumber || code,
        propertyId: property.id,
        blockId: block?.id,
        floor: input.floor || "Ground",
        roomType: input.roomType || "Standard",
        genderRestriction: input.genderRestriction || "MIXED",
        capacity,
        qrCode: `QR:${code}`,
        remarks: input.remarks || input.notes || "",
      },
    });
    await ensureBeds(room.id, code, capacity);
    await refreshRoomOccupancy(room.id);
    return prisma.housingRoom.findUniqueOrThrow({ where: { id: room.id }, include: { property: true, block: true, beds: true } });
  }

  if (input.type === "resident") {
    const count = await prisma.housingResident.count();
    const residentNo = input.residentNo || `RES-${String(count + 1).padStart(5, "0")}`;
    const existing = await prisma.housingResident.findUnique({ where: { residentNo } });
    const resident = await prisma.housingResident.upsert({
      where: { residentNo },
      update: residentData(input, residentNo),
      create: residentData(input, residentNo),
    });
    await syncHousingResidentToBookings(prisma, resident, existing);
    return resident;
  }

  if (input.type === "bed") {
    const room = await firstRoom(input.roomId);
    const count = await prisma.housingBed.count({ where: { roomId: room.id } });
    const code = input.code || `${room.code}-B${count + 1}`;
    const bed = await prisma.housingBed.upsert({
      where: { code },
      update: {
        label: input.label || input.name || `Bed ${count + 1}`,
        status: (input.status as any) || "AVAILABLE",
        occupant: input.occupantName || input.residentName || "",
        occupantId: input.occupantId || input.residentId || "",
      },
      create: {
        code,
        label: input.label || input.name || `Bed ${count + 1}`,
        roomId: room.id,
        status: (input.status as any) || "AVAILABLE",
        occupant: input.occupantName || input.residentName || "",
        occupantId: input.occupantId || input.residentId || "",
      },
    });
    await refreshRoomOccupancy(room.id);
    await housingHistory("bed", bed.id, actor, "Bed created / updated", `${room.roomNumber} / ${bed.label}`, { roomId: room.id });
    return bed;
  }

  if (input.type === "booking") {
    return createBooking(input, actor);
  }

  if (input.type === "hold") {
    return createRoomHold(input, actor);
  }

  if (input.type === "inspection") {
    const room = await firstRoom(input.roomId);
    const checklist = inspectionChecklist(input);
    const count = await prisma.housingInspection.count();
    const inspectionNo = input.code || `HIN-${String(count + 1).padStart(5, "0")}`;
    const inspection = await prisma.housingInspection.create({
      data: {
        inspectionNo,
        roomId: room.id,
        bedId: input.bedId || undefined,
        occupantId: input.occupantId || input.residentId || undefined,
        occupantName: input.occupantName || input.residentName || input.name || "",
        assetId: input.assetId || undefined,
        workOrderRef: input.workOrderRef || "",
        inspector: input.inspector || actor,
        inspectionType: input.inspectionType || input.category || "Room Condition",
        status: (input.status as any) || "SCHEDULED",
        score: input.score ?? 100,
        checklistJson: JSON.stringify(checklist),
        ...checklist,
        damageFound: Boolean(input.damageFound),
        damageReport: input.damageReport || "",
        missingAssetFound: Boolean(input.missingAssetFound),
        missingAssetReport: input.missingAssetReport || "",
        repairRequired: Boolean(input.repairRequired || input.createMaintenanceTicket),
        estimatedRepairCost: input.estimatedRepairCost || 0,
        occupantLiability: input.occupantLiability || "",
        beforePhotoUrls: input.beforePhotoUrls || "",
        afterPhotoUrls: input.afterPhotoUrls || "",
        findings: input.findings || input.notes || "",
        photoUrls: input.photoUrls || input.attachmentUrls || [input.beforePhotoUrls, input.afterPhotoUrls].filter(Boolean).join(","),
        dueAt: input.dueAt ? new Date(input.dueAt) : new Date(),
        completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
      },
    });
    await handleInspectionOutputs(inspection, input, room, actor);
    await housingHistory("inspection", inspection.id, actor, "Inspection created", input.findings || input.notes, { roomId: room.id, inspectionId: inspection.id });
    return prisma.housingInspection.findUniqueOrThrow({ where: { id: inspection.id }, include: { room: { include: { property: true, block: true } } } });
  }

  if (input.type === "asset") {
    const room = input.roomId ? await prisma.housingRoom.findUnique({ where: { id: input.roomId } }) : await prisma.housingRoom.findFirst();
    const count = await prisma.housingAsset.count();
    const tag = input.tag || input.code || `HSA-${String(count + 1).padStart(5, "0")}`;
    const assetData = housingAssetData(input, tag, room?.id);
    const asset = await prisma.housingAsset.upsert({
      where: { tag },
      update: assetData,
      create: assetData,
    });
    await handleAssetOutputs(asset, input, room, actor, true);
    return asset;
  }

  if (input.type === "inventory") {
    const room = input.roomId ? await prisma.housingRoom.findUnique({ where: { id: input.roomId } }) : null;
    const count = await prisma.housingInventory.count();
    const sku = input.sku || input.code || `HSI-${String(count + 1).padStart(5, "0")}`;
    const current = await prisma.housingInventory.findUnique({ where: { sku } });
    const stock = inventoryStock(input, current?.onHand ?? input.onHand ?? 0);
    const data = inventoryData(input, sku, room?.id, stock.onHand, actor, stock.movementType, stock.movementQty);
    const item = await prisma.housingInventory.upsert({
      where: { sku },
      update: data,
      create: data,
    });
    await handleInventoryOutputs(item, input, actor, current?.onHand ?? 0, stock.movementType, stock.movementQty);
    return item;
  }

  if (input.type === "approval") {
    const approval = await prisma.housingApproval.create({
      data: {
        entity: input.entity || "booking",
        entityId: input.entityId || input.bookingId || "",
        bookingId: input.bookingId,
        level: input.level || input.approvalLevel || "Supervisor",
        approver: input.approver || actor,
        status: (input.status as any) || "PENDING",
        remarks: input.remarks || input.notes || "",
      },
    });
    return approval;
  }

  if (input.type === "notification") {
    return prisma.housingNotification.create({
      data: {
        alertType: input.alertType || "MANUAL",
        channel: input.channel || "SYSTEM",
        role: input.role || "",
        title: input.title || "Housing Alert",
        message: input.message || input.notes || "Housing notification",
        recipient: input.recipient || actor,
        severity: (input.severity as any) || "MEDIUM",
        status: input.channel && input.channel !== "SYSTEM" ? "QUEUED" : "SENT",
        entity: input.entity,
        entityId: input.entityId,
        sentAt: !input.channel || input.channel === "SYSTEM" ? new Date() : undefined,
        bookingId: input.bookingId,
      },
    });
  }

  if (input.type === "notification-setting") {
    const alertType = input.alertType || input.code || "";
    if (!alertType) throw new Error("Alert type is required.");
    return prisma.housingNotificationSetting.upsert({
      where: { alertType },
      update: {
        label: input.label || input.name || alertType,
        enabled: input.enabled ?? true,
        roles: input.roles || input.role || "Admin,Housing Supervisor",
        channels: input.channels || input.channel || "SYSTEM",
        leadDays: input.leadDays ?? 3,
        thresholdDays: input.thresholdDays ?? 0,
        severity: (input.severity as any) || "MEDIUM",
        description: input.description || input.notes || "",
        updatedBy: actor,
      },
      create: {
        alertType,
        label: input.label || input.name || alertType,
        enabled: input.enabled ?? true,
        roles: input.roles || input.role || "Admin,Housing Supervisor",
        channels: input.channels || input.channel || "SYSTEM",
        leadDays: input.leadDays ?? 3,
        thresholdDays: input.thresholdDays ?? 0,
        severity: (input.severity as any) || "MEDIUM",
        description: input.description || input.notes || "",
        updatedBy: actor,
      },
    });
  }

  throw new Error(`Unsupported housing record type: ${input.type}`);
}

function inspectionChecklist(input: z.infer<typeof housingSchema>) {
  return {
    furnitureCondition: input.furnitureCondition || "Good",
    mattressCondition: input.mattressCondition || "Good",
    bedSheetCondition: input.bedSheetCondition || "Good",
    tvCondition: input.tvCondition || "Good",
    refrigeratorCondition: input.refrigeratorCondition || "Good",
    acCondition: input.acCondition || "Good",
    waterLeakageCheck: input.waterLeakageCheck || "No Leak",
    lightingCondition: input.lightingCondition || "Good",
    curtainCondition: input.curtainCondition || "Good",
    doorLockCondition: input.doorLockCondition || "Good",
    smokeDetectorCondition: input.smokeDetectorCondition || "Good",
    fireExtinguisherAvailability: input.fireExtinguisherAvailability || "Available",
    bathroomCleanliness: input.bathroomCleanliness || "Clean",
    generalRoomCleanliness: input.generalRoomCleanliness || "Clean",
    missingAssetVerification: input.missingAssetVerification || "No Missing Asset",
  };
}

async function handleInspectionOutputs(inspection: any, input: z.infer<typeof housingSchema>, room: any, actor: string) {
  if (input.damageFound) {
    await housingHistory("damage", inspection.id, actor, "Damage record created", input.damageReport || input.findings || "", { roomId: room.id, inspectionId: inspection.id });
  }
  if (input.missingAssetFound) {
    if (input.assetId) {
      await prisma.housingAsset.update({ where: { id: input.assetId }, data: { status: "MISSING" } });
      await housingHistory("asset", input.assetId, actor, "Asset marked missing", input.missingAssetReport || input.missingAssetVerification, { roomId: room.id, assetId: input.assetId });
    }
    await housingHistory("missing-asset", inspection.id, actor, "Missing asset report created", input.missingAssetReport || input.missingAssetVerification, { roomId: room.id, inspectionId: inspection.id });
  }
  if (input.repairRequired || input.createMaintenanceTicket) {
    const count = await prisma.serviceRequest.count();
    const request = await prisma.serviceRequest.create({
      data: {
        ticketNo: `SR-${String(count + 24001).padStart(5, "0")}`,
        title: `Housing repair required - ${room.roomNumber}`,
        category: "Housing Maintenance",
        departmentCode: "HOUSING",
        requester: actor,
        channel: "Inspection",
        priority: input.priority as any || "MEDIUM",
        status: "NEW",
        location: `${room.property?.name || "Housing"} / ${room.block?.name || ""} / ${room.roomNumber}`,
        attachmentUrls: [input.beforePhotoUrls, input.afterPhotoUrls, input.photoUrls, input.attachmentUrls].filter(Boolean).join(","),
        slaHours: 24,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        description: [input.damageReport, input.missingAssetReport, input.findings, `Estimated repair cost: SAR ${input.estimatedRepairCost || 0}`, `Occupant liability: ${input.occupantLiability || "-"}`].filter(Boolean).join("\n"),
      },
    });
    await prisma.housingInspection.update({ where: { id: inspection.id }, data: { maintenanceTicketNo: request.ticketNo } });
    await housingHistory("inspection", inspection.id, actor, "Converted to maintenance ticket", request.ticketNo, { roomId: room.id, inspectionId: inspection.id });
  }
}

async function createRoomHold(input: z.infer<typeof housingSchema>, actor: string) {
  const room = await firstRoom(input.roomId);
  const startDate = input.holdStartDate || input.checkIn;
  const endDate = input.holdEndDate || input.checkOut;
  if (!startDate || !endDate) throw new Error("Hold start date and hold end date are required.");
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Valid hold dates are required.");
  if (end < start) throw new Error("Hold end date cannot be before hold start date.");
  await expireRoomHolds();
  await assertNoOverlappingHold(room.id, start, end);
  await assertNoOverlappingBooking(room.id, start, end);
  const hold = await prisma.housingRoomHold.create({
    data: {
      roomId: room.id,
      startDate: start,
      endDate: end,
      reason: input.reason || input.name || "Room reserved",
      remarks: input.remarks || input.notes || "",
      createdBy: actor,
      status: (input.holdStatus || input.status || "ACTIVE").toUpperCase(),
    },
    include: { room: { include: { property: true, block: true } } },
  });
  await housingHistory("hold", hold.id, actor, "Room hold created", `${hold.reason} / ${hold.status}`, { roomId: room.id });
  return hold;
}

async function nextHousingBookingNo(attempt = 0) {
  const prefix = "HBK-";
  const rows = await prisma.housingBooking.findMany({
    where: { bookingNo: { startsWith: prefix } },
    select: { bookingNo: true },
  });
  let highest = 0;
  for (const row of rows) {
    const match = /^HBK-(\d+)$/i.exec(String(row.bookingNo || "").trim());
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  if (!highest) highest = await prisma.housingBooking.count();
  for (let offset = attempt + 1; offset <= attempt + 100; offset += 1) {
    const bookingNo = `${prefix}${String(highest + offset).padStart(5, "0")}`;
    const existing = await prisma.housingBooking.findUnique({ where: { bookingNo }, select: { id: true } });
    if (!existing) return bookingNo;
  }
  return `${prefix}${Date.now()}${attempt ? `-${attempt}` : ""}`;
}

async function createBooking(input: z.infer<typeof housingSchema>, actor: string) {
  if (!input.roomId?.trim()) {
    throw new HousingInputError("Select an available room before saving the booking.");
  }
  let room = await firstRoom(input.roomId);
  await reconcileRoomAvailability(room.id);
  room = await firstRoom(room.id);
  if (unavailableRoomStatuses.includes(String(room.status || "").toUpperCase())) {
    throw new HousingInputError("Only available rooms can be allocated. Checked-in, approved, reserved, occupied, or held rooms are not available for booking.");
  }
  const resident = await resolveResident(input);
  const employeeId = input.employeeId || input.residentNo || resident?.residentNo || "";
  const employeeName = input.residentName || input.name || resident?.name || "";
  if (!employeeId.trim()) throw new HousingInputError("Employee ID is required for accommodation bookings.");
  if (!employeeName.trim()) throw new HousingInputError("Employee name is required for accommodation bookings.");
  if (resident?.status === "BLACKLISTED") {
    throw new HousingInputError("Blacklisted occupants cannot receive a new accommodation allocation.");
  }
  const occupantGender = (input.gender || resident?.gender || "").toUpperCase();
  if (room.genderRestriction && room.genderRestriction !== "MIXED" && occupantGender && occupantGender !== room.genderRestriction.toUpperCase()) {
    throw new HousingInputError("Male and female occupants cannot be assigned to this gender-restricted room.");
  }
  const bookingStart = input.checkIn ? new Date(input.checkIn) : new Date();
  const bookingEnd = input.checkOut ? new Date(input.checkOut) : bookingStart;
  if (Number.isNaN(bookingStart.getTime()) || Number.isNaN(bookingEnd.getTime())) {
    throw new HousingInputError("Valid start and end date/time are required for accommodation bookings.");
  }
      const currentMinute = new Date();
      currentMinute.setSeconds(0, 0);
      const bookingStartGrace = new Date(currentMinute.getTime() - 2 * 60 * 1000);
      if (bookingStart < bookingStartGrace) {
    throw new HousingInputError("Accommodation booking start date/time cannot be in the past.");
  }
  if (bookingEnd < bookingStart) {
    throw new HousingInputError("Accommodation booking end date/time cannot be before the start date/time.");
  }
  await expireRoomHolds();
  await assertNoOverlappingHold(room.id, bookingStart, bookingEnd);
  const overlappingBookings = await activeOverlappingBookingsForRoom(room, bookingStart, bookingEnd);
  if (overlappingBookings.length) {
    throw new HousingInputError(`Room already has active booking/reservation ${overlappingBookings[0].bookingNo}. Check out or cancel the booking before allocating this room again.`);
  }
  const busyBedIds = new Set(overlappingBookings.map((booking) => booking.bedId).filter(Boolean));
  const roomBeds = await prisma.housingBed.findMany({ where: { roomId: room.id }, orderBy: { label: "asc" } });
  const bed = input.bedId
    ? roomBeds.find((item) => item.id === input.bedId) || null
    : roomBeds.find((item) => item.status === "AVAILABLE" && !busyBedIds.has(item.id)) ||
      roomBeds.find((item) => !busyBedIds.has(item.id)) ||
      null;
  if (!bed && room.capacity > 1) throw new HousingInputError("No available bed found for this room.");
  if (bed && bed.roomId !== room.id) throw new HousingInputError("Selected bed does not belong to the selected room.");
  if (bed && busyBedIds.has(bed.id)) throw new HousingInputError("Selected bed is already occupied or reserved for the selected dates.");

  const duplicate = overlappingBookings.find(
    (booking) =>
      room.capacity <= 1 ||
      !bed ||
      !booking.bedId ||
      booking.bedId === bed.id,
  );
  if (duplicate) {
    throw new HousingInputError("Duplicate room or bed allocation is not allowed.");
  }

  const requestedStatus = bookingStatuses.includes(input.status || "") ? input.status as any : "PENDING_APPROVAL";
  const requestedBookingNo = input.code?.trim();
  let booking: any = null;
  let lastCreateError: unknown = null;
  const createAttempts = requestedBookingNo ? 1 : 5;
  for (let attempt = 0; attempt < createAttempts; attempt += 1) {
    const bookingNo = requestedBookingNo || (await nextHousingBookingNo(attempt));
    try {
      booking = await prisma.$transaction(async (tx) => {
        const created = await tx.housingBooking.create({
          data: {
            bookingNo,
            residentId: resident?.id,
            residentName: employeeName,
            departmentCode: input.departmentCode || resident?.departmentCode || "",
            employeeId,
            companyName: input.companyName || resident?.companyName || input.companyId || "",
            nationality: input.nationality || resident?.nationality || "",
            contactNumber: input.contactNumber || input.phone || resident?.phone || "",
            gender: occupantGender || "",
            buildingNumber: input.buildingNumber || room.block?.name || room.property?.name || "",
            floorNumber: input.floorNumber || room.floor,
            roomNumber: input.roomNumber || room.roomNumber,
            bedNumber: input.bedNumber || bed?.label || "",
            bookingType: input.bookingType || "TEMPORARY",
            allocationType: input.allocationType || "STANDARD",
            roomId: room.id,
            bedId: bed?.id,
            checkIn: bookingStart,
            checkOut: input.checkOut ? bookingEnd : undefined,
            status: requestedStatus,
            priority: (input.priority as any) || "MEDIUM",
            requestedBy: input.requestedBy || actor,
            approvedBy: input.approvedBy || "",
            approvalLevel: ["APPROVED", "CHECKED_IN"].includes(requestedStatus) ? bookingApprovalSteps[3].level : bookingApprovalSteps[0].level,
            attachmentUrls: input.attachmentUrls || "",
            notes: input.notes || "",
            keyHandoverBy: input.keyHandoverBy || "",
            keyHandoverAt: input.keyHandoverAt ? new Date(input.keyHandoverAt) : undefined,
            campIdNumber: input.campIdNumber || "",
            campIdIssuedAt: input.campIdIssuedAt ? new Date(input.campIdIssuedAt) : undefined,
          },
        });
        await tx.housingApproval.createMany({
          data: bookingApprovalSteps.map((step) => ({
            entity: "booking",
            entityId: created.id,
            bookingId: created.id,
            level: step.level,
            step: step.step,
            approver: step.approver,
            status: ["APPROVED", "CHECKED_IN"].includes(requestedStatus) ? "APPROVED" : step.step === 1 ? "PENDING" : "WAITING",
            remarks: ["APPROVED", "CHECKED_IN"].includes(requestedStatus) ? "Approved during booking creation" : step.step === 1 ? created.notes || "" : "",
          })),
        });
        await tx.housingNotification.create({
          data: {
            title: "Housing booking pending coordinator review",
            message: `${created.bookingNo} for ${created.residentName} is waiting for Housing Coordinator review.`,
            recipient: bookingApprovalSteps[0].approver,
            severity: created.priority,
            bookingId: created.id,
          },
        });
        return created;
      });
      break;
    } catch (error) {
      lastCreateError = error;
      if (!requestedBookingNo && isPrismaError(error, "P2002") && prismaErrorTargetIncludes(error, "bookingNo")) {
        continue;
      }
      const normalizedError = normalizeHousingSaveError(error);
      throw normalizedError instanceof Error ? normalizedError : new Error("Unable to save housing record");
    }
  }
  if (!booking) {
    const normalizedError = normalizeHousingSaveError(lastCreateError);
    if (normalizedError instanceof Error) throw normalizedError;
    throw new HousingInputError("Unable to create a unique housing booking number. Please save again.");
  }
  if (bed && ["APPROVED", "CHECKED_IN"].includes(requestedStatus)) {
    await prisma.housingBed.update({
      where: { id: bed.id },
      data: {
        status: requestedStatus === "CHECKED_IN" ? "OCCUPIED" : "RESERVED",
        occupant: booking.residentName,
        occupantId: booking.residentId || "",
      },
    });
  }
  await refreshRoomOccupancy(room.id);
  await housingHistory("booking", booking.id, actor, "Booking created", booking.notes, { roomId: room.id, bookingId: booking.id });
  return booking;
}

async function resolveResident(input: z.infer<typeof housingSchema>) {
  if (input.residentId) {
    const resident = await prisma.housingResident.findUnique({ where: { id: input.residentId } });
    const nextPhone = input.phone || input.contactNumber || "";
    if (resident && nextPhone && resident.phone !== nextPhone) {
      return prisma.housingResident.update({
        where: { id: resident.id },
        data: { phone: nextPhone },
      });
    }
    if (resident) return resident;
  }
  const employeeId = input.employeeId || input.residentNo;
  if (!employeeId && !(input.residentName || input.name)) return null;
  const residentNo = employeeId || `RES-${String((await prisma.housingResident.count()) + 1).padStart(5, "0")}`;
  return prisma.housingResident.upsert({
    where: { residentNo },
    update: residentData(input, residentNo),
    create: residentData(input, residentNo),
  });
}

function residentData(input: z.infer<typeof housingSchema>, residentNo: string) {
  return {
    residentNo,
    name: input.name || input.residentName || residentNo,
    email: input.email || "",
    phone: input.phone || input.contactNumber || "",
    companyId: input.companyId || input.companyName || "",
    companyName: input.companyName || input.companyId || "",
    gender: input.gender || "",
    nationality: input.nationality || "",
    departmentCode: input.departmentCode || "",
    status: input.type === "resident" ? input.status || "ACTIVE" : "ACTIVE",
  };
}

function inventoryData(input: z.infer<typeof housingSchema>, sku: string, roomId: string | undefined, onHand: number, actor: string, movementType: string, movementQty: number) {
  const shouldGeneratePurchaseRequest = Boolean(input.generatePurchaseRequest || onHand <= (input.minimumStock ?? input.reorderPoint ?? 0));
  const purchaseRequestNo = input.purchaseRequestNo || (shouldGeneratePurchaseRequest ? `HPR-${Date.now()}` : undefined);
  return {
    sku,
    name: input.name || sku,
    category: input.category || "Linen",
    description: input.description || input.notes || "",
    roomId,
    storeLocation: input.storeLocation || "",
    onHand,
    minimumStock: input.minimumStock ?? 0,
    reorderPoint: input.reorderPoint ?? 0,
    unit: input.unit || "Each",
    unitCost: input.unitCost ?? 0,
    supplierName: input.supplierName || "",
    supplierContact: input.supplierContact || "",
    preferredSupplier: input.preferredSupplier || input.supplierName || "",
    expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
    lastMovementType: movementType,
    lastMovementQty: movementQty,
    lastMovementAt: new Date(),
    lastMovementBy: input.movementBy || actor,
    transferFrom: input.transferFrom || "",
    transferTo: input.transferTo || "",
    adjustmentReason: input.adjustmentReason || "",
    purchaseRequestNo,
    purchaseRequestStatus: input.purchaseRequestStatus || (purchaseRequestNo ? "REQUESTED" : ""),
    qrCode: input.qrCode || `QR:${sku}`,
  };
}

function inventoryStock(input: z.infer<typeof housingSchema>, currentOnHand: number) {
  const movementType = (input.movementType || "ADJUSTMENT").toUpperCase();
  const movementQty = input.movementQty ?? 0;
  let onHand = input.onHand ?? currentOnHand;
  if (movementQty > 0) {
    if (movementType === "RECEIPT") onHand = currentOnHand + movementQty;
    if (movementType === "ISSUE") onHand = currentOnHand - movementQty;
    if (movementType === "ADJUSTMENT") onHand = movementQty;
  }
  if (onHand < 0) throw new Error("Stock cannot go below zero.");
  return { onHand, movementType, movementQty };
}

async function handleInventoryOutputs(item: any, input: z.infer<typeof housingSchema>, actor: string, previousOnHand: number, movementType: string, movementQty: number) {
  await housingHistory("inventory", item.id, actor, `Stock ${movementType.toLowerCase()}`, `${item.name}: ${previousOnHand} -> ${item.onHand}${movementQty ? ` (${movementQty})` : ""}`, { roomId: item.roomId, inventoryId: item.id });
  if (String(movementType).toUpperCase() === "TRANSFER") {
    await housingHistory("inventory", item.id, actor, "Stock transfer", `${input.transferFrom || item.transferFrom || "-"} -> ${input.transferTo || item.transferTo || "-"}`, { roomId: item.roomId, inventoryId: item.id });
  }
  if (item.onHand <= item.minimumStock) {
    await prisma.housingNotification.create({ data: { title: "Housing inventory minimum stock alert", message: `${item.name} is at ${item.onHand} ${item.unit}; minimum stock is ${item.minimumStock}.`, recipient: "Housing Inventory Manager", severity: "HIGH" } });
  } else if (item.onHand <= item.reorderPoint) {
    await prisma.housingNotification.create({ data: { title: "Housing inventory reorder alert", message: `${item.name} is at ${item.onHand} ${item.unit}; reorder point is ${item.reorderPoint}.`, recipient: "Housing Inventory Manager", severity: "MEDIUM" } });
  }
  if (item.expiryDate && new Date(item.expiryDate).getTime() <= Date.now()) {
    await prisma.housingNotification.create({ data: { title: "Housing inventory expired item alert", message: `${item.name} expired on ${new Date(item.expiryDate).toISOString().slice(0, 10)}.`, recipient: "Housing Inventory Manager", severity: "HIGH" } });
  }
  if (item.purchaseRequestNo) {
    await housingHistory("inventory", item.id, actor, "Purchase request generated", `${item.purchaseRequestNo} / ${item.purchaseRequestStatus || "REQUESTED"}`, { roomId: item.roomId, inventoryId: item.id });
  }
}

function housingAssetData(input: z.infer<typeof housingSchema>, tag: string, roomId?: string) {
  const assetValue = input.assetValue ?? 0;
  const depreciationRate = input.depreciationRate ?? 0;
  const purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : null;
  const years = purchaseDate ? Math.max(0, (Date.now() - purchaseDate.getTime()) / (365 * 24 * 60 * 60 * 1000)) : 0;
  const currentValue = input.currentValue ?? Math.max(0, Math.round((assetValue * Math.max(0, 1 - (depreciationRate / 100) * years)) * 100) / 100);
  return {
    tag,
    name: input.name || input.description || tag,
    category: input.category || "Furniture",
    description: input.description || input.notes || "",
    brand: input.brand || "",
    model: input.model || "",
    purchaseDate: purchaseDate || undefined,
    supplierName: input.supplierName || "",
    assetValue,
    buildingLocation: input.buildingLocation || roomId || "",
    roomLocation: input.roomLocation || "",
    custodianName: input.custodianName || "",
    custodianContact: input.custodianContact || "",
    issuedTo: input.issuedTo || "",
    issuedAt: input.issuedAt ? new Date(input.issuedAt) : undefined,
    transferredFrom: input.transferredFrom || "",
    transferredTo: input.transferredTo || "",
    transferredAt: input.transferredAt ? new Date(input.transferredAt) : undefined,
    replacementOf: input.replacementOf || "",
    replacedAt: input.replacedAt ? new Date(input.replacedAt) : undefined,
    pmSchedule: input.pmSchedule || "",
    nextPmDue: input.nextPmDue ? new Date(input.nextPmDue) : undefined,
    depreciationRate,
    currentValue,
    lastInspectionAt: input.lastInspectionAt ? new Date(input.lastInspectionAt) : undefined,
    roomId,
    status: input.status || "AVAILABLE",
    serialNumber: input.serialNumber || "",
    warrantyExpiry: input.warrantyExpiry ? new Date(input.warrantyExpiry) : undefined,
    qrCode: input.qrCode || `QR:${tag}`,
    photoUrls: input.photoUrls || input.attachmentUrls || "",
  };
}

async function handleAssetOutputs(asset: any, input: z.infer<typeof housingSchema>, room: any, actor: string, created = false) {
  const action = input.movementAction || (created ? "Asset saved" : "Asset updated");
  await housingHistory("asset", asset.id, actor, action, `${asset.tag} / ${asset.status}`, { roomId: room?.id || asset.roomId, assetId: asset.id });
  if (input.issuedTo || input.issuedAt) await housingHistory("asset", asset.id, actor, "Asset issued", input.issuedTo || asset.issuedTo, { roomId: room?.id || asset.roomId, assetId: asset.id });
  if (input.transferredTo || input.transferredAt) await housingHistory("asset", asset.id, actor, "Asset transferred", `${input.transferredFrom || asset.transferredFrom || "-"} -> ${input.transferredTo || asset.transferredTo || "-"}`, { roomId: room?.id || asset.roomId, assetId: asset.id });
  if (input.replacementOf || input.replacedAt) await housingHistory("asset", asset.id, actor, "Asset replacement recorded", input.replacementOf || asset.replacementOf, { roomId: room?.id || asset.roomId, assetId: asset.id });
  if (["MISSING", "DAMAGED"].includes(String(asset.status).toUpperCase())) await housingHistory("asset", asset.id, actor, `${asset.status} asset tracking`, input.notes || input.remarks || asset.description, { roomId: room?.id || asset.roomId, assetId: asset.id });
  if (asset.warrantyExpiry && new Date(asset.warrantyExpiry).getTime() <= Date.now() + 30 * 24 * 60 * 60 * 1000) {
    await prisma.housingNotification.create({ data: { title: "Housing asset warranty alert", message: `${asset.tag} warranty expires on ${new Date(asset.warrantyExpiry).toISOString().slice(0, 10)}.`, recipient: "Housing Asset Manager", severity: "HIGH" } });
  }
}

function normalizeHousingToken(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function compactHousingToken(value: unknown) {
  return normalizeHousingToken(value).replace(/[^A-Z0-9]/g, "");
}

function housingTokensOverlap(left: unknown, right: unknown) {
  const leftToken = compactHousingToken(left);
  const rightToken = compactHousingToken(right);
  if (!leftToken || !rightToken) return false;
  if (leftToken === rightToken) return true;
  const minimumSafeLength = 5;
  return (
    leftToken.length >= minimumSafeLength &&
    rightToken.length >= minimumSafeLength &&
    (leftToken.includes(rightToken) || rightToken.includes(leftToken))
  );
}

function housingRoomMatchesBooking(room: any, booking: any) {
  const bookingRoomId = booking?.roomId || booking?.room?.id;
  if (room?.id && bookingRoomId === room.id) return true;

  const roomCode = compactHousingToken(room?.code);
  const bookingRoomCodeFields = [
    booking?.room?.code,
    booking?.roomCode,
    booking?.roomNumber,
  ];
  if (
    roomCode &&
    bookingRoomCodeFields.some((field) => housingTokensOverlap(roomCode, field))
  ) {
    return true;
  }

  const roomNumber = compactHousingToken(room?.roomNumber);
  const bookingRoomNumber = compactHousingToken(
    booking?.roomNumber || booking?.room?.roomNumber,
  );
  if (!roomNumber || !bookingRoomNumber || roomNumber !== bookingRoomNumber) {
    return false;
  }

  const roomFloor = compactHousingToken(room?.floor);
  const bookingFloor = compactHousingToken(
    booking?.floorNumber || booking?.room?.floor,
  );
  const roomBuilding = compactHousingToken(
    room?.block?.code ||
      room?.block?.name ||
      room?.buildingNumber ||
      room?.property?.code ||
      room?.property?.name,
  );
  const bookingBuilding = compactHousingToken(
    booking?.buildingNumber ||
      booking?.room?.block?.code ||
      booking?.room?.block?.name ||
      booking?.room?.property?.code ||
      booking?.room?.property?.name,
  );
  const floorMatches = Boolean(roomFloor && bookingFloor && roomFloor === bookingFloor);
  const buildingMatches = housingTokensOverlap(roomBuilding, bookingBuilding);
  return roomNumber.length >= 5 || floorMatches || buildingMatches;
}

async function firstProperty(propertyId?: string) {
  const property = propertyId ? await prisma.housingProperty.findUnique({ where: { id: propertyId } }) : await prisma.housingProperty.findFirst();
  if (property) return property;
  return prisma.housingProperty.create({ data: { code: "HSP-001", name: "Tamimi Housing Village", site: "Jazan", city: "Jazan", manager: "Housing Supervisor" } });
}

async function firstRoom(roomId?: string) {
  const room = roomId
    ? await prisma.housingRoom.findUnique({ where: { id: roomId }, include: { property: true, block: true } })
    : await prisma.housingRoom.findFirst({ include: { property: true, block: true } });
  if (!room) throw new HousingInputError("Create a housing room before using this function.");
  return room;
}

async function ensureBeds(roomId: string, roomCode: string, capacity: number) {
  const existing = await prisma.housingBed.count({ where: { roomId } });
  for (let index = existing + 1; index <= capacity; index += 1) {
    await prisma.housingBed.upsert({
      where: { code: `${roomCode}-B${index}` },
      update: {},
      create: { code: `${roomCode}-B${index}`, label: `Bed ${index}`, roomId },
    });
  }
}

async function refreshRoomOccupancy(roomId: string) {
  const room = await prisma.housingRoom.findUnique({
    where: { id: roomId },
    include: { property: true, block: true, beds: true },
  });
  if (!room) return;
  const activeBookings = await activeOverlappingBookingsForRoom(
    room,
    new Date(0),
    new Date("2999-12-31T23:59:59"),
  );
  const activeHolds = await prisma.housingRoomHold.findMany({
    where: { roomId, status: "ACTIVE", endDate: { gte: new Date() } },
  });
  const nextRoomState = normalizeRoomAvailabilitySnapshot(
    room,
    activeBookings,
    activeHolds,
  );
  await prisma.housingRoom.update({
    where: { id: roomId },
    data: {
      occupancy: nextRoomState.occupancy,
      status: nextRoomState.status as any,
    },
  });
}

async function reconcileRoomAvailability(roomId: string) {
  const room = await prisma.housingRoom.findUnique({
    where: { id: roomId },
    include: { beds: true },
  });
  if (!room || room.status === "MAINTENANCE" || room.status === "BLOCKED") return;

  const activeBedBookings = await prisma.housingBooking.findMany({
    where: {
      roomId,
      status: { notIn: closedBookingStatuses as any },
      OR: [
        { status: { in: activeBookingStatuses as any } },
        { extensionStatus: { in: activeExtensionStatuses as any } },
      ],
    },
    select: { bedId: true },
  });
  const activeBedIds = new Set(
    activeBedBookings.map((booking) => booking.bedId).filter(Boolean),
  );
  const staleBedIds = room.beds
    .filter(
      (bed) =>
        ["RESERVED", "OCCUPIED"].includes(String(bed.status || "").toUpperCase()) &&
        !activeBedIds.has(bed.id),
    )
    .map((bed) => bed.id);

  if (staleBedIds.length) {
    await prisma.housingBed.updateMany({
      where: { id: { in: staleBedIds } },
      data: { status: "AVAILABLE", occupant: "", occupantId: "" },
    });
  }
  await refreshRoomOccupancy(roomId);
}

async function housingHistory(entity: string, entityId: string, actor: string, action: string, details?: string | null, links: { roomId?: string; bookingId?: string; inspectionId?: string; assetId?: string; inventoryId?: string } = {}) {
  await prisma.housingHistory.create({
    data: { entity, entityId, actor, action, details: details || "", ...links },
  });
}
async function expireRoomHolds() {
  await prisma.housingRoomHold.updateMany({
    where: { status: "ACTIVE", endDate: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
}

async function assertNoOverlappingHold(roomId: string, start: Date, end: Date, excludeId?: string) {
  const overlap = await prisma.housingRoomHold.findFirst({
    where: {
      roomId,
      status: "ACTIVE",
      id: excludeId ? { not: excludeId } : undefined,
      startDate: { lte: end },
      endDate: { gte: start },
    },
    include: { room: true },
  });
  if (overlap) throw new HousingInputError(`Room ${overlap.room.roomNumber} is already on hold from ${overlap.startDate.toISOString().slice(0, 10)} to ${overlap.endDate.toISOString().slice(0, 10)}.`);
}

async function assertNoOverlappingBooking(roomId: string, _start: Date, _end: Date, excludeId?: string) {
  const room = await prisma.housingRoom.findUnique({
    where: { id: roomId },
    include: { property: true, block: true },
  });
  if (!room) throw new HousingInputError("Selected room does not exist.");
  const overlap = await activeOverlappingBookingsForRoom(room, _start, _end, excludeId);
  if (overlap.length) throw new HousingInputError(`Room already has active booking/reservation ${overlap[0].bookingNo}. Check out or cancel the booking before allocating this room again.`);
}

async function activeOverlappingBookingsForRoom(room: any, _start: Date, _end: Date, excludeId?: string) {
  const activeBookings = await prisma.housingBooking.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      status: { notIn: closedBookingStatuses as any },
      AND: [
        {
          OR: [
            { status: { in: activeBookingStatuses as any } },
            { extensionStatus: { in: activeExtensionStatuses as any } },
          ],
        },
        {
          OR: [
            { roomId: room.id },
            { roomNumber: room.roomNumber },
          ],
        },
      ],
    },
    include: { room: { include: { property: true, block: true } } },
  });
  return activeBookings.filter((booking) => {
    if (!bookingKeepsRoomUnavailable(booking) || !housingRoomMatchesBooking(room, booking)) return false;
    return true;
  });
}

function bookingKeepsRoomUnavailable(booking: { status?: string | null; extensionStatus?: string | null }) {
  const status = String(booking.status || "").toUpperCase();
  if (closedBookingStatuses.includes(status)) return false;
  const extensionStatus = String(booking.extensionStatus || "").toUpperCase();
  return activeBookingStatuses.includes(status) || activeExtensionStatuses.includes(extensionStatus);
}

function activeHoldBlocksRoom(room: any, hold: any) {
  const holdRoomId = hold?.roomId || hold?.room?.id;
  if (!room?.id || !holdRoomId || holdRoomId !== room.id) return false;
  if (String(hold?.status || "").toUpperCase() !== "ACTIVE") return false;
  const holdStart = hold?.startDate ? new Date(String(hold.startDate)) : null;
  const holdEnd = hold?.endDate ? new Date(String(hold.endDate)) : null;
  if (!holdEnd || Number.isNaN(holdEnd.getTime())) return false;
  const now = Date.now();
  if (holdStart && !Number.isNaN(holdStart.getTime()) && holdStart.getTime() > now) return false;
  return holdEnd.getTime() >= now;
}

function normalizeRoomAvailabilitySnapshot(room: any, bookings: any[] = [], holds: any[] = []) {
  const roomStatus = String(room?.status || "").toUpperCase();
  const beds: any[] = Array.isArray(room?.beds) ? room.beds : [];
  const bedOccupancy = beds.filter((bed) =>
    ["RESERVED", "OCCUPIED"].includes(String(bed?.status || "").toUpperCase()),
  ).length;
  const hasOccupiedBed = beds.some(
    (bed) => String(bed?.status || "").toUpperCase() === "OCCUPIED",
  );
  const activeRoomBookings = bookings.filter(
    (booking) =>
      bookingKeepsRoomUnavailable(booking) &&
      housingRoomMatchesBooking(room, booking),
  );
  const hasCheckedInBooking = activeRoomBookings.some(
    (booking) => String(booking?.status || "").toUpperCase() === "CHECKED_IN",
  );
  const hasActiveHold = holds.some((hold) => activeHoldBlocksRoom(room, hold));
  const capacity = Number(room?.capacity || 0);
  const occupancy = Math.min(
    capacity || Math.max(bedOccupancy, activeRoomBookings.length),
    Math.max(bedOccupancy, activeRoomBookings.length),
  );
  const status =
    roomStatus === "MAINTENANCE" || roomStatus === "BLOCKED"
      ? roomStatus
      : hasActiveHold
        ? "HOLD"
        : hasCheckedInBooking || hasOccupiedBed
          ? "OCCUPIED"
          : activeRoomBookings.length || bedOccupancy
            ? "RESERVED"
            : "AVAILABLE";
  return { ...room, occupancy, status };
}
