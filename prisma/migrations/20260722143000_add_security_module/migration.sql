CREATE TABLE IF NOT EXISTS "SecurityLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gateName" TEXT,
    "siteCode" TEXT,
    "locationCode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecurityLocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SecurityLocation_code_key" ON "SecurityLocation"("code");

CREATE TABLE IF NOT EXISTS "SecurityGatePass" (
    "id" TEXT NOT NULL,
    "passNo" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "visitorCompany" TEXT,
    "visitorIdNo" TEXT,
    "contactNo" TEXT,
    "purpose" TEXT NOT NULL,
    "securityLocationCode" TEXT,
    "locationName" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "vehicleNo" TEXT,
    "materials" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_HELPDESK',
    "helpdeskApprovedBy" TEXT,
    "helpdeskApprovedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "issuedBy" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecurityGatePass_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SecurityGatePass_passNo_key" ON "SecurityGatePass"("passNo");
CREATE INDEX IF NOT EXISTS "SecurityGatePass_status_validFrom_idx" ON "SecurityGatePass"("status", "validFrom");
CREATE INDEX IF NOT EXISTS "SecurityGatePass_securityLocationCode_idx" ON "SecurityGatePass"("securityLocationCode");

CREATE TABLE IF NOT EXISTS "SecurityDailyReport" (
    "id" TEXT NOT NULL,
    "reportNo" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "shift" TEXT NOT NULL,
    "securityLocationCode" TEXT,
    "locationName" TEXT,
    "officerName" TEXT NOT NULL,
    "visitorCount" INTEGER NOT NULL DEFAULT 0,
    "vehicleCount" INTEGER NOT NULL DEFAULT 0,
    "incidents" TEXT,
    "handoverNotes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecurityDailyReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SecurityDailyReport_reportNo_key" ON "SecurityDailyReport"("reportNo");
CREATE INDEX IF NOT EXISTS "SecurityDailyReport_reportDate_securityLocationCode_idx" ON "SecurityDailyReport"("reportDate", "securityLocationCode");

CREATE TABLE IF NOT EXISTS "SecurityFireDrillReport" (
    "id" TEXT NOT NULL,
    "drillNo" TEXT NOT NULL,
    "drillDate" TIMESTAMP(3) NOT NULL,
    "securityLocationCode" TEXT,
    "locationName" TEXT,
    "alarmType" TEXT NOT NULL,
    "conductedBy" TEXT NOT NULL,
    "evacuationTimeMin" INTEGER,
    "participants" INTEGER,
    "observations" TEXT,
    "correctiveActions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecurityFireDrillReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SecurityFireDrillReport_drillNo_key" ON "SecurityFireDrillReport"("drillNo");
CREATE INDEX IF NOT EXISTS "SecurityFireDrillReport_drillDate_securityLocationCode_idx" ON "SecurityFireDrillReport"("drillDate", "securityLocationCode");
