-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'staged',
    "defaultSourceType" TEXT NOT NULL DEFAULT 'custom_reference',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportBatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_id_campaignId_key" ON "ImportBatch"("id", "campaignId");

-- CreateTable
CREATE TABLE "ImportBatchFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importBatchId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT,
    "mimeType" TEXT,
    "checksum" TEXT,
    "sizeBytes" INTEGER,
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'staged',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportBatchFile_importBatchId_campaignId_fkey" FOREIGN KEY ("importBatchId", "campaignId") REFERENCES "ImportBatch" ("id", "campaignId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImportBatchFile_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CanonicalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "factType" TEXT NOT NULL,
    "canonicalValue" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CanonicalEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalEntry_id_campaignId_key" ON "CanonicalEntry"("id", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalEntry_campaignId_subject_factType_key" ON "CanonicalEntry"("campaignId", "subject", "factType");

-- CreateIndex
CREATE UNIQUE INDEX "CanonFact_id_campaignId_key" ON "CanonFact"("id", "campaignId");

-- CreateTable
CREATE TABLE "CanonicalEntrySourceFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "canonicalEntryId" TEXT NOT NULL,
    "canonFactId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CanonicalEntrySourceFact_canonicalEntryId_campaignId_fkey" FOREIGN KEY ("canonicalEntryId", "campaignId") REFERENCES "CanonicalEntry" ("id", "campaignId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CanonicalEntrySourceFact_canonFactId_campaignId_fkey" FOREIGN KEY ("canonFactId", "campaignId") REFERENCES "CanonFact" ("id", "campaignId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SourceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'custom_reference',
    "processingStatus" TEXT NOT NULL DEFAULT 'processed',
    "extractionError" TEXT,
    "extractedText" TEXT,
    "pageCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceDocument_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SourceDocument_importBatchId_campaignId_fkey" FOREIGN KEY ("importBatchId", "campaignId") REFERENCES "ImportBatch" ("id", "campaignId") ON DELETE NO ACTION ON UPDATE CASCADE
);
INSERT INTO "new_SourceDocument" (
    "id",
    "campaignId",
    "importBatchId",
    "originalName",
    "storedPath",
    "mimeType",
    "checksum",
    "sourceType",
    "processingStatus",
    "extractionError",
    "extractedText",
    "pageCount",
    "createdAt",
    "updatedAt"
) SELECT
    "id",
    "campaignId",
    NULL,
    "originalName",
    "storedPath",
    "mimeType",
    "checksum",
    'custom_reference',
    'processed',
    NULL,
    "extractedText",
    "pageCount",
    "createdAt",
    "updatedAt"
FROM "SourceDocument";
DROP TABLE "SourceDocument";
ALTER TABLE "new_SourceDocument" RENAME TO "SourceDocument";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ImportBatch_campaignId_createdAt_idx" ON "ImportBatch"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_campaignId_status_idx" ON "ImportBatch"("campaignId", "status");

-- CreateIndex
CREATE INDEX "ImportBatchFile_importBatchId_createdAt_idx" ON "ImportBatchFile"("importBatchId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatchFile_campaignId_status_idx" ON "ImportBatchFile"("campaignId", "status");

-- CreateIndex
CREATE INDEX "CanonicalEntry_campaignId_subject_idx" ON "CanonicalEntry"("campaignId", "subject");

-- CreateIndex
CREATE INDEX "CanonicalEntry_campaignId_factType_idx" ON "CanonicalEntry"("campaignId", "factType");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalEntrySourceFact_canonicalEntryId_canonFactId_key" ON "CanonicalEntrySourceFact"("canonicalEntryId", "canonFactId");

-- CreateIndex
CREATE INDEX "CanonicalEntrySourceFact_canonFactId_idx" ON "CanonicalEntrySourceFact"("canonFactId");

-- CreateIndex
CREATE INDEX "SourceDocument_campaignId_createdAt_idx" ON "SourceDocument"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "SourceDocument_importBatchId_idx" ON "SourceDocument"("importBatchId");

-- CreateIndex
CREATE INDEX "SourceDocument_campaignId_processingStatus_idx" ON "SourceDocument"("campaignId", "processingStatus");
