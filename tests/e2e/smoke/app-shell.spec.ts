import { expect, test } from "@playwright/test";

test("@smoke app shell defaults to Chinese and language toggle persists", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "开始创建 Campaign" })).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("link", { name: "Start a campaign" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: "Start a campaign" })).toBeVisible();

  await page.getByRole("link", { name: "Start a campaign" }).click();
  await expect(page).toHaveURL(/\/campaigns\/new$/);
  await expect(page.getByText(/Campaign setup/i)).toBeVisible();
});
