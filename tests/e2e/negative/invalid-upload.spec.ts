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

test("@negative unsupported upload shows a visible failed state", async ({ page }) => {
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

  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/imports\/[^/?#]+$/);
  await expect(page.getByText("unsupported-upload.json")).toBeVisible();
  await expect(
    page.getByText(/The uploaded file format is not supported\./).first(),
  ).toBeVisible();
  await expect(page.getByTestId("start-extraction")).toBeDisabled();
});
