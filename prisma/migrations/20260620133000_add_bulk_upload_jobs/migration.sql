-- CreateTable
CREATE TABLE "BulkUploadJob" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "message" TEXT,
    "failed" TEXT,
    "entries" TEXT,
    "result" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkUploadJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkUploadJob_status_createdAt_idx" ON "BulkUploadJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BulkUploadJob_module_createdAt_idx" ON "BulkUploadJob"("module", "createdAt");
