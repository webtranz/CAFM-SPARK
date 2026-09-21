import { prisma } from "@/lib/prisma";

type ReportRow = Record<string, string | number | boolean | null>;

const headers = ["ID", "Name", "Room", "Department", "Start date", "End date", "Guest stay status"];

export async function guestStayReportRows(): Promise<ReportRow[]> {
  const rows = await prisma.housingBooking.findMany({
    include: { room: { include: { property: true, block: true } }, resident: true },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
      ID: row.employeeId ?? row.resident?.residentNo ?? row.bookingNo,
      Name: row.residentName,
      Room: row.roomNumber ?? row.room.roomNumber,
      Department: row.departmentCode ?? "",
      "Start date": reportDateValue(row.checkIn),
      "End date": reportDateValue(row.checkOut),
      "Guest stay status": guestStayStatus(row.status),
    }));
}

export function csv(rows: ReportRow[]) {
  return [headers.join(","), ...rows.map((row) => headers.map((header) => quote(row[header])).join(","))].join("\n");
}

function quote(value: unknown) {
  return `"${spreadsheetSafeValue(value).replaceAll('"', '""')}"`;
}

function spreadsheetSafeValue(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function reportDateValue(value: Date | null | undefined) {
  if (!value) return "";
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = String(value.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

function guestStayStatus(status: string) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "CHECKED_IN") return "In-house";
  if (normalized === "APPROVED" || normalized === "RESERVED") return "Reserved";
  if (normalized === "CHECKED_OUT") return "Checked out";
  if (normalized === "PENDING_APPROVAL") return "Pending approval";
  if (normalized === "REQUESTED") return "Requested";
  if (normalized === "NO_SHOW") return "No show";
  return normalized ? normalized.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
}
