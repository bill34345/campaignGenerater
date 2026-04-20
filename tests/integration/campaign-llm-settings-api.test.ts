import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { PATCH, GET } from "@/app/api/campaigns/[campaignId]/llm-settings/route";

const TEST_NAME_PREFIX = "[test-campaign-llm-settings]";
const createdCampaignIds = new Set<string>();

async function deleteTestCampaigns() {
  const campaignIds = Array.from(createdCampaignIds);
  if (campaignIds.length === 0) {
    return;
  }

  await db.questDraft.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await db.questRequest.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await db.townProfile.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await db.campaignDelta.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await db.canonFact.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await db.documentChunk.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await db.sourceDocument.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await db.campaign.deleteMany({ where: { id: { in: campaignIds } } });
  createdCampaignIds.clear();
}

async function createCampaign() {
  const campaign = await db.campaign.create({
    data: {
      name: `${TEST_NAME_PREFIX}-${Date.now()}`,
      system: "5e",
      tone: "grim intrigue",
      partyLevel: 4,
    },
  });
  createdCampaignIds.add(campaign.id);
  return campaign;
}

describe("campaign llm settings API", () => {
  beforeEach(async () => {
    await deleteTestCampaigns();
  });

  afterEach(async () => {
    await deleteTestCampaigns();
  });

  it("returns default llm settings for a campaign", async () => {
    const campaign = await createCampaign();

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ campaignId: campaign.id }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      settings: {
        llmProvider: "openai_responses",
        llmApiKey: null,
        llmModel: null,
        llmBaseUrl: null,
      },
    });
  });

  it("persists provider configuration updates", async () => {
    const campaign = await createCampaign();

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          llmProvider: "anthropic",
          llmApiKey: "anthropic-test-key",
          llmModel: "claude-3-5-sonnet-latest",
          llmBaseUrl: "https://anthropic.example.com",
        }),
      }),
      {
        params: Promise.resolve({ campaignId: campaign.id }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      settings: {
        llmProvider: "anthropic",
        llmApiKey: "anthropic-test-key",
        llmModel: "claude-3-5-sonnet-latest",
        llmBaseUrl: "https://anthropic.example.com",
      },
    });

    await expect(
      db.campaign.findUnique({
        where: { id: campaign.id },
        select: {
          llmProvider: true,
          llmApiKey: true,
          llmModel: true,
          llmBaseUrl: true,
        },
      }),
    ).resolves.toMatchObject({
      llmProvider: "anthropic",
      llmApiKey: "anthropic-test-key",
      llmModel: "claude-3-5-sonnet-latest",
      llmBaseUrl: "https://anthropic.example.com",
    });
  });
});
