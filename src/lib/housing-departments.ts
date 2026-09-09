// Source: Saudi Aramco Departments.xlsx, Sheet1!A2:A20.
export const HOUSING_DEPARTMENTS = [
  "COMMUNITY SERVICES", "Emergency", "FGP", "FrPD", "Industrial Security",
  "Information Technology", "KGPD", "KPOD", "Loss Prevention", "Materials",
  "MEDICAL", "NA Well", "NAGO", "NAGPD", "Others", "POD", "TRANSIENT",
  "Transport & Equip Servc Dept", "WGP",
] as const;

export function validateHousingDepartment(value: unknown, required = false): string {
  if (value === undefined || value === null || value === "") {
    if (!required) return "";
  } else if (typeof value === "string" && HOUSING_DEPARTMENTS.some((item) => item === value)) {
    return value;
  }
  throw Object.assign(new Error("Select a department from the approved Saudi Aramco department list."), { status: 400 });
}
