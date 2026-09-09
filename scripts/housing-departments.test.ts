import assert from "node:assert/strict";
import { HOUSING_DEPARTMENTS, validateHousingDepartment } from "../src/lib/housing-departments";
import { syncHousingResidentToBookings } from "../src/lib/housing-resident-sync";

async function main() {
  for (const department of HOUSING_DEPARTMENTS) {
    assert.equal(validateHousingDepartment(department, true), department);
  }
  for (const invalid of ["SECURITY", "IT", "OTHER", "KGPD ", "kgpd", "Made up", "<script>", 123, {}, ["KGPD"]]) {
    assert.throws(() => validateHousingDepartment(invalid), (error: any) => error.status === 400);
  }
  for (const empty of [undefined, null, ""]) {
    assert.equal(validateHousingDepartment(empty), "");
    assert.throws(() => validateHousingDepartment(empty, true));
  }
  let writes = 0;
  const client = {
    housingBooking: { updateMany: async () => { writes++; return { count: 1 }; } },
    housingBed: { updateMany: async () => ({ count: 0 }) },
  };
  await assert.rejects(syncHousingResidentToBookings(client, { id: "1", residentNo: "1", name: "Guest", departmentCode: "Injected" }));
  assert.equal(writes, 0);
  await syncHousingResidentToBookings(client, { id: "1", residentNo: "1", name: "Guest", departmentCode: "KGPD" });
  assert.equal(writes, 1);
  console.log("Housing department validation and synchronization tests passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
