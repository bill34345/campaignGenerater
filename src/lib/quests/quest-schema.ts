import { z } from "zod";
import { questDraftSchema } from "@/types/domain";

export const questGenerationSchema = questDraftSchema.omit({
  id: true,
  campaignId: true,
  questRequestId: true,
  generationMode: true,
  generationModel: true,
  fallbackReason: true,
  generationErrorCode: true,
});

export type QuestGenerationDraft = z.infer<typeof questGenerationSchema>;
