import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/campaigns/route";

const TEST_NAME_PREFIX = "[test-campaign-api]";
const createdCampaignIds = new Set<string>();

async function deleteTestCampaigns() {
  const campaignIds = Array.from(createdCampaignIds);

  if (campaignIds.length === 0) {
    return;
  }

  await db.questDraft.deleteMany({
    where: {
      campaignId: {
        in: campaignIds,
      },
    },
  });
  await db.questRequest.deleteMany({
    where: {
      campaignId: {
        in: campaignIds,
      },
    },
  });
  await db.townProfile.deleteMany({
    where: {
      campaignId: {
        in: campaignIds,
      },
    },
  });
  await db.campaignDelta.deleteMany({
    where: {
      campaignId: {
        in: campaignIds,
      },
    },
  });
  await db.canonFact.deleteMany({
    where: {
      campaignId: {
        in: campaignIds,
      },
    },
  });
  await db.documentChunk.deleteMany({
    where: {
      campaignId: {
        in: campaignIds,
      },
    },
  });
  await db.sourceDocument.deleteMany({
    where: {
      campaignId: {
        in: campaignIds,
      },
    },
  });
  await db.campaign.deleteMany({
    where: {
      id: {
        in: campaignIds,
      },
    },
  });

  createdCampaignIds.clear();
}

describe("campaign API", () => {
  beforeEach(async () => {
    await deleteTestCampaigns();
  });

  afterEach(async () => {
    await deleteTestCampaigns();
  });

  it("creates a campaign and returns it from the list endpoint", async () => {
    const name = `${TEST_NAME_PREFIX} duskwatch`;
    const request = new Request("http://localhost/api/campaigns", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name,
        system: "5e",
        tone: "grim intrigue",
        partyLevel: 4,
        contentConstraints: "No graphic torture",
      }),
    });

    const createResponse = await POST(request);

    expect(createResponse.status).toBe(201);

    const createdPayload = (await createResponse.json()) as {
      campaign: {
        id: string;
        name: string;
        system: string;
        tone: string;
        partyLevel: number;
        contentConstraints: string | null;
        llmProvider: string;
        llmApiKey: string | null;
        llmModel: string | null;
        llmBaseUrl: string | null;
      };
    };

    createdCampaignIds.add(createdPayload.campaign.id);

    expect(createdPayload.campaign).toMatchObject({
      name,
      system: "5e",
      tone: "grim intrigue",
      partyLevel: 4,
      contentConstraints: "No graphic torture",
      llmProvider: "openai_responses",
      llmApiKey: null,
      llmModel: null,
      llmBaseUrl: null,
    });

    const listResponse = await GET();

    expect(listResponse.status).toBe(200);

    const listPayload = (await listResponse.json()) as {
      campaigns: Array<{
        id: string;
        name: string;
        system: string;
        tone: string;
        partyLevel: number;
        contentConstraints: string | null;
        llmProvider: string;
        llmApiKey: string | null;
        llmModel: string | null;
        llmBaseUrl: string | null;
      }>;
    };

    expect(listPayload.campaigns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdPayload.campaign.id,
          name,
          system: "5e",
          tone: "grim intrigue",
          partyLevel: 4,
          contentConstraints: "No graphic torture",
          llmProvider: "openai_responses",
          llmApiKey: null,
          llmModel: null,
          llmBaseUrl: null,
        }),
      ]),
    );
  });
});
