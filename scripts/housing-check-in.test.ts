import assert from "node:assert/strict";
import { checkInHousingBookings } from "../src/lib/housing-check-in";

async function main() {
  const bookings = [{ id: "1", bookingNo: "HBK-1" }, { id: "2", bookingNo: "HBK-2" }];
  const mixed = await checkInHousingBookings(bookings, async (id) => id === "1"
    ? { ok: true, result: { status: "CHECKED_IN" } }
    : { ok: false, result: { message: "Room is on hold." } });
  assert.match(mixed, /^1 of 2/);
  assert.match(mixed, /HBK-2: Room is on hold/);
  const failed = await checkInHousingBookings(bookings, async () => { throw new Error("Network error"); });
  assert.match(failed, /^0 of 2/);
  assert.match(failed, /HBK-1: Network error/);
  const unconfirmed = await checkInHousingBookings(bookings, async () => ({ ok: true, result: { status: "APPROVED" } }));
  assert.match(unconfirmed, /^0 of 2/);
  const success = await checkInHousingBookings(bookings, async () => ({ ok: true, result: { status: "CHECKED_IN" } }));
  assert.equal(success, "2 of 2 booking(s) checked in.");
  console.log("Check-in success, rejection, network failure and unconfirmed-result tests passed.");
}
void main();
