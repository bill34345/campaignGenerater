import type { FactExtractionChunk, ExtractedCampaignFact } from "@/lib/llm/extract-facts";
import type { TownQuestContext } from "@/lib/canon/context-builder";
import type { QuestGenerationDraft } from "@/lib/quests/quest-schema";
import type { CampaignLlmSettings, LlmProvider, QuestRequest } from "@/types/domain";

export type ResolvedLlmConfig = CampaignLlmSettings & {
  llmProvider: LlmProvider;
  llmApiKey: string | null;
  llmModel: string | null;
  llmBaseUrl: string | null;
};

export type TestLlmConnectionResult = {
  provider: LlmProvider;
  model: string;
};

export type LlmProviderAdapter = {
  provider: LlmProvider;
  defaultQuestModel: string;
  defaultFactModel: string;
  generateQuestDraft(input: {
    config: ResolvedLlmConfig;
    workingContext: TownQuestContext;
    questRequest: QuestRequest;
  }): Promise<QuestGenerationDraft>;
  extractFactsFromChunks(input: {
    config: ResolvedLlmConfig;
    campaignId: string;
    chunks: FactExtractionChunk[];
  }): Promise<ExtractedCampaignFact[]>;
  testConnection(input: {
    config: ResolvedLlmConfig;
  }): Promise<TestLlmConnectionResult>;
};

export type RecoverableLlmErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "authentication_error"
  | "insufficient_quota"
  | "openai_request_failed";
