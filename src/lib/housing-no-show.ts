import { prisma } from "@/lib/prisma";

const noShowEligibleStatuses = ["REQUESTED", "PENDING_APPROVAL", "APPROVED"];
const activeBookingStatuses = ["REQUESTED", "PENDING_APPROVAL", "APPROVED", "CHECKED_IN"];
const closedBookingStatuses = ["CHECKED_OUT", "REJECTED", "CANCELLED", "NO_SHOW", "TRANSFERRED"];
const activeExtensionStatuses = ["EXTEND_PENDING", "EXTENDED"];
const fixedRoomStatuses = ["MAINTENANCE", "BLOCKED"];

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean).map(String)));
}

function chunk<T>(rows: T[], size = 500) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

export async function convertExpiredUncheckedHousingBookingsToNoShow(actor = "System") {
  const now = new Date();
  const expiredReservations = await prisma.housingBooking.findMany({
    where: {
      status: { in: noShowEligibleStatuses as any },
      checkOut: { lte: now },
    },
    select: {
      id: true,
      bookingNo: true,
      residentName: true,
      roomId: true,
      bedId: true,
      checkOut: true,
      priority: true,
      requestedBy: true,
      status: true,
    },
  });

  if (!expiredReservations.length) return { updated: 0, roomIds: [] as string[] };

  const bookingIds = expiredReservations.map((booking) => booking.id);
  const previousStatusByBookingId = new Map(expiredReservations.map((booking) => [booking.id, booking.status]));

  const noShowResult = await prisma.$transaction(async (tx) => {
    const result = await tx.housingBooking.updateMany({
      where: {
        id: { in: bookingIds },
        status: { in: noShowEligibleStatuses as any },
        checkOut: { lte: now },
      },
      data: {
        status: "NO_SHOW" as any,
        noShowAt: now,
        extensionStatus: "",
        extensionEndDate: null,
      },
    });

    if (!result.count) return { updated: 0, roomIds: [] as string[] };

    const updatedReservations = await tx.housingBooking.findMany({
      where: {
        id: { in: bookingIds },
        status: "NO_SHOW" as any,
        noShowAt: now,
      },
      select: {
        id: true,
        bookingNo: true,
        residentName: true,
        roomId: true,
        bedId: true,
        checkOut: true,
        priority: true,
        requestedBy: true,
        status: true,
      },
    });
    const roomIds = uniqueStrings(updatedReservations.map((booking) => booking.roomId));
    const bedIds = uniqueStrings(updatedReservations.map((booking) => booking.bedId));

    if (bedIds.length) {
      await tx.housingBed.updateMany({
        where: { id: { in: bedIds } },
        data: { status: "AVAILABLE" as any, occupant: "", occupantId: "" },
      });
    }

    for (const batch of chunk(updatedReservations)) {
      await tx.housingHistory.createMany({
        data: batch.map((booking) => ({
          entity: "booking",
          entityId: booking.id,
          bookingId: booking.id,
          roomId: booking.roomId,
          actor,
          action: "Reservation marked No Show",
          details: `End date reached without check-in. Previous status: ${previousStatusByBookingId.get(booking.id) || booking.status}. End date: ${booking.checkOut?.toISOString() || ""}.`,
        })),
      });
      await tx.housingNotification.createMany({
        data: batch.map((booking) => ({
          alertType: "NO_SHOW",
          channel: "SYSTEM",
          role: "Housing Supervisor",
          title: "Housing reservation no-show",
          message: `${booking.bookingNo} for ${booking.residentName} reached the end date without check-in.`,
          severity: (booking.priority || "HIGH") as any,
          recipient: "Housing Supervisor",
          status: "SENT",
          entity: "booking",
          entityId: booking.id,
          bookingId: booking.id,
          queuedAt: now,
          sentAt: now,
          deliveryRef: `SYSTEM:NO_SHOW:${booking.id}:${now.getTime()}`,
        })),
      });
    }

    return { updated: result.count, roomIds };
  });

  for (const roomId of noShowResult.roomIds) {
    await refreshHousingRoomAvailability(roomId);
  }

  return noShowResult;
}

export async function refreshHousingRoomAvailability(roomId: string) {
  const room = await prisma.housingRoom.findUnique({
    where: { id: roomId },
    include: { beds: true },
  });
  if (!room) return null;

  const storedStatus = String(room.status || "").toUpperCase();
  if (fixedRoomStatuses.includes(storedStatus)) return room;

  const activeBookings = await prisma.housingBooking.findMany({
    where: {
      roomId,
      status: { notIn: closedBookingStatuses as any },
      OR: [
        { status: { in: activeBookingStatuses as any } },
        { extensionStatus: { in: activeExtensionStatuses as any } },
      ],
    },
    select: { id: true, status: true, bedId: true },
  });

  const activeBedIds = new Set(activeBookings.map((booking) => booking.bedId).filter(Boolean).map(String));
  const staleBedIds = room.beds
    .filter((bed) => ["RESERVED", "OCCUPIED"].includes(String(bed.status || "").toUpperCase()) && !activeBedIds.has(bed.id))
    .map((bed) => bed.id);

  if (staleBedIds.length) {
    await prisma.housingBed.updateMany({
      where: { id: { in: staleBedIds } },
      data: { status: "AVAILABLE" as any, occupant: "", occupantId: "" },
    });
  }

  const usableBeds = room.beds.filter((bed) => !staleBedIds.includes(bed.id));
  const reservedOrOccupiedBeds = usableBeds.filter((bed) =>
    ["RESERVED", "OCCUPIED"].includes(String(bed.status || "").toUpperCase()),
  );
  const hasOccupiedBed = usableBeds.some((bed) => String(bed.status || "").toUpperCase() === "OCCUPIED");
  const hasCheckedInBooking = activeBookings.some((booking) => String(booking.status || "").toUpperCase() === "CHECKED_IN");
  const hasActiveHold = await prisma.housingRoomHold.count({
    where: {
      roomId,
      status: "ACTIVE",
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
  });

  const usedCapacity = Math.max(reservedOrOccupiedBeds.length, activeBookings.length);
  const capacity = Number(room.capacity || 0);
  const occupancy = Math.min(capacity || usedCapacity, usedCapacity);
  const status =
    hasCheckedInBooking || hasOccupiedBed
      ? "OCCUPIED"
      : activeBookings.length || reservedOrOccupiedBeds.length || hasActiveHold
        ? "RESERVED"
        : "AVAILABLE";

  return prisma.housingRoom.update({
    where: { id: roomId },
    data: { occupancy, status: status as any },
  });
}
