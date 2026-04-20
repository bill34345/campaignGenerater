import { expect, test } from "@playwright/test";
import {
  createQuestDraftSeed,
  expectGenerationSourceVisible,
  expectProviderBadge,
  fixturePath,
  providerCardText,
  uniqueCampaignName,
} from "../support/workbench";

const liveEnabled = process.env.CODEX_E2E_LIVE_PROVIDER === "1";
const liveAnthropicKey = process.env.CODEX_E2E_LIVE_ANTHROPIC_API_KEY;

test.skip(
  !liveEnabled || !liveAnthropicKey,
  "Live Anthropic smoke requires CODEX_E2E_LIVE_PROVIDER=1 and CODEX_E2E_LIVE_ANTHROPIC_API_KEY.",
);

test("@live @provider Anthropic provider can authenticate and generate a quest", async ({
  page,
}) => {
  await createQuestDraftSeed(page, {
    campaign: {
      campaignName: uniqueCampaignName("Live Anthropic"),
    },
    provider: {
      provider: "anthropic",
      apiKey: liveAnthropicKey,
      model: process.env.CODEX_E2E_LIVE_ANTHROPIC_MODEL,
      baseUrl: process.env.CODEX_E2E_LIVE_ANTHROPIC_BASE_URL,
      testConnection: true,
    },
    uploads: [fixturePath("sample-quest-note.txt")],
    canonFactText: "Duskport",
  });

  await expectGenerationSourceVisible(page);
  await expectProviderBadge(page, providerCardText("anthropic"));
  await expect(page.locator("#quest-title")).not.toHaveValue("");
});
