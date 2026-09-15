import { prisma } from "@/lib/prisma";

type HousingNotificationInput = {
  alertType: string;
  title: string;
  message: string;
  recipient: string;
  role?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string | null;
  entity?: string | null;
  entityId?: string | null;
  bookingId?: string | null;
};

export async function createHousingEventNotification(input: HousingNotificationInput) {
  try {
    return await prisma.housingNotification.create({
      data: {
        alertType: input.alertType,
        channel: "SYSTEM",
        role: input.role || input.recipient,
        title: input.title,
        message: input.message,
        recipient: input.recipient,
        severity: (input.severity || "MEDIUM") as any,
        entity: input.entity || undefined,
        entityId: input.entityId || undefined,
        bookingId: input.bookingId || undefined,
        status: "SENT",
        queuedAt: new Date(),
        sentAt: new Date(),
        deliveryRef: `SYSTEM:${input.alertType}:${input.entity || "event"}:${input.entityId || input.bookingId || Date.now()}`,
      },
    });
  } catch (error) {
    console.error("Unable to create housing notification", error);
    return null;
  }
}

export function housingBookingEventMessage(booking: {
  bookingNo?: string | null;
  residentName?: string | null;
  roomNumber?: string | null;
  room?: { roomNumber?: string | null } | null;
}) {
  return `${booking.bookingNo || "Booking"} for ${booking.residentName || "guest"} in room ${booking.roomNumber || booking.room?.roomNumber || "unassigned"}`;
}
