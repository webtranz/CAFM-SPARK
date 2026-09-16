import assert from "node:assert/strict";
import { HOUSING_DEPARTMENTS, validateHousingDepartment } from "../src/lib/housing-departments";
import { syncHousingResidentToBookings } from "../src/lib/housing-resident-sync";

async function main() {
  for (const department of HOUSING_DEPARTMENTS) {
    assert.equal(validateHousingDepartment(department, true), department);
  }
  for (const invalid of ["SECURITY", "IT", "OTHER", "Made up", "<script>", 123, {}, ["KGPD"]]) {
    assert.throws(() => validateHousingDepartment(invalid), (error: any) => error.status === 400);
  }
  assert.equal(validateHousingDepartment("Made up", false, ["Made up"]), "Made up");
  for (const empty of [undefined, null, ""]) {
    assert.equal(validateHousingDepartment(empty), "");
    assert.throws(() => validateHousingDepartment(empty, true));
  }
  let writes = 0;
  let lastBookingData: any = null;
  const client = {
    housingBooking: { updateMany: async ({ data }: any) => { writes++; lastBookingData = data; return { count: 1 }; } },
    housingBed: { updateMany: async () => ({ count: 0 }) },
  };
  await syncHousingResidentToBookings(client, { id: "1", residentNo: "1", name: "Guest", departmentCode: "" });
  assert.equal(writes, 1);
  assert.equal("departmentCode" in lastBookingData, false);
  await syncHousingResidentToBookings(client, { id: "1", residentNo: "1", name: "Guest", departmentCode: "KGPD" });
  assert.equal(writes, 2);
  assert.equal(lastBookingData.departmentCode, "KGPD");
  await syncHousingResidentToBookings(client, { id: "1", residentNo: "1", name: "Guest", departmentCode: "Fire Protection Dept." });
  assert.equal(writes, 3);
  assert.equal(lastBookingData.departmentCode, "Fire Protection Dept.");
  console.log("Housing department validation and synchronization tests passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
