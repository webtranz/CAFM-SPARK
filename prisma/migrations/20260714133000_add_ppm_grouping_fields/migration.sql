ALTER TABLE "PreventiveMaintenance"
ADD COLUMN "ppmCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN "equipmentDescription" TEXT,
ADD COLUMN "objectType" TEXT,
ADD COLUMN "objectClass" TEXT,
ADD COLUMN "objectCategory" TEXT,
ADD COLUMN "checklistLink" TEXT;

UPDATE "PreventiveMaintenance"
SET "ppmCode" = CASE
  WHEN POSITION('-' IN "code") > 0 THEN SPLIT_PART("code", '-', 1)
  ELSE "code"
END
WHERE "ppmCode" = '';

CREATE INDEX "PreventiveMaintenance_ppmCode_idx" ON "PreventiveMaintenance"("ppmCode");
