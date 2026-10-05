type BookingLike = {
  id?: string | null;
  bookingNo?: string | null;
  employeeId?: string | null;
  residentName?: string | null;
  departmentCode?: string | null;
  companyName?: string | null;
  contactNumber?: string | null;
  roomNumber?: string | null;
  bedNumber?: string | null;
  bookingType?: string | null;
  status?: string | null;
  priority?: string | null;
  checkIn?: Date | string | null;
  checkOut?: Date | string | null;
  room?: {
    roomNumber?: string | null;
    roomType?: string | null;
    floor?: string | null;
    block?: { name?: string | null } | null;
    property?: { name?: string | null } | null;
  } | null;
  bed?: { label?: string | null } | null;
  resident?: {
    residentNo?: string | null;
    companyName?: string | null;
    phone?: string | null;
  } | null;
};

export type HousekeepingMovementRow = {
  reportType: string;
  dueStatus: string;
  bookingNo: string;
  guestId: string;
  guestName: string;
  company: string;
  department: string;
  contactNumber: string;
  property: string;
  building: string;
  floor: string;
  roomNumber: string;
  bedNumber: string;
  roomType: string;
  bookingType: string;
  checkIn: string;
  checkOut: string;
  status: string;
  priority: string;
};

const reservedArrivalStatuses = new Set(["APPROVED", "RESERVED"]);
const departureReportStatuses = new Set(["CHECKED_IN"]);
const checkedOutStatuses = new Set([
  "CHECKED_OUT",
]);

export function expectedArrivalReportRows(
  bookings: BookingLike[],
  now = new Date(),
) {
  const today = dayKey(now);
  const todayEnd = endOfDay(today).getTime();
  return bookings
    .filter((booking) => {
      const start = dateTime(booking.checkIn);
      if (!Number.isFinite(start) || start > todayEnd) return false;
      return reservedArrivalStatuses.has(normalizedStatus(booking.status));
    })
    .map((booking) =>
      movementRow(
        booking,
        "Expected Arrival",
        dayKey(booking.checkIn) < today ? "OVERDUE_ARRIVAL" : "ARRIVING_TODAY",
      ),
    )
    .sort(sortByCheckIn);
}

export function expectedDepartureReportRows(
  bookings: BookingLike[],
  now = new Date(),
) {
  const today = dayKey(now);
  const todayEnd = endOfDay(today).getTime();
  return bookings
    .filter((booking) => {
      const end = dateTime(booking.checkOut);
      if (!Number.isFinite(end) || end > todayEnd) return false;
      return departureReportStatuses.has(normalizedStatus(booking.status));
    })
    .map((booking) =>
      movementRow(
        booking,
        "Expected Departure",
        dayKey(booking.checkOut) < today
          ? "OVERDUE_DEPARTURE"
          : "DEPARTING_TODAY",
      ),
    )
    .sort(sortByCheckOut);
}

export function checkedOutReportRows(
  bookings: BookingLike[],
  dateFrom = "",
  dateTo = "",
) {
  return bookings
    .filter((booking) => {
      if (!checkedOutStatuses.has(normalizedStatus(booking.status))) return false;
      return dateInRange(booking.checkOut, dateFrom, dateTo);
    })
    .map((booking) => {
      const row = movementRow(booking, "Checked Out", "CHECKED_OUT");
      return {
        ...row,
        checkIn: monthDateValue(booking.checkIn),
        checkOut: monthDateValue(booking.checkOut),
      };
    })
    .sort(sortByCheckOut);
}

function movementRow(
  booking: BookingLike,
  reportType: string,
  dueStatus: string,
): HousekeepingMovementRow {
  return {
    reportType,
    dueStatus,
    bookingNo: String(booking.bookingNo || ""),
    guestId: String(
      booking.employeeId || booking.resident?.residentNo || "",
    ),
    guestName: String(booking.residentName || ""),
    company: String(booking.companyName || booking.resident?.companyName || ""),
    department: String(booking.departmentCode || ""),
    contactNumber: String(
      booking.contactNumber || booking.resident?.phone || "",
    ),
    property: String(booking.room?.property?.name || ""),
    building: String(booking.room?.block?.name || ""),
    floor: String(booking.room?.floor || ""),
    roomNumber: String(booking.roomNumber || booking.room?.roomNumber || ""),
    bedNumber: String(booking.bedNumber || booking.bed?.label || ""),
    roomType: String(booking.room?.roomType || ""),
    bookingType: String(booking.bookingType || ""),
    checkIn: monthDateValue(booking.checkIn),
    checkOut: monthDateValue(booking.checkOut),
    status: String(booking.status || ""),
    priority: String(booking.priority || ""),
  };
}

function sortByCheckIn(left: HousekeepingMovementRow, right: HousekeepingMovementRow) {
  return dateTime(left.checkIn) - dateTime(right.checkIn);
}

function sortByCheckOut(left: HousekeepingMovementRow, right: HousekeepingMovementRow) {
  return dateTime(left.checkOut) - dateTime(right.checkOut);
}

function normalizedStatus(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function dateTime(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  const time = date.getTime();
  return Number.isNaN(time) ? Number.NaN : time;
}

function isoValue(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function monthDateValue(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Riyadh",
  });
}

function dayKey(value: unknown) {
  return isoValue(value).slice(0, 10);
}

function endOfDay(key: string) {
  return new Date(`${key}T23:59:59.999`);
}

function dateInRange(value: unknown, dateFrom: string, dateTo: string) {
  const time = dateTime(value);
  if (!Number.isFinite(time)) return false;
  if (dateFrom && time < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
  if (dateTo && time > new Date(`${dateTo}T23:59:59.999`).getTime()) return false;
  return true;
}
