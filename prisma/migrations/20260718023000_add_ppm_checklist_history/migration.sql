CREATE TABLE "PpmChecklistHistory" (
    "id" TEXT NOT NULL,
    "sourceYear" TEXT NOT NULL DEFAULT '',
    "sourceFile" TEXT NOT NULL DEFAULT '',
    "uploadKey" TEXT NOT NULL,
    "ackEvent" TEXT NOT NULL DEFAULT '',
    "eventCreated" TIMESTAMP(3),
    "eventDescription" TEXT NOT NULL DEFAULT '',
    "ackObject" TEXT NOT NULL DEFAULT '',
    "ackType" TEXT NOT NULL DEFAULT '',
    "ackCode" TEXT NOT NULL DEFAULT '',
    "ackAct" TEXT NOT NULL DEFAULT '',
    "ackSequence" TEXT NOT NULL DEFAULT '',
    "ackDescription" TEXT NOT NULL DEFAULT '',
    "ackNotes" TEXT NOT NULL DEFAULT '',
    "ackUpdated" TIMESTAMP(3),
    "ackUpdatedBy" TEXT NOT NULL DEFAULT '',
    "ackUpdateCount" INTEGER,
    "ackObjectOrg" TEXT NOT NULL DEFAULT '',
    "ackYes" TEXT NOT NULL DEFAULT '',
    "ackNo" TEXT NOT NULL DEFAULT '',
    "ackFinding" TEXT NOT NULL DEFAULT '',
    "ackValue" TEXT NOT NULL DEFAULT '',
    "ackUom" TEXT NOT NULL DEFAULT '',
    "ackFollowup" TEXT NOT NULL DEFAULT '',
    "ackFollowupEvent" TEXT NOT NULL DEFAULT '',
    "ackLastSaved" TIMESTAMP(3),
    "systemWorkOrderMatch" BOOLEAN NOT NULL DEFAULT false,
    "systemAssetMatch" BOOLEAN NOT NULL DEFAULT false,
    "systemPpmMatch" BOOLEAN NOT NULL DEFAULT false,
    "linkStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "workOrderId" TEXT,
    "assetId" TEXT,
    "ppmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PpmChecklistHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PpmChecklistHistory_uploadKey_key" ON "PpmChecklistHistory"("uploadKey");
CREATE INDEX "PpmChecklistHistory_ackEvent_idx" ON "PpmChecklistHistory"("ackEvent");
CREATE INDEX "PpmChecklistHistory_ackObject_idx" ON "PpmChecklistHistory"("ackObject");
CREATE INDEX "PpmChecklistHistory_ackCode_idx" ON "PpmChecklistHistory"("ackCode");
CREATE INDEX "PpmChecklistHistory_sourceYear_idx" ON "PpmChecklistHistory"("sourceYear");
CREATE INDEX "PpmChecklistHistory_linkStatus_idx" ON "PpmChecklistHistory"("linkStatus");
CREATE INDEX "PpmChecklistHistory_workOrderId_idx" ON "PpmChecklistHistory"("workOrderId");
CREATE INDEX "PpmChecklistHistory_assetId_idx" ON "PpmChecklistHistory"("assetId");
CREATE INDEX "PpmChecklistHistory_ppmId_idx" ON "PpmChecklistHistory"("ppmId");

ALTER TABLE "PpmChecklistHistory" ADD CONSTRAINT "PpmChecklistHistory_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PpmChecklistHistory" ADD CONSTRAINT "PpmChecklistHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PpmChecklistHistory" ADD CONSTRAINT "PpmChecklistHistory_ppmId_fkey" FOREIGN KEY ("ppmId") REFERENCES "PreventiveMaintenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
