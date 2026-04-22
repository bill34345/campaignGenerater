-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QuestRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "townProfileId" TEXT,
    "requestMode" TEXT NOT NULL DEFAULT 'standard',
    "generationStatus" TEXT NOT NULL DEFAULT 'queued',
    "generationStage" TEXT NOT NULL DEFAULT 'queued',
    "generationProgressMessage" TEXT,
    "generationPreviewText" TEXT,
    "generationStartedAt" DATETIME,
    "generationCompletedAt" DATETIME,
    "generationFailedAt" DATETIME,
    "generationLastErrorCode" TEXT,
    "generationLastErrorMessage" TEXT,
    "townName" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'zh',
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
INSERT INTO "new_QuestRequest" ("campaignId", "createdAt", "desiredLength", "extraContext", "id", "localTension", "locale", "mainPlotRelation", "questType", "requestMode", "townName", "townProfileId", "townVibe", "updatedAt") SELECT "campaignId", "createdAt", "desiredLength", "extraContext", "id", "localTension", "locale", "mainPlotRelation", "questType", "requestMode", "townName", "townProfileId", "townVibe", "updatedAt" FROM "QuestRequest";
DROP TABLE "QuestRequest";
ALTER TABLE "new_QuestRequest" RENAME TO "QuestRequest";
CREATE INDEX "QuestRequest_campaignId_createdAt_idx" ON "QuestRequest"("campaignId", "createdAt");
CREATE INDEX "QuestRequest_townProfileId_idx" ON "QuestRequest"("townProfileId");
CREATE INDEX "QuestRequest_campaignId_generationStatus_createdAt_idx" ON "QuestRequest"("campaignId", "generationStatus", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
