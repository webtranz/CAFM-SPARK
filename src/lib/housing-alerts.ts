import { prisma } from "@/lib/prisma";
import { convertExpiredUncheckedHousingBookingsToNoShow } from "@/lib/housing-no-show";

export const HOUSING_ALERT_SETTINGS = [
  ["UPCOMING_CHECKOUT", "Upcoming check-out", "Residents scheduled to check out soon.", "Housing Supervisor,Reception Team", "SYSTEM,EMAIL"],
  ["NEW_RESERVATION", "New reservation", "New housing reservations requiring review or room preparation.", "Housing Supervisor,Reception Team,Housekeeping", "SYSTEM,EMAIL"],
  ["CHECK_IN", "Check-in completed", "Guests checked in and now in-house.", "Housing Supervisor,Reception Team,Housekeeping", "SYSTEM"],
  ["CHECK_OUT", "Check-out completed", "Guests checked out and rooms may need housekeeping action.", "Housing Supervisor,Reception Team,Housekeeping", "SYSTEM"],
  ["SERVICE_REQUEST", "Housekeeping service request", "New or updated housekeeping service requests.", "Housekeeping,Helpdesk,Housing Supervisor", "SYSTEM,EMAIL"],
  ["ROOM_CHANGE", "Room swap or change", "Guest room swaps or room changes that need room follow-up.", "Housekeeping,Reception Team,Housing Supervisor", "SYSTEM"],
  ["OVERSTAY_OCCUPANT", "Overstay occupants", "Occupants past their planned check-out date.", "Housing Supervisor,Camp Manager", "SYSTEM,EMAIL,SMS"],
  ["VACANT_ROOM", "Vacant room availability", "Vacant rooms ready for allocation.", "Housing Coordinator,Reception Team", "SYSTEM"],
  ["MAINTENANCE_DUE", "Maintenance due date", "Housing inspections or maintenance tasks due soon.", "Housing Supervisor,Maintenance Team", "SYSTEM,EMAIL"],
  ["PPM_SCHEDULE", "Preventive maintenance schedule", "Housing assets with PPM due soon.", "Housing Supervisor,Maintenance Team", "SYSTEM,EMAIL"],
  ["MISSING_ASSET", "Missing assets", "Housing assets marked missing.", "Housing Asset Manager,Housing Supervisor", "SYSTEM,EMAIL"],
  ["DAMAGED_ASSET", "Damaged assets", "Housing assets marked damaged.", "Housing Asset Manager,Housing Supervisor", "SYSTEM,EMAIL"],
  ["LOW_STOCK", "Low stock inventory", "Housing inventory below reorder or minimum stock.", "Housing Inventory Manager,Housing Supervisor", "SYSTEM,EMAIL"],
  ["EXPIRED_FIRE_EXTINGUISHER", "Expired fire extinguishers", "Fire extinguishers with expired warranty or inspection date.", "Safety Officer,Housing Supervisor", "SYSTEM,EMAIL,SMS"],
  ["EXPIRED_CONTRACT", "Expired contracts", "Housing supplier or booking contract references requiring review.", "Camp Manager,Housing Supervisor", "SYSTEM,EMAIL"],
  ["NO_SHOW", "No-show reservations", "Reservations whose end date has passed without check-in.", "Housing Supervisor,Reception Team", "SYSTEM,EMAIL"],
  ["EXPIRED_WARRANTY", "Expired warranties", "Housing assets with expired warranties.", "Housing Asset Manager", "SYSTEM,EMAIL"],
  ["UNRESOLVED_COMPLAINT", "Unresolved complaints", "Housing-related service requests still unresolved.", "Helpdesk,Housing Supervisor", "SYSTEM,EMAIL"],
  ["DELAYED_TICKET_CLOSURE", "Delayed ticket closure", "Housing tickets past SLA due date.", "Helpdesk,Housing Supervisor", "SYSTEM,EMAIL,SMS"],
  ["PENDING_APPROVAL", "Pending approvals", "Housing approvals waiting for action.", "Housing Coordinator,Housing Supervisor,Camp Manager,Reception Team", "SYSTEM,EMAIL"],
] as const;

export async function ensureHousingNotificationSettings() {
  const rows = await Promise.all(
    HOUSING_ALERT_SETTINGS.map(([alertType, label, description, roles, channels]) =>
      prisma.housingNotificationSetting.upsert({
        where: { alertType },
        update: {},
        create: { alertType, label, description, roles, channels, enabled: true },
      }),
    ),
  );
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}

