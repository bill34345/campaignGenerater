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
  const createCampaignResponse = page.waitForResponse((response) =>
    /\/api\/campaigns$/.test(response.url()) &&
    response.request().method() === "POST" &&
    response.status() === 201,
  );

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

  const response = await createCampaignResponse;
  const payload = (await response.json()) as { campaign: { id: string } };

  await page.goto(`/campaigns/${payload.campaign.id}`);
  await expect(page.getByTestId("create-import-batch")).toBeVisible();

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
  const campaignId = getCampaignIdFromUrl(page);
  await page.goto(`/campaigns/${campaignId}/settings/llm`);
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

  const settingsSection = page.locator("section").filter({
    has: page.locator("#llm-provider"),
  });

  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("/llm-settings") &&
      response.request().method() === "PATCH" &&
      response.status() === 200,
    ),
    settingsSection.locator("button").first().click(),
  ]);

  if (input.testConnection) {
    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes("/llm-settings/test") &&
        response.request().method() === "POST" &&
        response.status() === 200,
      ),
      settingsSection.locator("button").nth(1).click(),
    ]);
  }
}

export async function goBackToOverview(page: Page) {
  const campaignId = getCampaignIdFromUrl(page);
  await page.goto(`/campaigns/${campaignId}`);
  await expect(page.locator('input[type="file"]').first()).toBeVisible();
}

export async function uploadDocument(page: Page, filePath: string | string[]) {
  const fileInput = page.locator('input[type="file"]').first();
  const targetFiles = Array.isArray(filePath) ? filePath : [filePath];

  await fileInput.setInputFiles(targetFiles);
  await Promise.all([
    page.waitForURL(/\/campaigns\/[^/]+\/imports\/[^/?#]+$/),
    page.getByTestId("create-import-batch").click(),
  ]);
}

export async function expectCanonUploadSuccess(page: Page) {
  await expect(page.getByTestId("start-extraction")).toBeVisible();
}

export async function openCanonReview(page: Page) {
  const startExtractionButton = page.getByTestId("start-extraction");

  if ((await startExtractionButton.count()) > 0) {
    await Promise.all([
      page.waitForURL(/\/campaigns\/[^/]+\/imports\/[^/]+\/results$/),
      startExtractionButton.click(),
    ]);
  }

  const canonInboxLink = page.getByTestId("open-canon-inbox");

  if ((await canonInboxLink.count()) > 0) {
    await Promise.all([
      page.waitForURL(/\/campaigns\/[^/]+\/canon$/),
      canonInboxLink.click(),
    ]);
    return;
  }

  const campaignId = getCampaignIdFromUrl(page);
  await page.goto(`/campaigns/${campaignId}/canon`);
}

export async function activateCanonFact(
  page: Page,
  options: { rowText?: string } = {},
) {
  const scope = options.rowText
    ? page.locator("article", { hasText: options.rowText }).first()
    : page.locator("article").first();

  await scope.getByRole("checkbox").first().check();

  const quickSaveButton = scope.getByTestId("quick-save-canon");
  if ((await quickSaveButton.count()) > 0) {
    await quickSaveButton.click();
  } else {
    await scope.getByTestId("compose-canon").click();
    await expect(page.locator("#canonical-value")).toBeVisible();
    await page.getByTestId("save-canonical-entry").click();
  }

  await expect(
    page.locator(
      '[data-testid="current-canonical-entry"], [data-testid="current-canonical-entry-empty"]',
    ).first(),
  ).toBeVisible();
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
  await Promise.all([
    page.waitForResponse((response) =>
      /\/quests\/[^/?#]+$/.test(response.url()) &&
      response.request().method() === "PATCH" &&
      response.status() === 200,
    ),
    page
      .locator("section")
      .filter({ has: page.locator("#quest-title") })
      .locator('button[type="button"]')
      .first()
      .click(),
  ]);
  await expect(page.getByTestId("quest-save-success")).toBeVisible();
}

export async function expectGenerationSourceVisible(page: Page) {
  await expect(page.getByTestId("quest-generation-source")).toBeVisible();
}

export async function expectProviderBadge(page: Page, label: string | RegExp) {
  await expect(page.getByText(label).first()).toBeVisible();
}

export async function expectFallbackVisible(page: Page) {
  await expect(page.getByTestId("quest-fallback-note")).toBeVisible();
}

export async function expectGmPreviewVisible(page: Page) {
  await expect(page.getByTestId("gm-packet-preview")).toBeVisible();
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

  if ((input.uploads?.length ?? 0) > 0) {
    await uploadDocument(page, input.uploads ?? []);
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
