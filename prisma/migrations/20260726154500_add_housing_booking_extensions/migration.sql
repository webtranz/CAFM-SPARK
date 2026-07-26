ALTER TABLE "HousingBooking"
ADD COLUMN IF NOT EXISTS "extensionStatus" TEXT,
ADD COLUMN IF NOT EXISTS "extensionEndDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "extensionRemarks" TEXT,
ADD COLUMN IF NOT EXISTS "extensionRequestedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "extensionApprovedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "HousingBooking_extensionStatus_idx" ON "HousingBooking"("extensionStatus");