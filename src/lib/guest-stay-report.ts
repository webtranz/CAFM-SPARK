import { prisma } from "@/lib/prisma";

type ReportRow = Record<string, string | number | boolean | null>;

export async function guestStayReportRows(): Promise<ReportRow[]> {
  const rows = await prisma.housingBooking.findMany({
    include: { room: { include: { property: true, block: true } }, resident: true },
    orderBy: { createdAt: "desc" },
  });

  return rows
    .filter((row) => ["CHECKED_IN", "APPROVED"].includes(String(row.status || "").toUpperCase()))
    .map((row) => ({
      LCF_LEASENAME: row.room.property.name,
      "Lease Status": "Definite",
      LCF_LEASENUMBER: row.bookingNo,
      Name: row.residentName,
      "Start Date": reportDateValue(row.checkIn),
      "End Date": reportDateValue(row.checkOut),
      LCF_ROOM: row.roomNumber ?? row.room.roomNumber,
      "Market Segment": row.allocationType || row.bookingType,
      "Market segment name": row.companyName ?? row.resident?.companyName ?? row.departmentCode ?? "",
      "Reservation No.": row.bookingNo,
      "Guest Stay status": String(row.status).toUpperCase() === "CHECKED_IN" ? "In-House" : "Reserved",
    }));
}

export function csv(rows: ReportRow[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
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
