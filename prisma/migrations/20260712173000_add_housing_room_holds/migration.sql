CREATE TABLE IF NOT EXISTS "HousingRoomHold" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "remarks" TEXT,
  "createdBy" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HousingRoomHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HousingRoomHold_roomId_status_startDate_endDate_idx" ON "HousingRoomHold"("roomId", "status", "startDate", "endDate");
CREATE INDEX IF NOT EXISTS "HousingRoomHold_status_endDate_idx" ON "HousingRoomHold"("status", "endDate");
CREATE INDEX IF NOT EXISTS "HousingRoomHold_createdAt_idx" ON "HousingRoomHold"("createdAt");

ALTER TABLE "HousingRoomHold" ADD CONSTRAINT "HousingRoomHold_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HousingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
