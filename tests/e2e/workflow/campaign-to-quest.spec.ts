import { expect, test } from "@playwright/test";
import {
  createCampaign,
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

test("@critical quick start flow creates a draft from an empty campaign", async ({
  page,
}) => {
  await createCampaign(page, {
    campaignName: uniqueCampaignName("Quick Start"),
  });

  await page.getByTestId("quick-start-cta").click();
  await expect(page).toHaveURL(/quick_start=1/);

  await page.locator("#town-name").fill("Fog Harbor");
  await page.locator("#town-vibe").fill("A wet harbor town with tolling bells.");
  await page.locator("#local-tension").fill("Dock crews vanish after dusk.");
  await page.locator("#quest-type").selectOption("investigation");
  await page.locator("#desired-length").selectOption("3h");
  await page
    .locator("#extra-context")
    .fill("Find the missing dockworkers before the tide carries them under.");

  const quickStartForm = page.getByTestId("quick-start-form");
  await quickStartForm.locator('button[type="submit"]').click();
  await expect(page.getByTestId("quest-generation-status")).toBeVisible();
  await page.waitForURL(/\/campaigns\/[^/]+\/quests\/(?!new(?:[/?#]|$))[^/?#]+$/);

  await expect(page.getByTestId("quick-start-draft-badge")).toBeVisible();
  await expect(page.locator("#quest-title")).toBeVisible();
  await expectGmPreviewVisible(page);
});
