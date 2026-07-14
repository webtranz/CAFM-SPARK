-- Allow separate source PPM records with distinct codes even when they share the same asset, location, frequency and title.
ALTER TABLE "PreventiveMaintenance" DROP CONSTRAINT IF EXISTS "ppm_plans_asset_location_frequency_name_unique";
DROP INDEX IF EXISTS "ppm_plans_asset_location_frequency_name_unique";
CREATE INDEX IF NOT EXISTS "ppm_plans_asset_location_frequency_name_idx"
ON "PreventiveMaintenance"("assetTag", "locationCode", "frequency", "name");
