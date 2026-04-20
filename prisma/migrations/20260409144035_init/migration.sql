-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "system" TEXT NOT NULL DEFAULT '5e',
    "partyLevel" INTEGER NOT NULL,
    "tone" TEXT NOT NULL,
    "contentConstraints" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "extractedText" TEXT,
    "pageCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "checksum" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CanonFact" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CampaignDelta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "sourceFactId" TEXT,
    "deltaType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TownProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vibe" TEXT,
    "tension" TEXT,
    "notes" TEXT,
    "questHooksJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuestRequest" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuestDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "questRequestId" TEXT,
    "title" TEXT NOT NULL,
    "premise" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "scenesJson" TEXT NOT NULL,
    "npcsJson" TEXT NOT NULL,
    "encountersJson" TEXT NOT NULL,
    "rewardsJson" TEXT NOT NULL,
    "returnToMainPlot" TEXT NOT NULL,
    "gmSummary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "SourceDocument_campaignId_createdAt_idx" ON "SourceDocument"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentChunk_sourceDocumentId_chunkIndex_idx" ON "DocumentChunk"("sourceDocumentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "DocumentChunk_campaignId_createdAt_idx" ON "DocumentChunk"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "CanonFact_campaignId_subject_idx" ON "CanonFact"("campaignId", "subject");

-- CreateIndex
CREATE INDEX "CanonFact_campaignId_factType_idx" ON "CanonFact"("campaignId", "factType");

-- CreateIndex
CREATE INDEX "CampaignDelta_campaignId_createdAt_idx" ON "CampaignDelta"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "TownProfile_campaignId_createdAt_idx" ON "TownProfile"("campaignId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TownProfile_campaignId_name_key" ON "TownProfile"("campaignId", "name");

-- CreateIndex
CREATE INDEX "QuestRequest_campaignId_createdAt_idx" ON "QuestRequest"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "QuestRequest_townProfileId_idx" ON "QuestRequest"("townProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestDraft_questRequestId_key" ON "QuestDraft"("questRequestId");

-- CreateIndex
CREATE INDEX "QuestDraft_campaignId_createdAt_idx" ON "QuestDraft"("campaignId", "createdAt");
