ALTER TABLE "QuestDraft" ADD COLUMN "generationMode" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "QuestDraft" ADD COLUMN "generationModel" TEXT;
ALTER TABLE "QuestDraft" ADD COLUMN "fallbackReason" TEXT;
ALTER TABLE "QuestDraft" ADD COLUMN "generationErrorCode" TEXT;
