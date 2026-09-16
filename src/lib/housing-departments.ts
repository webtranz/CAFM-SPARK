// Source: Saudi Aramco Departments.xlsx, Sheet1!A2:A20.
export const HOUSING_DEPARTMENTS = [
  "COMMUNITY SERVICES", "Emergency", "FGP", "FrPD", "Industrial Security",
  "Information Technology", "KGPD", "KPOD", "Loss Prevention", "Materials",
  "MEDICAL", "NA Well", "NAGO", "NAGPD", "Others", "POD", "TRANSIENT",
  "Transport & Equip Servc Dept", "WGP",
] as const;

export function validateHousingDepartment(
  value: unknown,
  required = false,
  existingValues: unknown[] = [],
): string {
  if (value === undefined || value === null || value === "") {
    if (!required) return "";
    throw Object.assign(new Error("Select a department from the approved Saudi Aramco department list."), { status: 400 });
  }
  if (typeof value !== "string") {
    throw Object.assign(new Error("Select a department from the approved Saudi Aramco department list."), { status: 400 });
  }
  const department = value.trim();
  if (!department) {
    if (!required) return "";
  } else {
    const approved = HOUSING_DEPARTMENTS.find(
      (item) => item.toLowerCase() === department.toLowerCase(),
    );
    if (approved) return approved;
    const existing = existingValues
      .map((item) => String(item ?? "").trim())
      .find((item) => item && item.toLowerCase() === department.toLowerCase());
    if (existing) return existing;
  }
  throw Object.assign(new Error("Select a department from the approved Saudi Aramco department list."), { status: 400 });
}
