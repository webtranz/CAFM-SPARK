CREATE TYPE "PpmWorkflowStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'SUBMITTED', 'REWORK', 'COMPLETED', 'CLOSED', 'OVERDUE', 'CANCELLED');

ALTER TABLE "PreventiveMaintenance"
  ADD COLUMN "workflowStatus" "PpmWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "assignedTeamCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "technicianEmail" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "supervisorEmail" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "generatedWorkOrderId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "lastGeneratedAt" TIMESTAMP(3),
  ADD COLUMN "lastCompletedAt" TIMESTAMP(3),
  ADD COLUMN "checklistMandatory" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "complianceNotes" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "escalationLevel" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WorkOrder" ADD COLUMN "ppmId" TEXT;

CREATE INDEX "WorkOrder_ppmId_idx" ON "WorkOrder"("ppmId");
CREATE INDEX "PreventiveMaintenance_workflowStatus_nextDue_idx" ON "PreventiveMaintenance"("workflowStatus", "nextDue");
CREATE INDEX "PreventiveMaintenance_assignedTeamCode_technicianEmail_supervisorEmail_idx" ON "PreventiveMaintenance"("assignedTeamCode", "technicianEmail", "supervisorEmail");

ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_ppmId_fkey" FOREIGN KEY ("ppmId") REFERENCES "PreventiveMaintenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;