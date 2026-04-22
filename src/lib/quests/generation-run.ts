import { buildFallbackQuestDraft } from "@/lib/quests/fallback-draft";
import type { QuestGenerationDraft } from "@/lib/quests/quest-schema";
import { getLlmErrorCode, mapRecoverableLlmError } from "@/lib/llm/provider-errors";
import type {
  QuestGenerationStageChangeCallback,
  QuestGenerationTextDeltaCallback,
} from "@/lib/llm/provider-types";
import { resolveLlmProvider } from "@/lib/llm/provider-resolver";
import type { QuestRequest } from "@/types/domain";
import type { TownQuestContext } from "@/lib/canon/context-builder";
import type { CampaignLlmSettings, LlmProvider } from "@/types/domain";

export type QuestGenerationMode = "provider" | "fallback" | "unknown" | "openai";
export type QuestFallbackReason =
  | "missing_api_key"
  | "invalid_api_key"
  | "authentication_error"
  | "insufficient_quota"
  | "openai_request_failed";

export type QuestGenerationMeta = {
  generationMode: QuestGenerationMode;
  generationProvider: LlmProvider | null;
  generationModel: string | null;
  fallbackReason: QuestFallbackReason | null;
  generationErrorCode: string | null;
};

export type RunQuestGenerationInput = {
  llmSettings: CampaignLlmSettings;
  workingContext: TownQuestContext;
  questRequest: QuestRequest;
  onStageChange?: QuestGenerationStageChangeCallback;
  onTextDelta?: QuestGenerationTextDeltaCallback;
};

async function emitStageChange(
  callback: QuestGenerationStageChangeCallback | undefined,
  stage: "calling_provider" | "streaming" | "failed",
  message?: string,
) {
  if (!callback) {
    return;
  }

  try {
    await callback(stage, message);
  } catch {
    // Progress callbacks must never change generation behavior.
  }
}

export async function runQuestGeneration({
  llmSettings,
  workingContext,
  questRequest,
  onStageChange,
  onTextDelta,
}: RunQuestGenerationInput): Promise<{
  draft: QuestGenerationDraft;
  meta: QuestGenerationMeta;
}> {
  const { config, adapter } = resolveLlmProvider(llmSettings);

  if (!config.llmApiKey) {
    return {
      draft: buildFallbackQuestDraft({
        workingContext,
        questRequest,
      }),
      meta: {
        generationMode: "fallback",
        generationProvider: config.llmProvider,
        generationModel: null,
        fallbackReason: "missing_api_key",
        generationErrorCode: null,
      },
    };
  }

  try {
    const draft = await adapter.generateQuestDraft({
      config,
      workingContext,
      questRequest,
      onStageChange,
      onTextDelta,
    });

    return {
      draft,
      meta: {
        generationMode: "provider",
        generationProvider: config.llmProvider,
        generationModel: config.llmModel ?? adapter.defaultQuestModel,
        fallbackReason: null,
        generationErrorCode: null,
      },
    };
  } catch (error) {
    const fallbackReason = mapRecoverableLlmError(error);

    if (!fallbackReason) {
      await emitStageChange(onStageChange, "failed", "Quest generation failed.");
      throw error;
    }

    return {
      draft: buildFallbackQuestDraft({
        workingContext,
        questRequest,
      }),
      meta: {
        generationMode: "fallback",
        generationProvider: config.llmProvider,
        generationModel: null,
        fallbackReason: fallbackReason ?? "openai_request_failed",
        generationErrorCode: getLlmErrorCode(error),
      },
    };
  }
}
