CREATE TABLE "PpmDueDateHistory" (
    "id" TEXT NOT NULL,
    "ppmId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "previousDueDate" TIMESTAMP(3) NOT NULL,
    "newDueDate" TIMESTAMP(3) NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL DEFAULT '',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PpmDueDateHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PpmDueDateHistory_workOrderId_key" ON "PpmDueDateHistory"("workOrderId");
CREATE INDEX "PpmDueDateHistory_ppmId_createdAt_idx" ON "PpmDueDateHistory"("ppmId", "createdAt");
CREATE INDEX "PpmDueDateHistory_workOrderNumber_idx" ON "PpmDueDateHistory"("workOrderNumber");
CREATE INDEX "PpmDueDateHistory_generatedAt_idx" ON "PpmDueDateHistory"("generatedAt");

ALTER TABLE "PpmDueDateHistory" ADD CONSTRAINT "PpmDueDateHistory_ppmId_fkey" FOREIGN KEY ("ppmId") REFERENCES "PreventiveMaintenance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PpmDueDateHistory" ADD CONSTRAINT "PpmDueDateHistory_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
