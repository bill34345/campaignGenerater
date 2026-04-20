import { expect, test } from "@playwright/test";
import { createCampaign, uniqueCampaignName } from "../support/workbench";

test("@negative quest request is blocked when no town-backed canon exists", async ({
  page,
}) => {
  await createCampaign(page, {
    campaignName: uniqueCampaignName("Missing Town"),
  });

  const campaignUrl = page.url();
  await page.goto(`${campaignUrl}/quests/new`);

  await expect(
    page.getByText(/至少先审核一条面向城镇的 canon fact|Review at least one town-facing canon fact/u),
  ).toBeVisible();
  await expect(page.locator("#town-name")).toHaveCount(0);
});
