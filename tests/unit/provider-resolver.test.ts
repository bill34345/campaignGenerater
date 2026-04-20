import { describe, expect, it } from "vitest";
import { resolveCampaignLlmConfig, resolveLlmProvider } from "@/lib/llm/provider-resolver";

describe("provider resolver", () => {
  it("selects the configured adapter", () => {
    const { adapter, config } = resolveLlmProvider({
      llmProvider: "openai_chat",
      llmApiKey: "chat-key",
      llmModel: "gpt-4.1-mini",
      llmBaseUrl: "https://example.com",
    });

    expect(adapter.provider).toBe("openai_chat");
    expect(config).toMatchObject({
      llmProvider: "openai_chat",
      llmApiKey: "chat-key",
      llmModel: "gpt-4.1-mini",
      llmBaseUrl: "https://example.com",
    });
  });

  it("normalizes empty optional settings", () => {
    const config = resolveCampaignLlmConfig({
      llmProvider: "anthropic",
      llmApiKey: "  key  ",
      llmModel: "",
      llmBaseUrl: null,
    });

    expect(config).toMatchObject({
      llmProvider: "anthropic",
      llmApiKey: "key",
      llmModel: null,
      llmBaseUrl: null,
    });
  });
});
