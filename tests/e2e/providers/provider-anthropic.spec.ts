import { test } from "@playwright/test";
import {
  configureProvider,
  createCampaign,
  ensureTownProfile,
  expectGenerationSourceVisible,
  expectProviderBadge,
  goBackToOverview,
  openLlmSettings,
  openQuestRequest,
  providerCardText,
  requestQuestAndOpenDraft,
  uniqueCampaignName,
} from "../support/workbench";

test("@provider Anthropic configuration persists and shows provider provenance", async ({
  page,
}) => {
  await createCampaign(page, {
    campaignName: uniqueCampaignName("Provider Anthropic"),
  });
  await ensureTownProfile(page);
  await openLlmSettings(page);
  await configureProvider(page, {
    provider: "anthropic",
    apiKey: "playwright-anthropic-key",
    testConnection: true,
  });
  await goBackToOverview(page);
  await openQuestRequest(page);
  await requestQuestAndOpenDraft(page);

  await expectGenerationSourceVisible(page);
  await expectProviderBadge(page, providerCardText("anthropic"));
});
