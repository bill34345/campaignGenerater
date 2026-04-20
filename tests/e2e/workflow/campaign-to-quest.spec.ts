import { test } from "@playwright/test";
import {
  createQuestDraftSeed,
  expectGenerationSourceVisible,
  expectGmPreviewVisible,
  expectProviderBadge,
  fixturePath,
  providerCardText,
  uniqueCampaignName,
} from "../support/workbench";

test("@critical campaign workflow creates a quest draft and opens the GM preview", async ({
  page,
}) => {
  await createQuestDraftSeed(page, {
    campaign: {
      campaignName: uniqueCampaignName("Critical Flow"),
    },
    provider: {
      provider: "openai_chat",
      apiKey: "playwright-openai-chat-key",
      testConnection: true,
    },
    uploads: [fixturePath("sample-quest-note.txt")],
    canonFactText: "Duskport",
  });

  await expectGenerationSourceVisible(page);
  await expectProviderBadge(page, providerCardText("openai_chat"));
  await expectGmPreviewVisible(page);
});
