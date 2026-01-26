-- CreateTable
CREATE TABLE IF NOT EXISTS "ProcessingQueue" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "totalPages" INTEGER NOT NULL,
  "pagesProcessed" INTEGER NOT NULL DEFAULT 0,
  "currentBatch" INTEGER NOT NULL DEFAULT 0,
  "totalBatches" INTEGER NOT NULL,
  "lastError" TEXT,
  "retriesCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProcessingQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessingQueue_documentId_idx" ON "ProcessingQueue"("documentId");
CREATE INDEX "ProcessingQueue_status_idx" ON "ProcessingQueue"("status");
CREATE INDEX "ProcessingQueue_createdAt_idx" ON "ProcessingQueue"("createdAt");

-- AddForeignKey
ALTER TABLE "ProcessingQueue" ADD CONSTRAINT "ProcessingQueue_documentId_fkey" 
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
