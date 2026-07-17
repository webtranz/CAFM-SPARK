import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.record(z.unknown());
const closedBookingStatuses = ["CHECKED_OUT", "REJECTED", "CANCELLED", "NO_SHOW", "TRANSFERRED"];
const approvalSteps = [
  { step: 1, level: "Housing Coordinator Review", next: "Housing Supervisor" },
  { step: 2, level: "Housing Supervisor Approval", next: "Camp Manager" },
  { step: 3, level: "Camp Manager Final Approval", next: "Reception Team" },
  { step: 4, level: "Reception Allocation", next: "" },
];

export async function PATCH(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    const { type, id } = await params;
    const input = bodySchema.parse(await request.json());
    const permissionCode = type === "approval" ? "housing.approve" : "housing.edit";
    const { error: permissionError } = await requirePermission(permissionCode);
    if (permissionError) return permissionError;
    const user = await getCurrentUser();
    const current = await findHousingRecord(type, id);
    const record = await updateHousingRecord(type, id, input, user);
    await auditAction({ user, action: `HOUSING_${type.toUpperCase()}_UPDATE`, entity: `housing_${type}`, entityId: id, details: { before: current, input, after: record } });
    return NextResponse.json(record);
  } catch (error) {
    return apiError(error, "Unable to update housing record");
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    const { error, user } = await requirePermission("housing.delete");
    if (error) return error;
    const { type, id } = await params;
    const current = await findHousingRecord(type, id);
    await deleteHousingRecord(type, id);
    await auditAction({ user, action: `HOUSING_${type.toUpperCase()}_DELETE`, entity: `housing_${type}`, entityId: id, details: { deletedRecord: current } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Unable to delete housing record");
  }
}

async function findHousingRecord(type: string, id: string) {
  if (type === "property") return prisma.housingProperty.findUnique({ where: { id } });
  if (type === "block") return prisma.housingBlock.findUnique({ where: { id } });
  if (type === "room") return prisma.housingRoom.findUnique({ where: { id } });
  if (type === "bed") return prisma.housingBed.findUnique({ where: { id } });
  if (type === "resident") return prisma.housingResident.findUnique({ where: { id } });
  if (type === "booking") return prisma.housingBooking.findUnique({ where: { id } });
  if (type === "inspection") return prisma.housingInspection.findUnique({ where: { id } });
  if (type === "asset") return prisma.housingAsset.findUnique({ where: { id } });
  if (type === "inventory") return prisma.housingInventory.findUnique({ where: { id } });
  if (type === "notification-setting") return prisma.housingNotificationSetting.findUnique({ where: { id } });
  if (type === "notification") return prisma.housingNotification.findUnique({ where: { id } });
  if (type === "hold") return prisma.housingRoomHold.findUnique({ where: { id } });
  throw new Error("Unsupported housing type.");
}

async function updateHousingRecord(type: string, id: string, input: Record<string, unknown>, user: Awaited<ReturnType<typeof getCurrentUser>>) {
  const actor = user?.name || user?.email || "System";
  if (type === "booking") {
    await expireRoomHolds();
    const status = text(input.status);
    const current = await prisma.housingBooking.findUnique({ where: { id }, include: { bed: true, room: true } });
    if (!current) throw new Error("Booking not found.");
    if (status === "CHECKED_IN") {
      const role = String(user?.role || "").toLowerCase();
      if (!role.includes("reception") && role !== "admin") throw new Error("Only Reception Team can execute final room allocation.");
      if (current.status !== "APPROVED") throw new Error("Room allocation can be executed only after Camp Manager final approval.");
    }
    const effectiveStatus = status || current.status;
    const nextRoomId = text(input.roomId) || current.roomId;
    const roomChanged = nextRoomId !== current.roomId;
    const nextRoom = roomChanged ? await prisma.housingRoom.findUnique({ where: { id: nextRoomId } }) : current.room;
    if (!nextRoom) throw new Error("Selected room does not exist.");
    const nextCheckIn = input.checkIn ? new Date(String(input.checkIn)) : current.checkIn;
    const nextCheckOut = input.checkOut ? new Date(String(input.checkOut)) : current.checkOut || nextCheckIn;
    if (["CHECKED_IN", "APPROVED", "PENDING_APPROVAL"].includes(effectiveStatus) && ["BLOCKED", "MAINTENANCE"].includes(nextRoom.status)) {
      throw new Error("Blocked or under-maintenance rooms cannot be allocated.");
    }
    if (["CHECKED_IN", "APPROVED", "PENDING_APPROVAL", "REQUESTED"].includes(effectiveStatus)) {
      await assertNoOverlappingHold(nextRoom.id, nextCheckIn, nextCheckOut);
    }
    const requestedBedId = text(input.bedId);
    const autoBed = !requestedBedId && roomChanged ? await prisma.housingBed.findFirst({ where: { roomId: nextRoom.id, status: "AVAILABLE" } }) : null;
    const nextBedId = requestedBedId || autoBed?.id || (roomChanged ? undefined : current.bedId || undefined);
    const nextBed = nextBedId ? await prisma.housingBed.findUnique({ where: { id: nextBedId } }) : null;
    if (nextBed && nextBed.roomId !== nextRoom.id) throw new Error("Selected bed does not belong to the selected room.");
    if (nextBed && nextBed.id !== current.bedId && ["RESERVED", "OCCUPIED"].includes(nextBed.status)) throw new Error("Occupied beds cannot be assigned twice.");
    if (nextRoom.capacity > 1 && !nextBed) throw new Error("No available bed found for the selected room.");
    const booking = await prisma.housingBooking.update({
      where: { id },
      data: {
        status: (status || undefined) as any,
        roomId: nextRoom.id,
        bedId: nextBed?.id || null,
        approvedBy: text(input.approvedBy) || undefined,
        notes: text(input.notes) || undefined,
        attachmentUrls: text(input.attachmentUrls) || undefined,
        checkIn: input.checkIn ? nextCheckIn : undefined,
        checkOut: input.checkOut ? nextCheckOut : undefined,
        employeeId: text(input.employeeId) || undefined,
        companyName: text(input.companyName) || undefined,
        nationality: text(input.nationality) || undefined,
        contactNumber: text(input.contactNumber) || undefined,
        gender: text(input.gender) || undefined,
        buildingNumber: text(input.buildingNumber) || undefined,
        floorNumber: text(input.floorNumber) || undefined,
        roomNumber: text(input.roomNumber) || nextRoom.roomNumber,
        bedNumber: text(input.bedNumber) || nextBed?.label || undefined,
        bookingType: text(input.bookingType) || undefined,
        allocationType: text(input.allocationType) || undefined,
        keyHandoverBy: text(input.keyHandoverBy) || undefined,
        keyHandoverAt: input.keyHandoverAt ? new Date(String(input.keyHandoverAt)) : undefined,
        campIdNumber: text(input.campIdNumber) || undefined,
        campIdIssuedAt: input.campIdIssuedAt ? new Date(String(input.campIdIssuedAt)) : undefined,
        cancellationReason: text(input.cancellationReason) || undefined,
        transferReason: text(input.transferReason) || undefined,
        blacklistReason: text(input.blacklistReason) || undefined,
        noShowAt: status === "NO_SHOW" ? new Date() : input.noShowAt ? new Date(String(input.noShowAt)) : undefined,
      },
      include: { bed: true, room: true },
    });
    if (current.bedId && current.bedId !== booking.bedId) {
      await prisma.housingBed.update({ where: { id: current.bedId }, data: { status: "AVAILABLE", occupant: "", occupantId: "" } });
      await refreshRoomOccupancy(current.roomId);
    }
    if (booking.bedId) {
      await prisma.housingBed.update({
        where: { id: booking.bedId },
        data: {
          status: effectiveStatus === "CHECKED_IN" ? "OCCUPIED" : closedBookingStatuses.includes(effectiveStatus) ? "AVAILABLE" : effectiveStatus === "APPROVED" ? "RESERVED" : undefined,
          occupant: closedBookingStatuses.includes(effectiveStatus) ? "" : booking.residentName,
          occupantId: closedBookingStatuses.includes(effectiveStatus) ? "" : booking.residentId || "",
        },
      });
    }
    if (roomChanged) await refreshRoomOccupancy(current.roomId);
    await refreshRoomOccupancy(booking.roomId);
    await prisma.housingHistory.create({ data: { entity: "booking", entityId: id, bookingId: id, roomId: booking.roomId, actor, action: roomChanged ? "Room swapped" : `Booking ${status || "updated"}`, details: text(input.transferReason) || text(input.notes) || text(input.remarks) || "" } });
    return booking;
  }


  if (type === "hold") {
    const current = await prisma.housingRoomHold.findUnique({ where: { id }, include: { room: true } });
    if (!current) throw new Error("Room hold not found.");
    await expireRoomHolds();
    const roomId = text(input.roomId) || current.roomId;
    const start = input.holdStartDate || input.startDate ? new Date(String(input.holdStartDate || input.startDate)) : current.startDate;
    const end = input.holdEndDate || input.endDate ? new Date(String(input.holdEndDate || input.endDate)) : current.endDate;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("Valid hold dates are required.");
    if (end < start) throw new Error("Hold end date cannot be before hold start date.");
    const nextStatus = (text(input.holdStatus) || text(input.status) || current.status).toUpperCase();
    if (nextStatus === "ACTIVE") {
      await assertNoOverlappingHold(roomId, start, end, id);
      await assertNoOverlappingBooking(roomId, start, end);
    }
    const hold = await prisma.housingRoomHold.update({
      where: { id },
      data: {
        roomId,
        startDate: start,
        endDate: end,
        reason: text(input.reason) || undefined,
        remarks: text(input.remarks) || text(input.notes) || undefined,
        status: nextStatus,
      },
      include: { room: { include: { property: true, block: true } } },
    });
    await prisma.housingHistory.create({ data: { entity: "hold", entityId: id, roomId: hold.roomId, actor, action: nextStatus === "RELEASED" ? "Room hold released" : "Room hold updated", details: `${hold.reason} / ${hold.status}` } });
    return hold;
  }
  if (type === "room") {
    const room = await prisma.housingRoom.update({
      where: { id },
      data: {
        roomNumber: text(input.roomNumber) || undefined,
        floor: text(input.floor) || undefined,
        roomType: text(input.roomType) || undefined,
        genderRestriction: text(input.genderRestriction) || undefined,
        capacity: numberValue(input.capacity),
        status: text(input.status) as any,
        remarks: text(input.remarks) || text(input.notes) || undefined,
      },
    });
    await prisma.housingHistory.create({ data: { entity: "room", entityId: id, roomId: id, actor, action: "Room updated", details: text(input.remarks) || "" } });
    return room;
  }

  if (type === "inspection") {
    const current = await prisma.housingInspection.findUnique({ where: { id }, include: { room: { include: { property: true, block: true } } } });
    if (!current) throw new Error("Inspection not found.");
    const checklist = inspectionChecklist(input);
    const inspection = await prisma.housingInspection.update({
      where: { id },
      data: {
        roomId: text(input.roomId) || undefined,
        bedId: text(input.bedId) || undefined,
        occupantId: text(input.occupantId) || undefined,
        occupantName: text(input.occupantName) || undefined,
        assetId: text(input.assetId) || undefined,
        inspector: text(input.inspector) || undefined,
        inspectionType: text(input.inspectionType) || undefined,
        status: text(input.status) as any,
        score: numberValue(input.score),
        checklistJson: Object.keys(checklist).length ? JSON.stringify(checklist) : undefined,
        ...checklist,
        damageFound: booleanValue(input.damageFound),
        damageReport: text(input.damageReport) || undefined,
        missingAssetFound: booleanValue(input.missingAssetFound),
        missingAssetReport: text(input.missingAssetReport) || undefined,
        repairRequired: booleanValue(input.repairRequired) || booleanValue(input.createMaintenanceTicket),
        estimatedRepairCost: numberValue(input.estimatedRepairCost),
        occupantLiability: text(input.occupantLiability) || undefined,
        beforePhotoUrls: text(input.beforePhotoUrls) || undefined,
        afterPhotoUrls: text(input.afterPhotoUrls) || undefined,
        workOrderRef: text(input.workOrderRef) || undefined,
        findings: text(input.findings) || text(input.notes) || undefined,
        photoUrls: text(input.photoUrls) || text(input.attachmentUrls) || undefined,
        dueAt: input.dueAt ? new Date(String(input.dueAt)) : undefined,
        completedAt: input.completedAt ? new Date(String(input.completedAt)) : text(input.status) === "CLOSED" || text(input.status) === "PASSED" ? new Date() : undefined,
      },
    });
    await handleInspectionOutputs(inspection, input, current.room, actor);
    await prisma.housingHistory.create({ data: { entity: "inspection", entityId: id, inspectionId: id, roomId: inspection.roomId, actor, action: `Inspection ${inspection.status}`, details: inspection.findings || "" } });
    return inspection;
  }

  if (type === "asset") {
    const current = await prisma.housingAsset.findUnique({ where: { id }, include: { room: true } });
    if (!current) throw new Error("Asset not found.");
    const asset = await prisma.housingAsset.update({
      where: { id },
      data: {
        tag: text(input.tag) || undefined,
        name: text(input.name) || undefined,
        category: text(input.category) || undefined,
        description: text(input.description) || text(input.notes) || undefined,
        brand: text(input.brand) || undefined,
        model: text(input.model) || undefined,
        purchaseDate: input.purchaseDate ? new Date(String(input.purchaseDate)) : undefined,
        supplierName: text(input.supplierName) || undefined,
        assetValue: numberValue(input.assetValue),
        buildingLocation: text(input.buildingLocation) || undefined,
        roomLocation: text(input.roomLocation) || undefined,
        custodianName: text(input.custodianName) || undefined,
        custodianContact: text(input.custodianContact) || undefined,
        issuedTo: text(input.issuedTo) || undefined,
        issuedAt: input.issuedAt ? new Date(String(input.issuedAt)) : undefined,
        transferredFrom: text(input.transferredFrom) || undefined,
        transferredTo: text(input.transferredTo) || undefined,
        transferredAt: input.transferredAt ? new Date(String(input.transferredAt)) : undefined,
        replacementOf: text(input.replacementOf) || undefined,
        replacedAt: input.replacedAt ? new Date(String(input.replacedAt)) : undefined,
        pmSchedule: text(input.pmSchedule) || undefined,
        nextPmDue: input.nextPmDue ? new Date(String(input.nextPmDue)) : undefined,
        depreciationRate: numberValue(input.depreciationRate),
        currentValue: numberValue(input.currentValue),
        lastInspectionAt: input.lastInspectionAt ? new Date(String(input.lastInspectionAt)) : undefined,
        status: text(input.status) || undefined,
        roomId: text(input.roomId) || undefined,
        serialNumber: text(input.serialNumber) || undefined,
        warrantyExpiry: input.warrantyExpiry ? new Date(String(input.warrantyExpiry)) : undefined,
        qrCode: text(input.qrCode) || undefined,
        photoUrls: text(input.photoUrls) || text(input.attachmentUrls) || undefined,
      },
    });
    await housingAssetHistory(asset, current, input, actor);
    return asset;
  }

  if (type === "inventory") {
    const current = await prisma.housingInventory.findUnique({ where: { id } });
    if (!current) throw new Error("Inventory item not found.");
    const stock = inventoryStock(input, current.onHand);
    const shouldGeneratePurchaseRequest = booleanValue(input.generatePurchaseRequest) || stock.onHand <= (numberValue(input.minimumStock) ?? current.minimumStock ?? numberValue(input.reorderPoint) ?? current.reorderPoint ?? 0);
    const purchaseRequestNo = text(input.purchaseRequestNo) || (shouldGeneratePurchaseRequest ? current.purchaseRequestNo || `HPR-${Date.now()}` : undefined);
    const item = await prisma.housingInventory.update({
      where: { id },
      data: {
        name: text(input.name) || undefined,
        category: text(input.category) || undefined,
        description: text(input.description) || text(input.notes) || undefined,
        roomId: text(input.roomId) || undefined,
        storeLocation: text(input.storeLocation) || undefined,
        onHand: stock.onHand,
        minimumStock: numberValue(input.minimumStock),
        reorderPoint: numberValue(input.reorderPoint),
        unit: text(input.unit) || undefined,
        unitCost: numberValue(input.unitCost),
        supplierName: text(input.supplierName) || undefined,
        supplierContact: text(input.supplierContact) || undefined,
        preferredSupplier: text(input.preferredSupplier) || text(input.supplierName) || undefined,
        expiryDate: input.expiryDate ? new Date(String(input.expiryDate)) : undefined,
        lastMovementType: stock.movementType,
        lastMovementQty: stock.movementQty,
        lastMovementAt: new Date(),
        lastMovementBy: text(input.movementBy) || actor,
        transferFrom: text(input.transferFrom) || undefined,
        transferTo: text(input.transferTo) || undefined,
        adjustmentReason: text(input.adjustmentReason) || undefined,
        purchaseRequestNo,
        purchaseRequestStatus: text(input.purchaseRequestStatus) || (purchaseRequestNo ? "REQUESTED" : undefined),
        qrCode: text(input.qrCode) || undefined,
      },
    });
    await housingInventoryHistoryAndAlerts(item, current.onHand, stock.movementType, stock.movementQty, input, actor);
    return item;
  }

  if (type === "approval") {
    return updateHousingApproval(id, input, user);
  }

  if (type === "notification") {
    return prisma.housingNotification.update({
      where: { id },
      data: {
        read: Boolean(input.read),
        status: text(input.status) || undefined,
        channel: text(input.channel) || undefined,
        role: text(input.role) || undefined,
        recipient: text(input.recipient) || undefined,
        sentAt: text(input.status) === "SENT" ? new Date() : undefined,
      },
    });
  }

  if (type === "notification-setting") {
    return prisma.housingNotificationSetting.update({
      where: { id },
      data: {
        enabled: booleanValue(input.enabled),
        roles: text(input.roles) || undefined,
        channels: text(input.channels) || undefined,
        leadDays: numberValue(input.leadDays),
        thresholdDays: numberValue(input.thresholdDays),
        severity: text(input.severity) as any,
        description: text(input.description) || text(input.notes) || undefined,
        updatedBy: actor,
      },
    });
  }

  throw new Error(`Unsupported housing record type: ${type}`);
}

async function updateHousingApproval(id: string, input: Record<string, unknown>, user: Awaited<ReturnType<typeof getCurrentUser>>) {
  const actor = user?.name || user?.email || "System";
  const action = (text(input.action) || text(input.status) || "APPROVED").toUpperCase();
  const remarks = text(input.remarks) || text(input.notes) || text(input.comment);
  if (!["APPROVED", "REJECTED", "RETURNED"].includes(action)) throw new Error("Approval action must be approve, reject, or return for correction.");
  const approval = await prisma.housingApproval.findUnique({ where: { id }, include: { booking: true } });
  if (!approval || !approval.bookingId || !approval.booking) throw new Error("Approval record not found.");
  if (approval.status !== "PENDING") throw new Error("Only the current pending approval can be actioned.");
  if (!canActApproval(user?.role || "", approval.level)) throw new Error(`Only ${approval.level} approvers can action this step.`);

  const nextStep = approvalSteps.find((step) => step.step === approval.step + 1);
  const nextStatus = action === "APPROVED" ? "APPROVED" : action === "REJECTED" ? "REJECTED" : "RETURNED";
  const updated = await prisma.$transaction(async (tx) => {
    const currentApproval = await tx.housingApproval.update({
      where: { id },
      data: { status: nextStatus as any, action, remarks, approverName: actor, actedAt: new Date(), approver: actor },
    });
    if (action === "REJECTED") {
      await tx.housingBooking.update({ where: { id: approval.bookingId! }, data: { status: "REJECTED", approvalLevel: approval.level, approvedBy: actor, notes: remarks || approval.booking?.notes || "" } });
      await tx.housingNotification.create({ data: { title: "Housing booking rejected", message: `${approval.booking?.bookingNo} was rejected at ${approval.level}.`, recipient: approval.booking?.requestedBy || "Requester", severity: "HIGH", bookingId: approval.bookingId } });
    } else if (action === "RETURNED") {
      await tx.housingBooking.update({ where: { id: approval.bookingId! }, data: { status: "REQUESTED", approvalLevel: "Requester Correction", notes: remarks || approval.booking?.notes || "" } });
      await tx.housingNotification.create({ data: { title: "Housing booking returned for correction", message: `${approval.booking?.bookingNo} requires correction: ${remarks || "No remarks provided"}.`, recipient: approval.booking?.requestedBy || "Requester", severity: "MEDIUM", bookingId: approval.bookingId } });
    } else if (nextStep) {
      await tx.housingApproval.updateMany({ where: { bookingId: approval.bookingId, step: nextStep.step, status: "WAITING" as any }, data: { status: "PENDING" as any } });
      await tx.housingBooking.update({ where: { id: approval.bookingId! }, data: { status: "PENDING_APPROVAL", approvalLevel: nextStep.level, approvedBy: actor } });
      await tx.housingNotification.create({ data: { title: "Housing booking pending approval", message: `${approval.booking?.bookingNo} is waiting for ${nextStep.level}.`, recipient: nextStep.next || nextStep.level, severity: approval.booking?.priority || "MEDIUM", bookingId: approval.bookingId } });
    } else {
      await tx.housingBooking.update({ where: { id: approval.bookingId! }, data: { status: "APPROVED", approvalLevel: "Reception Allocation", approvedBy: actor } });
      await tx.housingNotification.create({ data: { title: "Housing booking ready for reception allocation", message: `${approval.booking?.bookingNo} has final approval. Reception can check in and hand over room key.`, recipient: "Reception Team", severity: approval.booking?.priority || "MEDIUM", bookingId: approval.bookingId } });
    }
    await tx.housingHistory.create({ data: { entity: "approval", entityId: currentApproval.id, bookingId: approval.bookingId, roomId: approval.booking?.roomId, actor, action: `${approval.level} ${action}`, details: remarks } });
    return currentApproval;
  });
  return updated;
}

function canActApproval(role: string, level: string) {
  const lowerRole = role.toLowerCase();
  const lowerLevel = level.toLowerCase();
  if (lowerRole === "admin" || lowerRole.includes("super admin")) return true;
  if (lowerLevel.includes("coordinator")) return lowerRole.includes("coordinator") || lowerRole.includes("housing");
  if (lowerLevel.includes("supervisor")) return lowerRole.includes("supervisor");
  if (lowerLevel.includes("camp manager")) return lowerRole.includes("camp") || lowerRole.includes("manager");
  if (lowerLevel.includes("reception")) return lowerRole.includes("reception");
  return false;
}

async function deleteHousingRecord(type: string, id: string) {
  if (type === "booking") {
    await expireRoomHolds();
    const booking = await prisma.housingBooking.delete({ where: { id } });
    if (booking.bedId) await prisma.housingBed.update({ where: { id: booking.bedId }, data: { status: "AVAILABLE", occupant: "", occupantId: "" } });
    await refreshRoomOccupancy(booking.roomId);
    return;
  }
  if (type === "room") {
    await deleteHousingRoomWithLinks(id);
    return;
  }
  if (type === "inspection") return void await prisma.housingInspection.delete({ where: { id } });
  if (type === "asset") return void await prisma.housingAsset.delete({ where: { id } });
  if (type === "inventory") return void await prisma.housingInventory.delete({ where: { id } });
  if (type === "approval") return void await prisma.housingApproval.delete({ where: { id } });
  if (type === "notification") return void await prisma.housingNotification.delete({ where: { id } });
  if (type === "notification-setting") return void await prisma.housingNotificationSetting.delete({ where: { id } });
  if (type === "hold") return void await prisma.housingRoomHold.delete({ where: { id } });
  if (type === "property") return void await prisma.housingProperty.delete({ where: { id } });
  if (type === "block") return void await prisma.housingBlock.delete({ where: { id } });
  throw new Error(`Unsupported housing record type: ${type}`);
}

async function deleteHousingRoomWithLinks(id: string) {
  const room = await prisma.housingRoom.findUnique({ where: { id }, select: { id: true, propertyId: true } });
  if (!room) throw new Error("Room not found.");
  const bookings = await prisma.housingBooking.findMany({ where: { roomId: id }, select: { id: true } });
  const bookingIds = bookings.map((booking) => booking.id);

  await prisma.$transaction(async (tx) => {
    if (bookingIds.length) {
      await tx.housingApproval.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await tx.housingNotification.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await tx.housingHistory.deleteMany({ where: { bookingId: { in: bookingIds } } });
    }
    await tx.housingHistory.deleteMany({ where: { roomId: id } });
    await tx.housingRoomHold.deleteMany({ where: { roomId: id } });
    await tx.housingInspection.deleteMany({ where: { roomId: id } });
    await tx.housingBooking.deleteMany({ where: { roomId: id } });
    await tx.housingAsset.updateMany({ where: { roomId: id }, data: { roomId: null, roomLocation: "", buildingLocation: "" } });
    await tx.housingInventory.updateMany({ where: { roomId: id }, data: { roomId: null } });
    await tx.housingBed.deleteMany({ where: { roomId: id } });
    await tx.housingRoom.delete({ where: { id } });
  });
  await refreshHousingPropertyRoomCount(room.propertyId);
}

async function refreshHousingPropertyRoomCount(propertyId: string) {
  const totalRooms = await prisma.housingRoom.count({ where: { propertyId } });
  await prisma.housingProperty.update({ where: { id: propertyId }, data: { totalRooms } });
}

async function refreshRoomOccupancy(roomId: string) {
  const room = await prisma.housingRoom.findUnique({ where: { id: roomId } });
  if (!room) return;
  const occupancy = await prisma.housingBed.count({ where: { roomId, status: { in: ["RESERVED", "OCCUPIED"] as any } } });
  const status = room.status === "MAINTENANCE" || room.status === "BLOCKED" ? room.status : occupancy >= room.capacity ? "OCCUPIED" : occupancy > 0 ? "RESERVED" : "AVAILABLE";
  await prisma.housingRoom.update({ where: { id: roomId }, data: { occupancy, status } });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inventoryStock(input: Record<string, unknown>, currentOnHand: number) {
  const movementType = (text(input.movementType) || "ADJUSTMENT").toUpperCase();
  const movementQty = numberValue(input.movementQty) ?? 0;
  let onHand = numberValue(input.onHand) ?? currentOnHand;
  if (movementQty > 0) {
    if (movementType === "RECEIPT") onHand = currentOnHand + movementQty;
    if (movementType === "ISSUE") onHand = currentOnHand - movementQty;
    if (movementType === "ADJUSTMENT") onHand = movementQty;
  }
  if (onHand < 0) throw new Error("Stock cannot go below zero.");
  return { onHand, movementType, movementQty };
}

async function housingInventoryHistoryAndAlerts(item: any, previousOnHand: number, movementType: string, movementQty: number, input: Record<string, unknown>, actor: string) {
  await prisma.housingHistory.create({ data: { entity: "inventory", entityId: item.id, inventoryId: item.id, roomId: item.roomId, actor, action: `Stock ${movementType.toLowerCase()}`, details: `${item.name}: ${previousOnHand} -> ${item.onHand}${movementQty ? ` (${movementQty})` : ""}` } });
  if (movementType === "TRANSFER") {
    await prisma.housingHistory.create({ data: { entity: "inventory", entityId: item.id, inventoryId: item.id, roomId: item.roomId, actor, action: "Stock transfer", details: `${text(input.transferFrom) || item.transferFrom || "-"} -> ${text(input.transferTo) || item.transferTo || "-"}` } });
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
    await prisma.housingHistory.create({ data: { entity: "inventory", entityId: item.id, inventoryId: item.id, roomId: item.roomId, actor, action: "Purchase request generated", details: `${item.purchaseRequestNo} / ${item.purchaseRequestStatus || "REQUESTED"}` } });
  }
}

async function housingAssetHistory(asset: any, current: any, input: Record<string, unknown>, actor: string) {
  const movement = text(input.movementAction) || "Asset updated";
  await prisma.housingHistory.create({ data: { entity: "asset", entityId: asset.id, assetId: asset.id, roomId: asset.roomId, actor, action: movement, details: `${asset.tag} / ${asset.status}` } });
  if (asset.roomId !== current.roomId) {
    await prisma.housingHistory.create({ data: { entity: "asset", entityId: asset.id, assetId: asset.id, roomId: asset.roomId, actor, action: "Asset room assignment changed", details: `${current.roomId || "-"} -> ${asset.roomId || "-"}` } });
  }
  if (text(input.issuedTo) || input.issuedAt) {
    await prisma.housingHistory.create({ data: { entity: "asset", entityId: asset.id, assetId: asset.id, roomId: asset.roomId, actor, action: "Asset issued", details: text(input.issuedTo) || asset.issuedTo || "" } });
  }
  if (text(input.transferredTo) || input.transferredAt) {
    await prisma.housingHistory.create({ data: { entity: "asset", entityId: asset.id, assetId: asset.id, roomId: asset.roomId, actor, action: "Asset transferred", details: `${text(input.transferredFrom) || current.roomLocation || "-"} -> ${text(input.transferredTo) || asset.roomLocation || "-"}` } });
  }
  if (text(input.replacementOf) || input.replacedAt) {
    await prisma.housingHistory.create({ data: { entity: "asset", entityId: asset.id, assetId: asset.id, roomId: asset.roomId, actor, action: "Asset replacement recorded", details: text(input.replacementOf) || asset.replacementOf || "" } });
  }
  if (["MISSING", "DAMAGED"].includes(String(asset.status || "").toUpperCase())) {
    await prisma.housingHistory.create({ data: { entity: "asset", entityId: asset.id, assetId: asset.id, roomId: asset.roomId, actor, action: `${asset.status} asset tracking`, details: text(input.notes) || text(input.remarks) || asset.description || "" } });
  }
  if (asset.warrantyExpiry && new Date(asset.warrantyExpiry).getTime() <= Date.now() + 30 * 24 * 60 * 60 * 1000) {
    await prisma.housingNotification.create({ data: { title: "Housing asset warranty alert", message: `${asset.tag} warranty expires on ${new Date(asset.warrantyExpiry).toISOString().slice(0, 10)}.`, recipient: "Housing Asset Manager", severity: "HIGH" } });
  }
}

function booleanValue(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  return ["true", "on", "yes", "1"].includes(String(value).toLowerCase());
}

function inspectionChecklist(input: Record<string, unknown>) {
  const keys = [
    "furnitureCondition",
    "mattressCondition",
    "bedSheetCondition",
    "tvCondition",
    "refrigeratorCondition",
    "acCondition",
    "waterLeakageCheck",
    "lightingCondition",
    "curtainCondition",
    "doorLockCondition",
    "smokeDetectorCondition",
    "fireExtinguisherAvailability",
    "bathroomCleanliness",
    "generalRoomCleanliness",
    "missingAssetVerification",
  ];
  return Object.fromEntries(keys.map((key) => [key, text(input[key]) || undefined]).filter(([, value]) => value));
}

async function handleInspectionOutputs(inspection: any, input: Record<string, unknown>, room: any, actor: string) {
  if (booleanValue(input.damageFound)) {
    await prisma.housingHistory.create({ data: { entity: "damage", entityId: inspection.id, inspectionId: inspection.id, roomId: inspection.roomId, actor, action: "Damage record created", details: text(input.damageReport) || text(input.findings) } });
  }
  if (booleanValue(input.missingAssetFound)) {
    const assetId = text(input.assetId);
    if (assetId) {
      await prisma.housingAsset.update({ where: { id: assetId }, data: { status: "MISSING" } });
      await prisma.housingHistory.create({ data: { entity: "asset", entityId: assetId, assetId, roomId: inspection.roomId, actor, action: "Asset marked missing", details: text(input.missingAssetReport) || text(input.missingAssetVerification) } });
    }
    await prisma.housingHistory.create({ data: { entity: "missing-asset", entityId: inspection.id, inspectionId: inspection.id, roomId: inspection.roomId, actor, action: "Missing asset report created", details: text(input.missingAssetReport) || text(input.missingAssetVerification) } });
  }
  if (booleanValue(input.repairRequired) || booleanValue(input.createMaintenanceTicket)) {
    const count = await prisma.serviceRequest.count();
    const request = await prisma.serviceRequest.create({
      data: {
        ticketNo: `SR-${String(count + 24001).padStart(5, "0")}`,
        title: `Housing repair required - ${room.roomNumber}`,
        category: "Housing Maintenance",
        departmentCode: "HOUSING",
        requester: actor,
        channel: "Inspection",
        priority: text(input.priority) as any || "MEDIUM",
        status: "NEW",
        location: `${room.property?.name || "Housing"} / ${room.block?.name || ""} / ${room.roomNumber}`,
        attachmentUrls: [text(input.beforePhotoUrls), text(input.afterPhotoUrls), text(input.photoUrls), text(input.attachmentUrls)].filter(Boolean).join(","),
        slaHours: 24,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        description: [text(input.damageReport), text(input.missingAssetReport), text(input.findings), `Estimated repair cost: SAR ${numberValue(input.estimatedRepairCost) || 0}`, `Occupant liability: ${text(input.occupantLiability) || "-"}`].filter(Boolean).join("\n"),
      },
    });
    await prisma.housingInspection.update({ where: { id: inspection.id }, data: { maintenanceTicketNo: request.ticketNo } });
    await prisma.housingHistory.create({ data: { entity: "inspection", entityId: inspection.id, inspectionId: inspection.id, roomId: inspection.roomId, actor, action: "Converted to maintenance ticket", details: request.ticketNo } });
  }
}
async function expireRoomHolds() {
  await prisma.housingRoomHold.updateMany({ where: { status: "ACTIVE", endDate: { lt: new Date() } }, data: { status: "EXPIRED" } });
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
  if (overlap) throw new Error(`Room ${overlap.room.roomNumber} is already on hold from ${overlap.startDate.toISOString().slice(0, 10)} to ${overlap.endDate.toISOString().slice(0, 10)}.`);
}

async function assertNoOverlappingBooking(roomId: string, start: Date, end: Date) {
  const overlap = await prisma.housingBooking.findFirst({
    where: {
      roomId,
      status: { in: ["REQUESTED", "PENDING_APPROVAL", "APPROVED", "CHECKED_IN"] as any },
      checkIn: { lte: end },
      OR: [{ checkOut: null }, { checkOut: { gte: start } }],
    },
  });
  if (overlap) throw new Error(`Room already has booking ${overlap.bookingNo} overlapping this hold period.`);
}



