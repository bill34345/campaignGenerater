import { campaignLlmSettingsSchema, type CampaignLlmSettings } from "@/types/domain";
import type { LlmProviderAdapter, ResolvedLlmConfig } from "@/lib/llm/provider-types";
import { anthropicAdapter } from "@/lib/llm/providers/anthropic";
import { openAIChatAdapter } from "@/lib/llm/providers/openai-chat";
import { openAIResponsesAdapter } from "@/lib/llm/providers/openai-responses";

const providerAdapters: Record<ResolvedLlmConfig["llmProvider"], LlmProviderAdapter> = {
  openai_responses: openAIResponsesAdapter,
  openai_chat: openAIChatAdapter,
  anthropic: anthropicAdapter,
};

export function resolveCampaignLlmConfig(settings: CampaignLlmSettings): ResolvedLlmConfig {
  return campaignLlmSettingsSchema.parse({
    llmProvider: settings.llmProvider ?? "openai_responses",
    llmApiKey: settings.llmApiKey ?? null,
    llmModel: settings.llmModel ?? null,
    llmBaseUrl: settings.llmBaseUrl ?? null,
  });
}

export function resolveLlmProvider(settings: CampaignLlmSettings) {
  const config = resolveCampaignLlmConfig(settings);

  return {
    config,
    adapter: providerAdapters[config.llmProvider],
  };
}
