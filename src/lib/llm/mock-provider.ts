import { env } from "@/lib/env";
import { extractFallbackFactsFromChunks } from "@/lib/llm/fallback-facts";
import type { FactExtractionChunk, ExtractedCampaignFact } from "@/lib/llm/extract-facts";
import { buildFallbackQuestDraft } from "@/lib/quests/fallback-draft";
import type { QuestGenerationDraft } from "@/lib/quests/quest-schema";
import type { ResolvedLlmConfig } from "@/lib/llm/provider-types";
import type { LlmProvider, QuestRequest } from "@/types/domain";
import type { TownQuestContext } from "@/lib/canon/context-builder";

export function shouldUseMockLlmProvider() {
  return env.llmMockEnabled;
}

export function throwMockProviderFailure(config: Pick<ResolvedLlmConfig, "llmApiKey">) {
  const apiKey = config.llmApiKey?.trim().toLowerCase();

  if (!apiKey) {
    return;
  }

  if (apiKey.includes("playwright-fail-invalid")) {
    throw Object.assign(new Error("Mock invalid API key."), {
      code: "invalid_api_key",
      status: 401,
    });
  }

  if (apiKey.includes("playwright-fail-auth")) {
    throw Object.assign(new Error("Mock authentication failure."), {
      code: "authentication_error",
      status: 401,
    });
  }

  if (apiKey.includes("playwright-fail-quota")) {
    throw Object.assign(new Error("Mock quota exhausted."), {
      code: "insufficient_quota",
      status: 429,
    });
  }
}

export function buildMockQuestDraft(input: {
  provider: LlmProvider;
  workingContext: TownQuestContext;
  questRequest: QuestRequest;
}): QuestGenerationDraft {
  const draft = buildFallbackQuestDraft({
    workingContext: input.workingContext,
    questRequest: input.questRequest,
  });

  return {
    ...draft,
    title: `${draft.title} (${input.provider})`,
  };
}

export function buildMockExtractedFacts(input: {
  campaignId: string;
  chunks: FactExtractionChunk[];
}): ExtractedCampaignFact[] {
  return extractFallbackFactsFromChunks({
    campaignId: input.campaignId,
    chunks: input.chunks,
  });
}
