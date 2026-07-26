CREATE TABLE IF NOT EXISTS "SecurityChecklistReport" (
    "id" TEXT NOT NULL,
    "checklistNo" TEXT NOT NULL,
    "checklistDate" TIMESTAMP(3) NOT NULL,
    "shift" TEXT NOT NULL,
    "securityLocationCode" TEXT,
    "locationName" TEXT,
    "officerName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "items" JSONB NOT NULL,
    "linkedRequests" JSONB,
    "remarks" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityChecklistReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SecurityChecklistReport_checklistNo_key" ON "SecurityChecklistReport"("checklistNo");
CREATE INDEX IF NOT EXISTS "SecurityChecklistReport_checklistDate_securityLocationCode_idx" ON "SecurityChecklistReport"("checklistDate", "securityLocationCode");
CREATE INDEX IF NOT EXISTS "SecurityChecklistReport_status_checklistDate_idx" ON "SecurityChecklistReport"("status", "checklistDate");