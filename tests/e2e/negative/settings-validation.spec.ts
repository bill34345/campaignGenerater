import { expect, test } from "@playwright/test";
import {
  createCampaign,
  openLlmSettings,
  uniqueCampaignName,
} from "../support/workbench";

test("@negative provider settings test shows a visible non-destructive error state", async ({
  page,
}) => {
  await createCampaign(page, {
    campaignName: uniqueCampaignName("Settings Validation"),
  });

  await openLlmSettings(page);
  await page.locator("#llm-provider").selectOption("anthropic");
  await page.locator("#llm-api-key").fill("");
  await page.getByTestId("test-llm-settings").click();

  await expect(page.getByTestId("llm-settings-error")).toBeVisible();
  await expect(page.locator("#llm-provider")).toHaveValue("anthropic");
  await expect(page.locator("#llm-api-key")).toHaveValue("");
});
