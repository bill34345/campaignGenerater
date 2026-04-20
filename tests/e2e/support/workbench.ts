import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import { db } from "@/lib/db";
import type { LlmProvider } from "@/types/domain";

type CampaignInput = {
  campaignName?: string;
  partyLevel?: string;
  tone?: string;
  contentConstraints?: string;
};

type ProviderInput = {
  provider: LlmProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  testConnection?: boolean;
};

type QuestSeedInput = {
  campaign?: CampaignInput;
  provider?: ProviderInput;
  uploads?: string[];
  canonFactText?: string;
};

export function fixturePath(...parts: string[]) {
  return path.join(process.cwd(), "tests", "fixtures", ...parts);
}

export function uniqueCampaignName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

export function getCampaignIdFromUrl(page: Page) {
  const match = page.url().match(/\/campaigns\/([^/?#]+)/);

  if (!match) {
    throw new Error(`Unable to infer campaign id from URL: ${page.url()}`);
  }

  return match[1];
}

export async function createCampaign(page: Page, input: CampaignInput = {}) {
  const campaignName = input.campaignName ?? uniqueCampaignName("E2E Campaign");

  await page.goto("/campaigns/new");
  await page.locator("#campaign-name").fill(campaignName);
  await page.locator("#campaign-party-level").fill(input.partyLevel ?? "4");
  await page
    .locator("#campaign-tone")
    .fill(input.tone ?? "Foggy coastal mystery with uneasy politics");
  await page
    .locator("#campaign-constraints")
    .fill(input.contentConstraints ?? "Keep gore off-screen.");
  await page.locator("form").first().locator('button[type="submit"]').click();

  await expect(page.getByRole("heading", { name: campaignName })).toBeVisible();

  return { campaignName, campaignId: getCampaignIdFromUrl(page) };
}

export async function ensureTownProfile(
  page: Page,
  input: {
    name?: string;
    vibe?: string;
    tension?: string;
    notes?: string;
    questHooks?: string[];
  } = {},
) {
  const campaignId = getCampaignIdFromUrl(page);
  const townName = input.name ?? "Duskport";

  await db.townProfile.upsert({
    where: {
      campaignId_name: {
        campaignId,
        name: townName,
      },
    },
    update: {
      vibe: input.vibe ?? "Fogbound trade port with brittle alliances",
      tension: input.tension ?? "Dockside crews whisper about missing cargo",
      notes: input.notes ?? "Use this town as the default E2E quest anchor.",
      questHooks:
        input.questHooks ?? [
          "Someone is skimming tribute from the harbor watch.",
          "A missing courier may have crossed faction lines.",
        ],
    },
    create: {
      campaignId,
      name: townName,
      vibe: input.vibe ?? "Fogbound trade port with brittle alliances",
      tension: input.tension ?? "Dockside crews whisper about missing cargo",
      notes: input.notes ?? "Use this town as the default E2E quest anchor.",
      questHooks:
        input.questHooks ?? [
          "Someone is skimming tribute from the harbor watch.",
          "A missing courier may have crossed faction lines.",
        ],
    },
  });

  return { campaignId, townName };
}

export async function openLlmSettings(page: Page) {
  await page.getByRole("link", { name: /LLM 设置|LLM settings/i }).first().click();
  await expect(page.locator("#llm-provider")).toBeVisible();
}

export async function configureProvider(page: Page, input: ProviderInput) {
  await page.locator("#llm-provider").selectOption(input.provider);
  await page.locator("#llm-api-key").fill(input.apiKey ?? "");

  if (input.model !== undefined) {
    await page.locator("#llm-model").fill(input.model);
  }

  if (input.baseUrl !== undefined) {
    await page.locator("#llm-base-url").fill(input.baseUrl);
  }

  await page.getByRole("button", { name: /保存设置|Save settings/i }).click();
  await expect(
    page.getByText(/LLM settings saved|LLM 设置已保存/u).first(),
  ).toBeVisible();

  if (input.testConnection) {
    await page.getByRole("button", { name: /测试连接|Test connection/i }).click();
    await expect(
      page.getByText(/Connection succeeded|连接成功/u).first(),
    ).toBeVisible();
  }
}

export async function goBackToOverview(page: Page) {
  await page.getByRole("link", { name: /返回概览|Back to overview/i }).click();
  await expect(page.locator("#campaign-upload")).toBeVisible();
}

export async function uploadDocument(page: Page, filePath: string) {
  await page.locator("#campaign-upload").setInputFiles(filePath);
  await page
    .locator("form")
    .filter({ has: page.locator("#campaign-upload") })
    .locator('button[type="submit"]')
    .click();
}

export async function expectCanonUploadSuccess(page: Page) {
  await expect(page.getByText(/uploaded|已上传/u).first()).toBeVisible();
}

export async function openCanonReview(page: Page) {
  await page.getByRole("link", { name: /canon review/i }).click();
}

export async function activateCanonFact(
  page: Page,
  options: { rowText?: string } = {},
) {
  const rowScope = options.rowText ? page.locator("tr", { hasText: options.rowText }) : null;
  const rowButton = rowScope?.getByRole("button", { name: /active/i }).first();
  const fallbackButton = page.getByRole("button", { name: /active/i }).first();

  if (rowButton && (await rowButton.count()) > 0) {
    await rowButton.click();
  } else {
    await fallbackButton.click();
  }

  await expect(page.getByText(/active/i).first()).toBeVisible();
}

export async function openQuestRequest(page: Page) {
  const campaignBaseUrl = page.url().replace(/\/canon$/, "");
  await page.goto(`${campaignBaseUrl}/quests/new`);
}

export async function requestQuestAndOpenDraft(page: Page) {
  const requestForm = page.locator("form").filter({ has: page.locator("#town-name") });
  await requestForm.locator('button[type="submit"]').click();

  const draftLink = requestForm.locator(
    'a[href*="/quests/"]:not([href*="/quests/new"])',
  );
  await expect(draftLink).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/campaigns\/[^/]+\/quests\/(?!new(?:[/?#]|$))[^/?#]+$/),
    draftLink.click(),
  ]);

  await expect(page.locator("#quest-title")).toBeVisible();
}

export async function saveQuestDraft(page: Page) {
  await page
    .locator("section")
    .filter({ has: page.locator("#quest-title") })
    .locator('button[type="button"]')
    .first()
    .click();
  await expect(page.getByText(/Draft saved|草稿已保存/u).first()).toBeVisible();
}

export async function expectGenerationSourceVisible(page: Page) {
  await expect(
    page.getByText(/Generation source|生成来源/u).first(),
  ).toBeVisible();
}

export async function expectProviderBadge(page: Page, label: string | RegExp) {
  await expect(page.getByText(label).first()).toBeVisible();
}

export async function expectFallbackVisible(page: Page) {
  await expect(page.getByText(/Fallback draft|回退草稿/u).first()).toBeVisible();
}

export async function expectGmPreviewVisible(page: Page) {
  await expect(page.getByText(/GM packet preview|GM 预览区/u).first()).toBeVisible();
}

export async function createQuestDraftSeed(
  page: Page,
  input: QuestSeedInput = {},
) {
  const campaignName =
    input.campaign?.campaignName ?? uniqueCampaignName("Quest Flow");

  await createCampaign(page, {
    ...input.campaign,
    campaignName,
  });
  await ensureTownProfile(page);

  if (input.provider) {
    await openLlmSettings(page);
    await configureProvider(page, input.provider);
    await goBackToOverview(page);
  }

  for (const filePath of input.uploads ?? []) {
    await uploadDocument(page, filePath);
    await expectCanonUploadSuccess(page);
  }

  await openCanonReview(page);
  await expect(page.getByRole("heading", { name: campaignName })).toBeVisible();
  await activateCanonFact(page, { rowText: input.canonFactText });
  await openQuestRequest(page);
  await expect(page.getByRole("heading", { name: campaignName })).toBeVisible();
  await requestQuestAndOpenDraft(page);

  return { campaignName };
}

export function providerCardText(provider: LlmProvider) {
  if (provider === "anthropic") {
    return /Anthropic/i;
  }

  if (provider === "openai_chat") {
    return /OpenAI Chat/i;
  }

  return /OpenAI Responses/i;
}

export async function expectVisibleText(page: Page, text: string | RegExp | Locator) {
  if (typeof text === "string" || text instanceof RegExp) {
    await expect(page.getByText(text).first()).toBeVisible();
    return;
  }

  await expect(text).toBeVisible();
}
