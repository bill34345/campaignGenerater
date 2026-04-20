/*
  Warnings:

  - You are about to drop the column `encountersJson` on the `QuestDraft` table. All the data in the column will be lost.
  - You are about to drop the column `npcsJson` on the `QuestDraft` table. All the data in the column will be lost.
  - You are about to drop the column `rewardsJson` on the `QuestDraft` table. All the data in the column will be lost.
  - You are about to drop the column `scenesJson` on the `QuestDraft` table. All the data in the column will be lost.
  - You are about to drop the column `questHooksJson` on the `TownProfile` table. All the data in the column will be lost.
  - Added the required column `encounters` to the `QuestDraft` table without a default value. This is not possible if the table is not empty.
  - Added the required column `npcs` to the `QuestDraft` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rewards` to the `QuestDraft` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scenes` to the `QuestDraft` table without a default value. This is not possible if the table is not empty.
  - Added the required column `questHooks` to the `TownProfile` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CampaignDelta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "sourceFactId" TEXT,
    "deltaType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignDelta_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CampaignDelta_sourceFactId_fkey" FOREIGN KEY ("sourceFactId") REFERENCES "CanonFact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CampaignDelta" ("campaignId", "createdAt", "deltaType", "id", "sourceFactId", "summary") SELECT "campaignId", "createdAt", "deltaType", "id", "sourceFactId", "summary" FROM "CampaignDelta";
DROP TABLE "CampaignDelta";
ALTER TABLE "new_CampaignDelta" RENAME TO "CampaignDelta";
CREATE INDEX "CampaignDelta_campaignId_createdAt_idx" ON "CampaignDelta"("campaignId", "createdAt");
CREATE TABLE "new_CanonFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "documentChunkId" TEXT,
    "subject" TEXT NOT NULL,
    "factType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "confidence" REAL,
    "evidence" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CanonFact_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CanonFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CanonFact_documentChunkId_fkey" FOREIGN KEY ("documentChunkId") REFERENCES "DocumentChunk" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CanonFact" ("campaignId", "confidence", "createdAt", "documentChunkId", "evidence", "factType", "id", "priority", "sourceDocumentId", "status", "subject", "updatedAt", "value") SELECT "campaignId", "confidence", "createdAt", "documentChunkId", "evidence", "factType", "id", "priority", "sourceDocumentId", "status", "subject", "updatedAt", "value" FROM "CanonFact";
DROP TABLE "CanonFact";
ALTER TABLE "new_CanonFact" RENAME TO "CanonFact";
CREATE INDEX "CanonFact_campaignId_subject_idx" ON "CanonFact"("campaignId", "subject");
CREATE INDEX "CanonFact_campaignId_factType_idx" ON "CanonFact"("campaignId", "factType");
CREATE TABLE "new_DocumentChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "checksum" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentChunk_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentChunk_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DocumentChunk" ("campaignId", "checksum", "chunkIndex", "content", "createdAt", "id", "pageEnd", "pageStart", "sourceDocumentId", "tokenCount") SELECT "campaignId", "checksum", "chunkIndex", "content", "createdAt", "id", "pageEnd", "pageStart", "sourceDocumentId", "tokenCount" FROM "DocumentChunk";
DROP TABLE "DocumentChunk";
ALTER TABLE "new_DocumentChunk" RENAME TO "DocumentChunk";
CREATE INDEX "DocumentChunk_sourceDocumentId_chunkIndex_idx" ON "DocumentChunk"("sourceDocumentId", "chunkIndex");
CREATE INDEX "DocumentChunk_campaignId_createdAt_idx" ON "DocumentChunk"("campaignId", "createdAt");
CREATE TABLE "new_QuestDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "questRequestId" TEXT,
    "title" TEXT NOT NULL,
    "premise" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "scenes" JSONB NOT NULL,
    "npcs" JSONB NOT NULL,
    "encounters" JSONB NOT NULL,
    "rewards" JSONB NOT NULL,
    "returnToMainPlot" TEXT NOT NULL,
    "gmSummary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestDraft_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestDraft_questRequestId_fkey" FOREIGN KEY ("questRequestId") REFERENCES "QuestRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QuestDraft" ("campaignId", "createdAt", "gmSummary", "hook", "id", "premise", "questRequestId", "returnToMainPlot", "title", "updatedAt") SELECT "campaignId", "createdAt", "gmSummary", "hook", "id", "premise", "questRequestId", "returnToMainPlot", "title", "updatedAt" FROM "QuestDraft";
DROP TABLE "QuestDraft";
ALTER TABLE "new_QuestDraft" RENAME TO "QuestDraft";
CREATE UNIQUE INDEX "QuestDraft_questRequestId_key" ON "QuestDraft"("questRequestId");
CREATE INDEX "QuestDraft_campaignId_createdAt_idx" ON "QuestDraft"("campaignId", "createdAt");
CREATE TABLE "new_QuestRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "townProfileId" TEXT,
    "townName" TEXT NOT NULL,
    "townVibe" TEXT,
    "localTension" TEXT,
    "questType" TEXT,
    "mainPlotRelation" TEXT,
    "desiredLength" TEXT,
    "extraContext" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestRequest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestRequest_townProfileId_fkey" FOREIGN KEY ("townProfileId") REFERENCES "TownProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QuestRequest" ("campaignId", "createdAt", "desiredLength", "extraContext", "id", "localTension", "mainPlotRelation", "questType", "townName", "townProfileId", "townVibe", "updatedAt") SELECT "campaignId", "createdAt", "desiredLength", "extraContext", "id", "localTension", "mainPlotRelation", "questType", "townName", "townProfileId", "townVibe", "updatedAt" FROM "QuestRequest";
DROP TABLE "QuestRequest";
ALTER TABLE "new_QuestRequest" RENAME TO "QuestRequest";
CREATE INDEX "QuestRequest_campaignId_createdAt_idx" ON "QuestRequest"("campaignId", "createdAt");
CREATE INDEX "QuestRequest_townProfileId_idx" ON "QuestRequest"("townProfileId");
CREATE TABLE "new_SourceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "extractedText" TEXT,
    "pageCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceDocument_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SourceDocument" ("campaignId", "checksum", "createdAt", "extractedText", "id", "mimeType", "originalName", "pageCount", "storedPath", "updatedAt") SELECT "campaignId", "checksum", "createdAt", "extractedText", "id", "mimeType", "originalName", "pageCount", "storedPath", "updatedAt" FROM "SourceDocument";
DROP TABLE "SourceDocument";
ALTER TABLE "new_SourceDocument" RENAME TO "SourceDocument";
CREATE INDEX "SourceDocument_campaignId_createdAt_idx" ON "SourceDocument"("campaignId", "createdAt");
CREATE TABLE "new_TownProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vibe" TEXT,
    "tension" TEXT,
    "notes" TEXT,
    "questHooks" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TownProfile_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TownProfile" ("campaignId", "createdAt", "id", "name", "notes", "tension", "updatedAt", "vibe") SELECT "campaignId", "createdAt", "id", "name", "notes", "tension", "updatedAt", "vibe" FROM "TownProfile";
DROP TABLE "TownProfile";
ALTER TABLE "new_TownProfile" RENAME TO "TownProfile";
CREATE INDEX "TownProfile_campaignId_createdAt_idx" ON "TownProfile"("campaignId", "createdAt");
CREATE UNIQUE INDEX "TownProfile_campaignId_name_key" ON "TownProfile"("campaignId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
