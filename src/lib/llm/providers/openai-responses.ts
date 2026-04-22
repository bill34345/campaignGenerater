import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { extractFactsFromChunks } from "@/lib/llm/extract-facts";
import {
  buildMockExtractedFacts,
  buildMockQuestDraft,
  shouldUseMockLlmProvider,
  throwMockProviderFailure,
} from "@/lib/llm/mock-provider";
import type { LlmProviderAdapter } from "@/lib/llm/provider-types";
import { createOpenAIResponsesClient } from "@/lib/openai/client";
import { generateQuestDraft } from "@/lib/quests/generate-quest";

const testConnectionSchema = z
  .object({
    status: z.literal("ok"),
  })
  .strict();

const DEFAULT_MODEL = "gpt-4.1-mini";

export const openAIResponsesAdapter: LlmProviderAdapter = {
  provider: "openai_responses",
  defaultQuestModel: DEFAULT_MODEL,
  defaultFactModel: DEFAULT_MODEL,
  async generateQuestDraft({
    config,
    workingContext,
    questRequest,
    onStageChange,
  }) {
    if (shouldUseMockLlmProvider()) {
      throwMockProviderFailure(config);
      return buildMockQuestDraft({
        provider: "openai_responses",
        workingContext,
        questRequest,
      });
    }

    await onStageChange?.("calling_provider", "Calling OpenAI Responses...");

    return generateQuestDraft({
      workingContext,
      questRequest,
      model: config.llmModel ?? DEFAULT_MODEL,
      openAI: {
        byokKey: config.llmApiKey,
        baseURL: config.llmBaseUrl ?? undefined,
      },
    });
  },
  async extractFactsFromChunks({ config, campaignId, chunks }) {
    if (shouldUseMockLlmProvider()) {
      throwMockProviderFailure(config);
      return buildMockExtractedFacts({
        campaignId,
        chunks,
      });
    }

    return extractFactsFromChunks({
      campaignId,
      chunks,
      model: config.llmModel ?? DEFAULT_MODEL,
      openAI: {
        byokKey: config.llmApiKey,
        baseURL: config.llmBaseUrl ?? undefined,
      },
    });
  },
  async testConnection({ config }) {
    if (shouldUseMockLlmProvider()) {
      throwMockProviderFailure(config);
      return {
        provider: "openai_responses",
        model: config.llmModel ?? DEFAULT_MODEL,
      };
    }

    const client = createOpenAIResponsesClient({
      byokKey: config.llmApiKey,
      baseURL: config.llmBaseUrl ?? undefined,
    });
    const model = config.llmModel ?? DEFAULT_MODEL;

    await client.responses.parse({
      model,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: 'Return {"status":"ok"}.' }],
        },
      ],
      text: {
        format: zodTextFormat(testConnectionSchema, "provider_connection_test"),
      },
    });

    return {
      provider: "openai_responses",
      model,
    };
  },
};
