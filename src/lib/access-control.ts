export type AccessUser = {
  id?: string;
  email?: string;
  role?: string;
  department?: string | null;
};

function comparable(value?: string | null) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function departmentValues(value?: string | null) {
  return String(value ?? "")
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function accessRole(user: AccessUser | null) {
  const role = String(user?.role ?? "").toLowerCase();
  if (role === "admin" || role.includes("super admin")) return "admin";
  if (role.includes("supervisor") || role.includes("facility manager") || role.includes("maintenance manager")) return "supervisor";
  if (role.includes("technician") || role.includes("service team")) return "technician";
  if (role.includes("security")) return "security";
  if (role.includes("read") || role.includes("viewer") || role.includes("view only")) return "readonly";
  return "requester";
}

export function sameDepartment(user: AccessUser | null, departmentCode?: string | null) {
  const recordDepartment = comparable(departmentCode);
  if (!recordDepartment) return false;
  return departmentValues(user?.department).some((department) => {
    const userDepartment = comparable(department);
    return (
      !!userDepartment &&
      (userDepartment === recordDepartment ||
        userDepartment.includes(recordDepartment) ||
        recordDepartment.includes(userDepartment))
    );
  });
}

export function canManageDepartmentRecord(user: AccessUser | null, departmentCode?: string | null) {
  const role = accessRole(user);
  return role === "admin" || (role === "supervisor" && (!departmentCode || sameDepartment(user, departmentCode)));
}
export function canExecuteAssignedRecord(user: AccessUser | null, assignedToId?: string | null) {
  const role = accessRole(user);
  return role === "admin" || role === "supervisor" || (role === "technician" && assignedToId === user?.id);
}

export type PermissionScope = "Own" | "Department" | "Facility" | "Company" | "Global";

const scopeRank: Record<PermissionScope, number> = { Own: 1, Department: 2, Facility: 3, Company: 4, Global: 5 };

export function scopeAllows(actual: string | null | undefined, required: PermissionScope) {
  const actualScope = (actual || "Own") as PermissionScope;
  return (scopeRank[actualScope] ?? 0) >= scopeRank[required];
}

export function recordScopeForUser(user: AccessUser | null, record: { requester?: string | null; assignedToId?: string | null; departmentCode?: string | null }) {
  if (!user) return "Own" as PermissionScope;
  if (record.assignedToId && record.assignedToId === user.id) return "Own";
  if (record.requester && (record.requester === user.email || record.requester === user.id)) return "Own";
  if (record.departmentCode && sameDepartment(user, record.departmentCode)) return "Department";
  return "Company";
}
