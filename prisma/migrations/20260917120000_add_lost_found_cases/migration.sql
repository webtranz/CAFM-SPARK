CREATE TABLE IF NOT EXISTS "LostFoundCase" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "lostItems" TEXT,
    "lostDate" TIMESTAMP(3),
    "foundAt" TIMESTAMP(3),
    "foundBy" TEXT,
    "itemFound" TEXT,
    "location" TEXT NOT NULL,
    "guestName" TEXT,
    "guestRoomBadge" TEXT,
    "guestContact" TEXT,
    "returnDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LostFoundCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LostFoundCase_caseId_key" ON "LostFoundCase"("caseId");
CREATE INDEX IF NOT EXISTS "LostFoundCase_caseType_status_idx" ON "LostFoundCase"("caseType", "status");
CREATE INDEX IF NOT EXISTS "LostFoundCase_createdAt_idx" ON "LostFoundCase"("createdAt");
CREATE INDEX IF NOT EXISTS "LostFoundCase_returnDate_idx" ON "LostFoundCase"("returnDate");
