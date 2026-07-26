export const PERMISSION_SCOPES = ["Own", "Department", "Facility", "Company", "Global"] as const;
export type PermissionScope = typeof PERMISSION_SCOPES[number];

const modules = [
  ["dashboard", "Dashboard"],
  ["assets", "Assets"],
  ["locations", "Locations"],
  ["workorders", "Work Orders"],
  ["servicerequests", "Service Requests"],
  ["ppm", "PPM"],
  ["inventory", "Inventory"],
  ["safety", "Safety"],
  ["incidents", "Incidents"],
  ["compliance", "Compliance"],
  ["certifications", "Certifications"],
  ["documents", "Documents"],
  ["housing", "Housing"],
  ["residents", "Residents"],
  ["security", "Security"],
  ["reports", "Reports"],
  ["users", "Users"],
  ["roles", "Roles"],
  ["settings", "Settings"],
] as const;

const actions = ["view", "create", "edit", "delete", "approve", "assign", "import", "export", "report", "settings", "dashboard"] as const;

const actionNames: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  assign: "Assign",
  import: "Import",
  export: "Export",
  report: "Report",
  settings: "Settings",
  dashboard: "Dashboard",
};

export const ENTERPRISE_PERMISSION_SEED = modules.flatMap(([moduleCode, moduleName]) => {
  return actions.map((action) => ({
    code: `${moduleCode}.${action}`,
    name: `${actionNames[action]} ${moduleName}`,
    module: moduleName,
    action,
    description: `${actionNames[action]} access for ${moduleName}.`,
  }));
});

export const LEGACY_PERMISSION_ALIASES: Record<string, string[]> = {
  "assets.manage": ["assets.view", "assets.create", "assets.edit", "assets.delete", "assets.import", "assets.report"],
  "assets.view": ["assets.view"],
  "work.manage": ["workorders.create", "workorders.edit", "workorders.view"],
  "work.execute": ["workorders.edit", "workorders.view"],
  "work.assign": ["workorders.assign", "workorders.view"],
  "work.verify": ["workorders.approve", "workorders.view"],
  "work.view": ["workorders.view"],
  "requests.manage": ["servicerequests.create", "servicerequests.edit", "servicerequests.assign", "servicerequests.view"],
  "requests.approve": ["servicerequests.approve", "servicerequests.view"],
  "requests.view": ["servicerequests.view"],
  "ppm.manage": ["ppm.view", "ppm.create", "ppm.edit", "ppm.delete", "ppm.import", "ppm.report", "ppm.assign", "ppm.approve", "ppm.dashboard"],
  "ppm.execute": ["ppm.view", "ppm.edit"],
  "users.manage": ["users.view", "users.create", "users.edit", "users.delete"],
  "roles.manage": ["roles.view", "roles.create", "roles.edit", "roles.delete", "roles.settings"],
  "reports.view": ["reports.view", "reports.export", "reports.report", "dashboard.view"],
  "documents.upload": ["documents.create", "documents.import", "documents.view"],
  "reception.manage": ["servicerequests.create", "servicerequests.view", "housing.view", "housing.create", "housing.edit", "residents.view", "residents.create", "residents.edit"],
  "resident.portal": ["servicerequests.create", "servicerequests.view"],
  "housing.manage": ["housing.view", "housing.create", "housing.edit", "housing.delete", "residents.view", "residents.create", "residents.edit"],
  "housing.approve": ["housing.approve", "housing.view"],
  "housing.view": ["housing.view", "residents.view"],
  "compliance.manage": ["compliance.view", "compliance.create", "compliance.edit", "compliance.delete", "certifications.view", "certifications.create", "certifications.edit"],
  "compliance.view": ["compliance.view", "certifications.view"],
  "security.manage": ["security.view", "security.create", "security.edit", "security.approve", "security.report"],
  "security.view": ["security.view"],
};

export const ACTION_PERMISSION_SEED = ENTERPRISE_PERMISSION_SEED;

export const DEFAULT_ROLE_NAMES = [
  "Admin",
  "Facility Manager",
  "Maintenance Manager",
  "Department Supervisor",
  "Supervisor",
  "Service Team",
  "Technician",
  "Helpdesk",
  "Reception",
  "Storekeeper",
  "HSE Officer",
  "Compliance Officer",
  "Housing Manager",
  "Resident",
  "Requester",
  "Security",
  "Read-only",
] as const;

export type RolePermissionGrant = { code: string; scope: PermissionScope };

function grant(codes: string[], scope: PermissionScope): RolePermissionGrant[] {
  return codes.map((code) => ({ code, scope }));
}

const viewOnly = ["dashboard.view", "assets.view", "locations.view", "workorders.view", "servicerequests.view", "ppm.view", "inventory.view", "safety.view", "incidents.view", "compliance.view", "certifications.view", "documents.view", "housing.view", "residents.view", "security.view", "reports.view"];
const requestOwn = ["servicerequests.view", "servicerequests.create"];

