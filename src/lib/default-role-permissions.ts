export const ACTION_PERMISSION_SEED = [
  { code: "assets.manage", name: "Manage Assets", module: "Assets Management", description: "Create, edit, import and view asset history" },
  { code: "work.manage", name: "Manage Work Orders", module: "Tickets", description: "Create and update work orders" },
  { code: "work.execute", name: "Execute Work Orders", module: "Tickets", description: "Update work order status, time, photos, assets and inventory used" },
  { code: "work.assign", name: "Assign Work Orders", module: "Tickets", description: "Assign work orders to technicians or teams" },
  { code: "work.verify", name: "Verify Completed Work", module: "Tickets", description: "Approve, reject, reopen or close completed work" },
  { code: "requests.manage", name: "Manage Service Requests", module: "Tickets", description: "Create, edit, assign and convert requests to work orders" },
  { code: "requests.approve", name: "Approve or Reject Requests", module: "Tickets", description: "Review, validate, approve or reject service requests" },
  { code: "requests.view", name: "View Service Requests", module: "Tickets", description: "View assigned service requests" },
  { code: "work.view", name: "View Work Orders", module: "Tickets", description: "View work order panels and completion history" },
  { code: "ppm.manage", name: "Manage PPM", module: "Tickets", description: "Create planned preventive maintenance schedules" },
  { code: "assets.view", name: "View Assets", module: "Assets Management", description: "View asset register, history and location drill-down" },
  { code: "documents.upload", name: "Upload Document Files", module: "Document Management", description: "Upload files to document management folders. Admin only." },
  { code: "users.manage", name: "Manage Users", module: "Users Management", description: "Create users and assign roles" },
  { code: "roles.manage", name: "Manage Roles", module: "Users Management", description: "Create custom roles and permission sets" },
  { code: "reports.view", name: "View Reports", module: "Utilities", description: "Preview and download reports" },
  { code: "reception.manage", name: "Reception Desk", module: "Reception", description: "Create resident requests and view front-desk queue" },
  { code: "resident.portal", name: "Resident Portal", module: "Resident", description: "Create and track own requests" },
  { code: "housing.manage", name: "Manage Housing Operations", module: "Housing Operations", description: "Create and manage accommodation, bookings, inspections, assets and inventory" },
  { code: "housing.approve", name: "Approve Housing Requests", module: "Housing Operations", description: "Approve or reject housing bookings and escalations" },
  { code: "housing.view", name: "View Housing", module: "Housing Operations", description: "View housing dashboards, room history, reports and alerts" },
  { code: "compliance.manage", name: "Manage Compliance & Certification", module: "Compliance & Certification", description: "Create and renew statutory certificates, permits and regulatory audits" },
  { code: "compliance.view", name: "View Compliance & Certification", module: "Compliance & Certification", description: "View compliance dashboard, certificate register, expiry alerts and reports" },
] as const;

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
  "Read-only",
] as const;

export const DEFAULT_CUSTOM_ROLE_PERMISSIONS = ["requests.view", "work.view", "assets.view", "reports.view"];

export const DEFAULT_ROLE_PERMISSION_PROFILES: Record<string, string[]> = {
  Admin: ACTION_PERMISSION_SEED.map((permission) => permission.code),
  "Facility Manager": ["assets.manage", "work.manage", "work.assign", "work.verify", "requests.manage", "requests.approve", "ppm.manage", "reports.view", "housing.view", "compliance.view", "assets.view", "work.view", "requests.view"],
  "Maintenance Manager": ["assets.manage", "work.manage", "work.assign", "work.verify", "work.execute", "requests.manage", "requests.approve", "ppm.manage", "reports.view", "assets.view", "work.view", "requests.view"],
  "Department Supervisor": ["requests.manage", "requests.approve", "work.manage", "work.assign", "work.verify", "ppm.manage", "reports.view", "assets.view", "work.view", "requests.view"],
  Supervisor: ["requests.manage", "requests.approve", "work.manage", "work.assign", "work.verify", "reports.view", "assets.view", "work.view", "requests.view"],
  "Service Team": ["work.execute", "work.view", "requests.view", "assets.view"],
  Technician: ["work.execute", "work.view", "requests.view", "assets.view"],
  Helpdesk: ["requests.manage", "requests.approve", "work.view", "assets.view", "reports.view", "requests.view"],
  Reception: ["reception.manage", "requests.manage", "requests.view", "housing.view", "resident.portal"],
  Storekeeper: ["assets.manage", "assets.view", "work.view", "reports.view"],
  "HSE Officer": ["reports.view", "work.view", "requests.view", "compliance.view"],
  "Compliance Officer": ["compliance.manage", "compliance.view", "reports.view", "work.view", "requests.view"],
  "Housing Manager": ["housing.manage", "housing.approve", "housing.view", "requests.manage", "requests.approve", "reports.view"],
  Resident: ["resident.portal", "requests.view"],
  Requester: ["resident.portal", "requests.view"],
  "Read-only": ["requests.view", "work.view", "assets.view", "reports.view", "housing.view", "compliance.view"],
};

export function defaultPermissionCodesForRole(role: string) {
  return DEFAULT_ROLE_PERMISSION_PROFILES[role] ?? DEFAULT_CUSTOM_ROLE_PERMISSIONS;
}