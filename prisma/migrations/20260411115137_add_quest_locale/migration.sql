-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_QuestDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "questRequestId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'zh',
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
INSERT INTO "new_QuestDraft" ("campaignId", "createdAt", "encounters", "gmSummary", "hook", "id", "npcs", "premise", "questRequestId", "returnToMainPlot", "rewards", "scenes", "title", "updatedAt") SELECT "campaignId", "createdAt", "encounters", "gmSummary", "hook", "id", "npcs", "premise", "questRequestId", "returnToMainPlot", "rewards", "scenes", "title", "updatedAt" FROM "QuestDraft";
DROP TABLE "QuestDraft";
ALTER TABLE "new_QuestDraft" RENAME TO "QuestDraft";
CREATE UNIQUE INDEX "QuestDraft_questRequestId_key" ON "QuestDraft"("questRequestId");
CREATE INDEX "QuestDraft_campaignId_createdAt_idx" ON "QuestDraft"("campaignId", "createdAt");
CREATE TABLE "new_QuestRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "townProfileId" TEXT,
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
INSERT INTO "new_QuestRequest" ("campaignId", "createdAt", "desiredLength", "extraContext", "id", "localTension", "mainPlotRelation", "questType", "townName", "townProfileId", "townVibe", "updatedAt") SELECT "campaignId", "createdAt", "desiredLength", "extraContext", "id", "localTension", "mainPlotRelation", "questType", "townName", "townProfileId", "townVibe", "updatedAt" FROM "QuestRequest";
DROP TABLE "QuestRequest";
ALTER TABLE "new_QuestRequest" RENAME TO "QuestRequest";
CREATE INDEX "QuestRequest_campaignId_createdAt_idx" ON "QuestRequest"("campaignId", "createdAt");
CREATE INDEX "QuestRequest_townProfileId_idx" ON "QuestRequest"("townProfileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
