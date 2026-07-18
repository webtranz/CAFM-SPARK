CREATE TABLE "CommentHistory" (
    "id" TEXT NOT NULL,
    "sourceYear" TEXT NOT NULL DEFAULT '',
    "sourceFile" TEXT NOT NULL DEFAULT '',
    "sourceRow" INTEGER,
    "uploadKey" TEXT NOT NULL,
    "woNo" TEXT NOT NULL,
    "commentText" TEXT NOT NULL,
    "commentedAt" TIMESTAMP(3),
    "commentedBy" TEXT NOT NULL DEFAULT '',
    "sourceLine" TEXT NOT NULL DEFAULT '',
    "sourceUserCode" TEXT NOT NULL DEFAULT '',
    "sourceUpdateUserCode" TEXT NOT NULL DEFAULT '',
    "addEntity" TEXT NOT NULL DEFAULT '',
    "addType" TEXT NOT NULL DEFAULT '',
    "addLanguage" TEXT NOT NULL DEFAULT '',
    "addPrint" TEXT NOT NULL DEFAULT '',
    "updatedAtSource" TIMESTAMP(3),
    "updateCount" INTEGER,
    "systemWorkOrderMatch" BOOLEAN NOT NULL DEFAULT false,
    "linkStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "workOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommentHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommentHistory_uploadKey_key" ON "CommentHistory"("uploadKey");
CREATE INDEX "CommentHistory_woNo_idx" ON "CommentHistory"("woNo");
CREATE INDEX "CommentHistory_sourceYear_idx" ON "CommentHistory"("sourceYear");
CREATE INDEX "CommentHistory_sourceFile_idx" ON "CommentHistory"("sourceFile");
CREATE INDEX "CommentHistory_linkStatus_idx" ON "CommentHistory"("linkStatus");
CREATE INDEX "CommentHistory_workOrderId_idx" ON "CommentHistory"("workOrderId");

ALTER TABLE "CommentHistory" ADD CONSTRAINT "CommentHistory_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;