import { expect, test } from "@playwright/test";
import {
  createQuestDraftSeed,
  fixturePath,
  saveQuestDraft,
  uniqueCampaignName,
} from "../support/workbench";

test("@critical quest editor persists title and summary after save and refresh", async ({
  page,
}) => {
  const renamedTitle = "Ashes Beneath Duskport";
  const summary = "GM summary updated by the E2E persistence test.";

  await createQuestDraftSeed(page, {
    campaign: {
      campaignName: uniqueCampaignName("Quest Save"),
    },
    provider: {
      provider: "openai_responses",
      apiKey: "playwright-openai-responses-key",
      testConnection: true,
    },
    uploads: [fixturePath("sample-quest-note.txt")],
    canonFactText: "Duskport",
  });

  await page.locator("#quest-title").fill(renamedTitle);
  await page.locator("#quest-summary").fill(summary);
  await saveQuestDraft(page);
  await page.reload();

  await expect(page.locator("#quest-title")).toHaveValue(renamedTitle);
  await expect(page.locator("#quest-summary")).toHaveValue(summary);
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();
});
