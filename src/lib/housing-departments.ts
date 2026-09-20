// Sources: Saudi Aramco Departments.xlsx and approved guest department update workbook values.
export const HOUSING_DEPARTMENTS = [
  "COMMUNITY SERVICES", "Emergency", "FGP", "FrPD", "Industrial Security",
  "Information Technology", "KGPD", "KPOD", "Loss Prevention", "Materials",
  "MEDICAL", "NA Well", "NAGO", "NAGPD", "Others", "POD", "SECURITY", "TRANSIENT",
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

export function cleanHousingDepartment(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function preservedHousingDepartment(
  submittedValue: unknown,
  existingDepartmentCode?: unknown,
  linkedDepartmentCode?: unknown,
  required = false,
): string {
  const submitted = cleanHousingDepartment(submittedValue);
  const existing = cleanHousingDepartment(existingDepartmentCode);
  const linked = cleanHousingDepartment(linkedDepartmentCode);
  if (submitted) return validateHousingDepartment(submitted, required, [existing, linked]);
  if (existing) return validateHousingDepartment(existing, false, [existing]);
  if (linked) return validateHousingDepartment(linked, false, [linked]);
  return validateHousingDepartment("", required);
}
