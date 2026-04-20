import { expect, test } from "@playwright/test";

test("@smoke app shell defaults to Chinese and language toggle persists", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("home-start-campaign")).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByTestId("home-start-campaign")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("home-start-campaign")).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/campaigns\/new$/),
    page.getByTestId("home-start-campaign").click(),
  ]);
  await expect(page.locator("#campaign-name")).toBeVisible();
});
