import { z } from "zod";
import { questDraftSchema } from "@/types/domain";

const editableDraftSchema = questDraftSchema.pick({
  title: true,
  premise: true,
  hook: true,
  scenes: true,
  npcs: true,
  rewards: true,
  returnToMainPlot: true,
  gmSummary: true,
});

export const questDraftPatchSchema = editableDraftSchema.partial().strict();

export type QuestDraftPatch = z.infer<typeof questDraftPatchSchema>;

export function toQuestDraftRecord(
  draft: {
    id: string;
    campaignId: string;
    questRequestId: string | null;
    locale: string;
    generationMode: string;
    generationProvider: string | null;
    generationModel: string | null;
    fallbackReason: string | null;
    generationErrorCode: string | null;
    title: string;
    premise: string;
    hook: string;
    scenes: unknown;
    npcs: unknown;
    encounters: unknown;
    rewards: unknown;
    returnToMainPlot: string;
    gmSummary: string;
  },
) {
  return questDraftSchema.parse({
    id: draft.id,
    campaignId: draft.campaignId,
    questRequestId: draft.questRequestId,
    locale: draft.locale,
    generationMode: draft.generationMode,
    generationProvider: draft.generationProvider,
    generationModel: draft.generationModel,
    fallbackReason: draft.fallbackReason,
    generationErrorCode: draft.generationErrorCode,
    title: draft.title,
    premise: draft.premise,
    hook: draft.hook,
    scenes: draft.scenes,
    npcs: draft.npcs,
    encounters: draft.encounters,
    rewards: draft.rewards,
    returnToMainPlot: draft.returnToMainPlot,
    gmSummary: draft.gmSummary,
  });
}
