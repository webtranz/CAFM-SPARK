CREATE TEMP TABLE "_DefaultRoles" (
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO "_DefaultRoles" ("name", "description") VALUES
('Admin', 'Full system administration with all permissions.'),
('Facility Manager', 'Facility management leadership role with operational oversight.'),
('Maintenance Manager', 'Maintenance management role for work, assets and PPM.'),
('Department Supervisor', 'Department supervisor role for approvals, work assignment and reporting.'),
('Supervisor', 'Operational supervisor role for requests, work assignment and verification.'),
('Service Team', 'Service team role for executing assigned work orders.'),
('Technician', 'Technician role for executing assigned work orders.'),
('Helpdesk', 'Helpdesk role for service request intake, approval and dispatch.'),
('Reception', 'Reception role for front-desk and resident request handling.'),
('Storekeeper', 'Storekeeper role for inventory and asset stock operations.'),
('HSE Officer', 'Health, safety and environment role for safety visibility and reports.'),
('Compliance Officer', 'Compliance role for certification, audit and regulatory follow-up.'),
('Housing Manager', 'Housing operations manager role for accommodation workflows.'),
('Resident', 'Resident portal role for creating and tracking own requests.'),
('Requester', 'Requester role for creating and tracking service requests.'),
('Read-only', 'Read-only role with view and reporting access.');

INSERT INTO "Role" ("id", "name", "description", "standard")
SELECT concat('role-', regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), "name", "description", TRUE
FROM "_DefaultRoles"
ON CONFLICT ("name") DO UPDATE SET
  "standard" = TRUE,
  "description" = CASE WHEN "Role"."description" = '' THEN EXCLUDED."description" ELSE "Role"."description" END;

CREATE TEMP TABLE "_RolePermissionDefaults" (
  "role" TEXT NOT NULL,
  "code" TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO "_RolePermissionDefaults" ("role", "code") VALUES
('Facility Manager','assets.manage'),('Facility Manager','work.manage'),('Facility Manager','work.assign'),('Facility Manager','work.verify'),('Facility Manager','requests.manage'),('Facility Manager','requests.approve'),('Facility Manager','ppm.manage'),('Facility Manager','reports.view'),('Facility Manager','housing.view'),('Facility Manager','compliance.view'),('Facility Manager','assets.view'),('Facility Manager','work.view'),('Facility Manager','requests.view'),
('Maintenance Manager','assets.manage'),('Maintenance Manager','work.manage'),('Maintenance Manager','work.assign'),('Maintenance Manager','work.verify'),('Maintenance Manager','work.execute'),('Maintenance Manager','requests.manage'),('Maintenance Manager','requests.approve'),('Maintenance Manager','ppm.manage'),('Maintenance Manager','reports.view'),('Maintenance Manager','assets.view'),('Maintenance Manager','work.view'),('Maintenance Manager','requests.view'),
('Department Supervisor','requests.manage'),('Department Supervisor','requests.approve'),('Department Supervisor','work.manage'),('Department Supervisor','work.assign'),('Department Supervisor','work.verify'),('Department Supervisor','ppm.manage'),('Department Supervisor','reports.view'),('Department Supervisor','assets.view'),('Department Supervisor','work.view'),('Department Supervisor','requests.view'),
('Supervisor','requests.manage'),('Supervisor','requests.approve'),('Supervisor','work.manage'),('Supervisor','work.assign'),('Supervisor','work.verify'),('Supervisor','reports.view'),('Supervisor','assets.view'),('Supervisor','work.view'),('Supervisor','requests.view'),
('Service Team','work.execute'),('Service Team','work.view'),('Service Team','requests.view'),('Service Team','assets.view'),
('Technician','work.execute'),('Technician','work.view'),('Technician','requests.view'),('Technician','assets.view'),
('Helpdesk','requests.manage'),('Helpdesk','requests.approve'),('Helpdesk','work.view'),('Helpdesk','assets.view'),('Helpdesk','reports.view'),('Helpdesk','requests.view'),
('Reception','reception.manage'),('Reception','requests.manage'),('Reception','requests.view'),('Reception','housing.view'),('Reception','resident.portal'),
('Storekeeper','assets.manage'),('Storekeeper','assets.view'),('Storekeeper','work.view'),('Storekeeper','reports.view'),
('HSE Officer','reports.view'),('HSE Officer','work.view'),('HSE Officer','requests.view'),('HSE Officer','compliance.view'),
('Compliance Officer','compliance.manage'),('Compliance Officer','compliance.view'),('Compliance Officer','reports.view'),('Compliance Officer','work.view'),('Compliance Officer','requests.view'),
('Housing Manager','housing.manage'),('Housing Manager','housing.approve'),('Housing Manager','housing.view'),('Housing Manager','requests.manage'),('Housing Manager','requests.approve'),('Housing Manager','reports.view'),
('Resident','resident.portal'),('Resident','requests.view'),
('Requester','resident.portal'),('Requester','requests.view'),
('Read-only','requests.view'),('Read-only','work.view'),('Read-only','assets.view'),('Read-only','reports.view'),('Read-only','housing.view'),('Read-only','compliance.view');

INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT concat('rp-admin-', p."id"), 'Admin', p."id"
FROM "Permission" p
ON CONFLICT ("role", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "role", "permissionId")
SELECT concat('rp-', regexp_replace(lower(d."role"), '[^a-z0-9]+', '-', 'g'), '-', p."id"), d."role", p."id"
FROM "_RolePermissionDefaults" d
JOIN "Permission" p ON p."code" = d."code"
ON CONFLICT ("role", "permissionId") DO NOTHING;

DELETE FROM "RolePermission" rp
USING "Permission" p
WHERE rp."permissionId" = p."id"
  AND p."code" = 'documents.upload'
  AND rp."role" <> 'Admin';