export const DEFAULT_ROLE_PERMISSION_GRANTS: Record<string, RolePermissionGrant[]> = {
  Admin: grant(ENTERPRISE_PERMISSION_SEED.map((permission) => permission.code), "Global"),
  "Facility Manager": grant(["dashboard.view", "assets.view", "assets.create", "assets.edit", "assets.import", "assets.export", "assets.report", "locations.view", "locations.create", "locations.edit", "workorders.view", "workorders.create", "workorders.edit", "workorders.assign", "workorders.approve", "workorders.report", "servicerequests.view", "servicerequests.create", "servicerequests.edit", "servicerequests.assign", "servicerequests.approve", "ppm.view", "ppm.create", "ppm.edit", "ppm.assign", "ppm.approve", "ppm.report", "ppm.dashboard", "inventory.view", "safety.view", "incidents.view", "compliance.view", "certifications.view", "housing.view", "housing.create", "housing.edit", "housing.approve", "housing.report", "residents.view", "residents.create", "residents.edit", "reports.view", "reports.export"], "Company"),
  "Maintenance Manager": grant(["dashboard.view", "assets.view", "assets.create", "assets.edit", "assets.import", "workorders.view", "workorders.create", "workorders.edit", "workorders.assign", "workorders.approve", "ppm.view", "ppm.create", "ppm.edit", "ppm.assign", "ppm.approve", "ppm.dashboard", "inventory.view", "reports.view", "reports.export"], "Facility"),
  "Department Supervisor": grant(["dashboard.view", "assets.view", "workorders.view", "workorders.create", "workorders.edit", "workorders.assign", "workorders.approve", "servicerequests.view", "servicerequests.create", "servicerequests.edit", "servicerequests.assign", "servicerequests.approve", "ppm.view", "ppm.approve", "reports.view"], "Department"),
  Supervisor: grant(["dashboard.view", "assets.view", "workorders.view", "workorders.create", "workorders.edit", "workorders.assign", "workorders.approve", "servicerequests.view", "servicerequests.edit", "servicerequests.assign", "servicerequests.approve", "reports.view"], "Department"),
  "Service Team": grant(["assets.view", "workorders.view", "workorders.edit", "servicerequests.view", "ppm.view", "ppm.edit"], "Own"),
  Technician: grant(["assets.view", "workorders.view", "workorders.edit", "servicerequests.view", "ppm.view", "ppm.edit"], "Own"),
  Helpdesk: grant(["dashboard.view", "servicerequests.view", "servicerequests.create", "servicerequests.edit", "servicerequests.assign", "workorders.view", "assets.view", "locations.view", "housing.view", "housing.create", "residents.view", "residents.create", "security.view", "security.create", "security.edit", "security.approve", "security.report"], "Company"),
  Reception: grant(["dashboard.view", "servicerequests.view", "servicerequests.create", "servicerequests.edit", "housing.view", "housing.create", "housing.edit", "residents.view", "residents.create", "residents.edit"], "Facility"),
  Storekeeper: grant(["inventory.view", "inventory.create", "inventory.edit", "inventory.import", "inventory.export", "inventory.report", "workorders.view", "assets.view"], "Facility"),
  "HSE Officer": grant(["safety.view", "safety.create", "safety.edit", "safety.report", "incidents.view", "incidents.create", "incidents.edit", "incidents.approve", "reports.view"], "Company"),
  "Compliance Officer": grant(["compliance.view", "compliance.create", "compliance.edit", "compliance.delete", "compliance.report", "certifications.view", "certifications.create", "certifications.edit", "certifications.report", "reports.view"], "Company"),
  "Housing Manager": grant(["dashboard.view", "housing.view", "housing.create", "housing.edit", "housing.delete", "housing.approve", "housing.report", "residents.view", "residents.create", "residents.edit", "servicerequests.view", "servicerequests.create", "servicerequests.edit", "servicerequests.assign", "reports.view", "reports.export"], "Facility"),
  Resident: grant(requestOwn, "Own"),
  Requester: grant(requestOwn, "Own"),
  Security: grant(["security.view", "security.create", "security.report"], "Facility"),
  "Read-only": grant(viewOnly, "Company"),
};

export const DEFAULT_CUSTOM_ROLE_PERMISSIONS = ["dashboard.view", "servicerequests.view", "workorders.view", "assets.view", "reports.view"];

export function defaultPermissionGrantsForRole(role: string): RolePermissionGrant[] {
  return DEFAULT_ROLE_PERMISSION_GRANTS[role] ?? grant(DEFAULT_CUSTOM_ROLE_PERMISSIONS, "Department");
}

export function defaultPermissionCodesForRole(role: string) {
  return defaultPermissionGrantsForRole(role).map((grant) => grant.code);
}

export function defaultPermissionScopeForRole(role: string, code: string): PermissionScope {
  return defaultPermissionGrantsForRole(role).find((grant) => grant.code === code)?.scope ?? "Department";
}

export function expandPermissionCode(code: string) {
  return Array.from(new Set([code, ...(LEGACY_PERMISSION_ALIASES[code] ?? [])]));
}

export function hasPermissionCode(assignedCodes: Set<string>, code?: string) {
  if (!code) return true;
  return expandPermissionCode(code).some((candidate) => assignedCodes.has(candidate));
}
const rolePermissionProfile = {
  ACTION_PERMISSION_SEED,
  DEFAULT_CUSTOM_ROLE_PERMISSIONS,
  DEFAULT_ROLE_NAMES,
  DEFAULT_ROLE_PERMISSION_GRANTS,
  ENTERPRISE_PERMISSION_SEED,
  LEGACY_PERMISSION_ALIASES,
  PERMISSION_SCOPES,
  defaultPermissionCodesForRole,
  defaultPermissionGrantsForRole,
  defaultPermissionScopeForRole,
  expandPermissionCode,
  hasPermissionCode,
};

export default rolePermissionProfile;
