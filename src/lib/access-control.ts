export type AccessUser = {
  id?: string;
  email?: string;
  role?: string;
  department?: string | null;
};

export function accessRole(user: AccessUser | null) {
  const role = String(user?.role ?? "").toLowerCase();
  if (role === "admin" || role.includes("super admin")) return "admin";
  if (role.includes("supervisor")) return "supervisor";
  if (role.includes("technician") || role.includes("service team")) return "technician";
  if (role.includes("read") || role.includes("viewer") || role.includes("view only")) return "readonly";
  return "requester";
}

export function sameDepartment(user: AccessUser | null, departmentCode?: string | null) {
  if (!departmentCode) return false;
  return String(user?.department ?? "").toLowerCase() === String(departmentCode).toLowerCase();
}

export function canManageDepartmentRecord(user: AccessUser | null, departmentCode?: string | null) {
  const role = accessRole(user);
  return role === "admin" || (role === "supervisor" && sameDepartment(user, departmentCode));
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
