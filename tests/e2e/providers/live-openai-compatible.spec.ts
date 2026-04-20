import { expect, test } from "@playwright/test";
import {
  createQuestDraftSeed,
  expectGenerationSourceVisible,
  expectProviderBadge,
  fixturePath,
  providerCardText,
  uniqueCampaignName,
} from "../support/workbench";
import type { LlmProvider } from "@/types/domain";

const liveEnabled = process.env.CODEX_E2E_LIVE_PROVIDER === "1";
const liveOpenAiKey = process.env.CODEX_E2E_LIVE_OPENAI_API_KEY;
const liveOpenAiProvider = (
  process.env.CODEX_E2E_LIVE_OPENAI_PROVIDER ?? "openai_responses"
) as LlmProvider;

test.skip(
  !liveEnabled || !liveOpenAiKey,
  "Live OpenAI-compatible smoke requires CODEX_E2E_LIVE_PROVIDER=1 and CODEX_E2E_LIVE_OPENAI_API_KEY.",
);

test("@live @provider OpenAI-compatible provider can authenticate and generate a quest", async ({
  page,
}) => {
  await createQuestDraftSeed(page, {
    campaign: {
      campaignName: uniqueCampaignName("Live OpenAI"),
    },
    provider: {
      provider: liveOpenAiProvider,
      apiKey: liveOpenAiKey,
      model: process.env.CODEX_E2E_LIVE_OPENAI_MODEL,
      baseUrl: process.env.CODEX_E2E_LIVE_OPENAI_BASE_URL,
      testConnection: true,
    },
    uploads: [fixturePath("sample-quest-note.txt")],
    canonFactText: "Duskport",
  });

  await expectGenerationSourceVisible(page);
  await expectProviderBadge(page, providerCardText(liveOpenAiProvider));
  await expect(page.locator("#quest-title")).not.toHaveValue("");
});
