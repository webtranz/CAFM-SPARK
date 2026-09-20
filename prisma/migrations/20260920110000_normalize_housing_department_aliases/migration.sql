-- Normalizes legacy Housing department labels to the approved new values.
-- This catches existing live rows even when they were not included in the guest-specific workbook mapping.

WITH aliases("oldDepartment", "newDepartment") AS (
  VALUES
  ('Community Services Proj. Support', 'COMMUNITY SERVICES'),
  ('Fadhili Gas Plant', 'FGP'),
  ('Fire Protection Dept.', 'FrPD'),
  ('Industrial Security', 'SECURITY'),
  ('Khursaniyah Gas Plant Dept', 'KGPD'),
  ('Khursaniyah Producing', 'KPOD'),
  ('NAGO Admin Area', 'NAGO'),
  ('Northern Area Gas Prod Dept', 'NAGPD'),
  ('Power Operation Dept.', 'POD'),
  ('Transient', 'TRANSIENT'),
  ('Wasit Gas Plant', 'WGP')
)
UPDATE "HousingResident" AS resident
SET "departmentCode" = aliases."newDepartment",
    "updatedAt" = CURRENT_TIMESTAMP
FROM aliases
WHERE LOWER(TRIM(COALESCE(resident."departmentCode", ''))) = LOWER(aliases."oldDepartment")
  AND COALESCE(resident."departmentCode", '') IS DISTINCT FROM aliases."newDepartment";

WITH aliases("oldDepartment", "newDepartment") AS (
  VALUES
  ('Community Services Proj. Support', 'COMMUNITY SERVICES'),
  ('Fadhili Gas Plant', 'FGP'),
  ('Fire Protection Dept.', 'FrPD'),
  ('Industrial Security', 'SECURITY'),
  ('Khursaniyah Gas Plant Dept', 'KGPD'),
  ('Khursaniyah Producing', 'KPOD'),
  ('NAGO Admin Area', 'NAGO'),
  ('Northern Area Gas Prod Dept', 'NAGPD'),
  ('Power Operation Dept.', 'POD'),
  ('Transient', 'TRANSIENT'),
  ('Wasit Gas Plant', 'WGP')
)
UPDATE "HousingBooking" AS booking
SET "departmentCode" = aliases."newDepartment",
    "updatedAt" = CURRENT_TIMESTAMP
FROM aliases
WHERE LOWER(TRIM(COALESCE(booking."departmentCode", ''))) = LOWER(aliases."oldDepartment")
  AND COALESCE(booking."departmentCode", '') IS DISTINCT FROM aliases."newDepartment";
