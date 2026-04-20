import { expect, test } from "@playwright/test";
import {
  configureProvider,
  createCampaign,
  fixturePath,
  goBackToOverview,
  openLlmSettings,
  uniqueCampaignName,
  uploadDocument,
} from "../support/workbench";

test("@negative unsupported upload shows a visible localized error", async ({ page }) => {
  await createCampaign(page, {
    campaignName: uniqueCampaignName("Invalid Upload"),
  });
  await openLlmSettings(page);
  await configureProvider(page, {
    provider: "openai_chat",
    apiKey: "playwright-openai-chat-key",
  });
  await goBackToOverview(page);

  await uploadDocument(page, fixturePath("unsupported-upload.json"));

  await expect(
    page.getByText(/Unsupported file type|不支持的文件类型/u).first(),
  ).toBeVisible();
});
