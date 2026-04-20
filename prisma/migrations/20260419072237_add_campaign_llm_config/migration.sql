-- AlterTable
ALTER TABLE "QuestDraft" ADD COLUMN "generationProvider" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "system" TEXT NOT NULL DEFAULT '5e',
    "partyLevel" INTEGER NOT NULL,
    "tone" TEXT NOT NULL,
    "contentConstraints" TEXT,
    "llmProvider" TEXT NOT NULL DEFAULT 'openai_responses',
    "llmApiKey" TEXT,
    "llmModel" TEXT,
    "llmBaseUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Campaign" ("contentConstraints", "createdAt", "id", "name", "partyLevel", "system", "tone", "updatedAt") SELECT "contentConstraints", "createdAt", "id", "name", "partyLevel", "system", "tone", "updatedAt" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
