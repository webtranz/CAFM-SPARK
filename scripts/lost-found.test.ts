import assert from "node:assert/strict";
import {
  FOUND_ITEM_OPEN_STATUS,
  lostFoundReturnDateForStatus,
  normalizeLostFoundCaseType,
  normalizeLostFoundStatus,
} from "../src/lib/lost-found";

const now = new Date("2026-09-17T09:00:00.000Z");

assert.equal(normalizeLostFoundCaseType("lost"), "LOST");
assert.equal(normalizeLostFoundCaseType("FOUND"), "FOUND");
assert.throws(() => normalizeLostFoundCaseType("other"), (error: any) => error.status === 400);

assert.equal(normalizeLostFoundStatus("LOST", ""), "Never Found");
assert.equal(normalizeLostFoundStatus("LOST", "Returned"), "Returned");
assert.throws(() => normalizeLostFoundStatus("LOST", "Destroyed"), (error: any) => error.status === 400);

assert.equal(normalizeLostFoundStatus("FOUND", ""), FOUND_ITEM_OPEN_STATUS);
assert.equal(normalizeLostFoundStatus("FOUND", "Returned"), "Returned");
assert.equal(normalizeLostFoundStatus("FOUND", "Destroyed"), "Destroyed");
assert.throws(() => normalizeLostFoundStatus("FOUND", "Never Found"), (error: any) => error.status === 400);

assert.equal(lostFoundReturnDateForStatus("LOST", "Never Found", null, now), null);
assert.equal(lostFoundReturnDateForStatus("LOST", "Returned", null, now)?.toISOString(), now.toISOString());
assert.equal(lostFoundReturnDateForStatus("FOUND", FOUND_ITEM_OPEN_STATUS, null, now), null);
assert.equal(lostFoundReturnDateForStatus("FOUND", "Destroyed", null, now)?.toISOString(), now.toISOString());

const originalReturnDate = new Date("2026-09-16T12:00:00.000Z");
assert.equal(
  lostFoundReturnDateForStatus("FOUND", "Returned", originalReturnDate, now)?.toISOString(),
  originalReturnDate.toISOString(),
);

console.log("Lost and found rules passed.");

