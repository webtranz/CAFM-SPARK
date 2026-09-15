import assert from "node:assert/strict";
import {
  checkedOutReportRows,
  expectedArrivalReportRows,
  expectedDepartureReportRows,
} from "../src/lib/housekeeping-reports";

const now = new Date("2026-09-15T12:00:00.000Z");

const bookings = [
  {
    bookingNo: "HBK-TODAY-ARRIVAL",
    residentName: "Today Arrival",
    status: "APPROVED",
    checkIn: new Date("2026-09-15T08:00:00.000Z"),
    checkOut: new Date("2026-09-20T08:00:00.000Z"),
    roomId: "room-1",
  },
  {
    bookingNo: "HBK-OVERDUE-ARRIVAL",
    residentName: "Overdue Arrival",
    status: "APPROVED",
    checkIn: new Date("2026-09-14T08:00:00.000Z"),
    checkOut: new Date("2026-09-20T08:00:00.000Z"),
    roomId: "room-2",
  },
  {
    bookingNo: "HBK-FUTURE-ARRIVAL",
    residentName: "Future Arrival",
    status: "APPROVED",
    checkIn: new Date("2026-09-16T08:00:00.000Z"),
    checkOut: new Date("2026-09-20T08:00:00.000Z"),
    roomId: "room-3",
  },
  {
    bookingNo: "HBK-IN-HOUSE",
    residentName: "In House",
    status: "CHECKED_IN",
    checkIn: new Date("2026-09-14T08:00:00.000Z"),
    checkOut: new Date("2026-09-15T18:00:00.000Z"),
    roomId: "room-4",
  },
  {
    bookingNo: "HBK-OVERDUE-DEPARTURE",
    residentName: "Overdue Departure",
    status: "CHECKED_IN",
    checkIn: new Date("2026-09-10T08:00:00.000Z"),
    checkOut: new Date("2026-09-14T18:00:00.000Z"),
    roomId: "room-5",
  },
  {
    bookingNo: "HBK-YESTERDAY-CHECKOUT",
    residentName: "Yesterday Checkout",
    status: "CHECKED_OUT",
    checkIn: new Date("2026-09-10T08:00:00.000Z"),
    checkOut: new Date("2026-09-14T18:00:00.000Z"),
    roomId: "room-6",
  },
  {
    bookingNo: "HBK-TODAY-CHECKOUT",
    residentName: "Today Checkout",
    status: "CHECKED_OUT",
    checkIn: new Date("2026-09-10T08:00:00.000Z"),
    checkOut: new Date("2026-09-15T18:00:00.000Z"),
    roomId: "room-7",
  },
];

assert.deepEqual(
  expectedArrivalReportRows(bookings, now).map((row) => [
    row.bookingNo,
    row.dueStatus,
  ]),
  [
    ["HBK-OVERDUE-ARRIVAL", "OVERDUE_ARRIVAL"],
    ["HBK-TODAY-ARRIVAL", "ARRIVING_TODAY"],
  ],
);

assert.deepEqual(
  expectedDepartureReportRows(bookings, now).map((row) => [
    row.bookingNo,
    row.dueStatus,
  ]),
  [
    ["HBK-OVERDUE-DEPARTURE", "OVERDUE_DEPARTURE"],
    ["HBK-IN-HOUSE", "DEPARTING_TODAY"],
  ],
);

assert.deepEqual(
  checkedOutReportRows(bookings, "2026-09-14", "2026-09-14").map(
    (row) => row.bookingNo,
  ),
  ["HBK-YESTERDAY-CHECKOUT"],
);

console.log("housekeeping report rules passed");
