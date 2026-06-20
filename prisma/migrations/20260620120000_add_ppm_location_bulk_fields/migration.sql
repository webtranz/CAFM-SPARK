ALTER TABLE "PreventiveMaintenance"
ADD COLUMN "locationCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN "departmentCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'MEDIUM';

DROP INDEX IF EXISTS "ppm_plans_asset_frequency_name_unique";

CREATE UNIQUE INDEX "ppm_plans_asset_location_frequency_name_unique"
ON "PreventiveMaintenance"("assetTag", "locationCode", "frequency", "name");