export async function runHousingAlertChecks(actor = "Housing Alert Scheduler") {
  const settings = await ensureHousingNotificationSettings();
  await convertExpiredUncheckedHousingBookingsToNoShow(actor);
  const settingMap = new Map(settings.map((setting) => [setting.alertType, setting]));
  const now = new Date();
  const created: any[] = [];

  const pushAlert = async (alertType: string, title: string, message: string, entity: string, entityId: string, severity?: string, bookingId?: string | null) => {
    const setting = settingMap.get(alertType);
    if (!setting?.enabled) return;
    const channels = splitList(setting.channels || "SYSTEM");
    const roles = splitList(setting.roles || "Admin");
    for (const role of roles) {
      for (const channel of channels) {
        const exists = await prisma.housingNotification.findFirst({
          where: { alertType, entity, entityId, channel, role, createdAt: { gte: startOfDay(now) } },
        });
        if (exists) continue;
        const notification = await prisma.housingNotification.create({
          data: {
            alertType,
            channel,
            role,
            title,
            message,
            severity: (severity || setting.severity || "MEDIUM") as any,
            recipient: role,
            entity,
            entityId,
            bookingId: bookingId || undefined,
            status: channel === "SYSTEM" ? "SENT" : "QUEUED",
            queuedAt: now,
            sentAt: channel === "SYSTEM" ? now : undefined,
            deliveryRef: `${channel}:${alertType}:${entityId}`,
          },
        });
        created.push(notification);
      }
    }
  };

  const checkoutSetting = settingMap.get("UPCOMING_CHECKOUT");
  const checkoutLeadDate = addDays(now, checkoutSetting?.leadDays ?? 3);
  const upcomingCheckouts = await prisma.housingBooking.findMany({
    where: { status: { in: ["APPROVED", "CHECKED_IN"] as any }, checkOut: { gte: now, lte: checkoutLeadDate } },
    include: { room: true },
  });
  for (const booking of upcomingCheckouts) {
    await pushAlert("UPCOMING_CHECKOUT", "Upcoming housing check-out", `${booking.residentName} is scheduled to check out from ${booking.roomNumber || booking.room?.roomNumber} on ${booking.checkOut?.toISOString().slice(0, 10)}.`, "booking", booking.id, booking.priority, booking.id);
  }

  const overstays = await prisma.housingBooking.findMany({
    where: { status: { in: ["APPROVED", "CHECKED_IN"] as any }, checkOut: { lt: now } },
    include: { room: true },
  });
  for (const booking of overstays) {
    await pushAlert("OVERSTAY_OCCUPANT", "Housing overstay occupant", `${booking.residentName} is past check-out date ${booking.checkOut?.toISOString().slice(0, 10)} in ${booking.roomNumber || booking.room?.roomNumber}.`, "booking", booking.id, "HIGH", booking.id);
  }

  const vacantRooms = await prisma.housingRoom.findMany({ where: { status: "AVAILABLE" as any, occupancy: 0 }, take: 50 });
  if (vacantRooms.length) {
    await pushAlert("VACANT_ROOM", "Vacant housing rooms available", `${vacantRooms.length} rooms are vacant and ready for allocation.`, "room", "vacant-summary", "LOW");
  }

  const maintenanceLeadDate = addDays(now, settingMap.get("MAINTENANCE_DUE")?.leadDays ?? 3);
  const inspections = await prisma.housingInspection.findMany({ where: { status: { notIn: ["PASSED", "CLOSED"] as any }, dueAt: { lte: maintenanceLeadDate } }, include: { room: true } });
  for (const inspection of inspections) {
    await pushAlert("MAINTENANCE_DUE", "Housing maintenance due", `${inspection.inspectionNo} for room ${inspection.room?.roomNumber || inspection.roomId} is due on ${inspection.dueAt.toISOString().slice(0, 10)}.`, "inspection", inspection.id, inspection.dueAt < now ? "HIGH" : "MEDIUM");
  }

  const ppmLeadDate = addDays(now, settingMap.get("PPM_SCHEDULE")?.leadDays ?? 7);
  const ppmAssets = await prisma.housingAsset.findMany({ where: { nextPmDue: { lte: ppmLeadDate } } });
  for (const asset of ppmAssets) {
    await pushAlert("PPM_SCHEDULE", "Housing asset PPM due", `${asset.tag} / ${asset.name} PPM is due on ${asset.nextPmDue?.toISOString().slice(0, 10)}.`, "asset", asset.id, asset.nextPmDue && asset.nextPmDue < now ? "HIGH" : "MEDIUM");
  }

  const missingAssets = await prisma.housingAsset.findMany({ where: { status: "MISSING" } });
  for (const asset of missingAssets) await pushAlert("MISSING_ASSET", "Housing asset missing", `${asset.tag} / ${asset.name} is marked missing.`, "asset", asset.id, "HIGH");

  const damagedAssets = await prisma.housingAsset.findMany({ where: { status: "DAMAGED" } });
  for (const asset of damagedAssets) await pushAlert("DAMAGED_ASSET", "Housing asset damaged", `${asset.tag} / ${asset.name} is marked damaged.`, "asset", asset.id, "HIGH");

  const lowStock = await prisma.housingInventory.findMany({ where: { OR: [{ onHand: { lte: 0 } }, { purchaseRequestStatus: "REQUESTED" }] } });
  const allInventory = await prisma.housingInventory.findMany();
  for (const item of [...lowStock, ...allInventory.filter((item) => item.onHand <= item.minimumStock || item.onHand <= item.reorderPoint)]) {
    await pushAlert("LOW_STOCK", "Housing inventory low stock", `${item.name} is at ${item.onHand} ${item.unit}. Minimum ${item.minimumStock}, reorder ${item.reorderPoint}.`, "inventory", item.id, item.onHand <= item.minimumStock ? "HIGH" : "MEDIUM");
  }

  const extinguishers = await prisma.housingAsset.findMany({ where: { category: { contains: "Fire", mode: "insensitive" }, OR: [{ warrantyExpiry: { lt: now } }, { nextPmDue: { lt: now } }] } });
  for (const asset of extinguishers) await pushAlert("EXPIRED_FIRE_EXTINGUISHER", "Expired fire extinguisher", `${asset.tag} / ${asset.name} requires safety expiry review.`, "asset", asset.id, "HIGH");

  const expiredWarranties = await prisma.housingAsset.findMany({ where: { warrantyExpiry: { lt: now } } });
  for (const asset of expiredWarranties) await pushAlert("EXPIRED_WARRANTY", "Housing asset warranty expired", `${asset.tag} / ${asset.name} warranty expired on ${asset.warrantyExpiry?.toISOString().slice(0, 10)}.`, "asset", asset.id, "MEDIUM");

  const contractLikeBookings = await prisma.housingBooking.findMany({ where: { bookingType: { contains: "CONTRACT", mode: "insensitive" }, checkOut: { lt: now }, status: { notIn: ["CHECKED_OUT", "CANCELLED", "REJECTED"] as any } } });
  for (const booking of contractLikeBookings) await pushAlert("EXPIRED_CONTRACT", "Housing contract expired", `${booking.bookingNo} contract/long-stay allocation requires renewal review.`, "booking", booking.id, "HIGH", booking.id);

  const complaints = await prisma.serviceRequest.findMany({ where: { OR: [{ category: { contains: "Housing", mode: "insensitive" } }, { departmentCode: "HOUSING" }], status: { notIn: ["CLOSED", "REJECTED"] as any } }, take: 100 });
  for (const request of complaints) {
    await pushAlert("UNRESOLVED_COMPLAINT", "Unresolved housing complaint", `${request.ticketNo} / ${request.title} is still ${request.status}.`, "service-request", request.id, request.priority);
    if (request.dueAt < now) await pushAlert("DELAYED_TICKET_CLOSURE", "Delayed housing ticket closure", `${request.ticketNo} passed SLA due date ${request.dueAt.toISOString().slice(0, 10)}.`, "service-request", request.id, "HIGH");
  }

  const pendingApprovals = await prisma.housingApproval.findMany({ where: { status: "PENDING" as any }, include: { booking: true } });
  for (const approval of pendingApprovals) {
    await pushAlert("PENDING_APPROVAL", "Housing approval pending", `${approval.level} is pending for ${approval.booking?.bookingNo || approval.entityId}.`, "approval", approval.id, "MEDIUM", approval.bookingId);
  }

  if (created.length) {
    await prisma.housingHistory.create({ data: { entity: "notification", entityId: "daily-alert-check", actor, action: "Daily housing alert check", details: `${created.length} notifications queued/generated.` } });
  }

  return { created: created.length, settings: settings.length };
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

