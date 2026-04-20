import { expect, test } from "@playwright/test";
import {
  createQuestDraftSeed,
  fixturePath,
  saveQuestDraft,
  uniqueCampaignName,
} from "../support/workbench";

test("@critical Chinese source materials flow stays in Chinese after generation and save", async ({
  page,
}) => {
  const renamedTitle = "旧钟之下";

  await createQuestDraftSeed(page, {
    campaign: {
      campaignName: uniqueCampaignName("中文素材流程"),
      tone: "阴雨海港、疑云重重、带一点政治压力",
      contentConstraints: "不要血腥，不要强制背叛桥段。",
    },
    provider: {
      provider: "anthropic",
      apiKey: "playwright-anthropic-key",
      testConnection: true,
    },
    uploads: [
      fixturePath("official-module-excerpt.zh.md"),
      fixturePath("gm-overrides.zh.md"),
    ],
    canonFactText: "town-landmark",
  });

  await page.locator("#quest-title").fill(renamedTitle);
  await saveQuestDraft(page);
  await page.reload();

  await expect(page.locator("#quest-title")).toHaveValue(renamedTitle);
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();
});
