import { expect, test } from "@playwright/test";
import {
  configureProvider,
  createCampaign,
  ensureTownProfile,
  expectFallbackVisible,
  expectGenerationSourceVisible,
  expectProviderBadge,
  goBackToOverview,
  openLlmSettings,
  providerCardText,
  requestQuestAndOpenDraft,
  uniqueCampaignName,
} from "../support/workbench";

test("@provider missing provider key falls back and exposes provenance", async ({
  page,
}) => {
  const campaignName = uniqueCampaignName("Fallback Missing Key");

  await createCampaign(page, { campaignName });
  await ensureTownProfile(page);
  await openLlmSettings(page);
  await configureProvider(page, {
    provider: "openai_chat",
    apiKey: "playwright-openai-chat-key",
  });
  await goBackToOverview(page);

  const campaignBaseUrl = page.url().replace(/\/canon$/, "");
  await page.goto(`${campaignBaseUrl}/settings/llm`);
  await configureProvider(page, {
    provider: "openai_chat",
    apiKey: "",
  });
  await page.goto(`${campaignBaseUrl}/quests/new`);
  await expect(page.getByRole("heading", { name: campaignName })).toBeVisible();
  await requestQuestAndOpenDraft(page);

  await expectGenerationSourceVisible(page);
  await expectProviderBadge(page, providerCardText("openai_chat"));
  await expectFallbackVisible(page);
  await expect(page.getByText(/API key/i).first()).toBeVisible();
});
