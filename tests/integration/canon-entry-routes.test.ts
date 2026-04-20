import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as COMPOSE } from "@/app/api/campaigns/[campaignId]/canon/composer/route";
import { POST as SAVE } from "@/app/api/campaigns/[campaignId]/canon/entries/route";

const TEST_NAME_PREFIX = "[test-canon-entry-routes]";
const createdCampaignIds = new Set<string>();

async function createCampaign() {
  const campaign = await db.campaign.create({
    data: {
      name: `${TEST_NAME_PREFIX} ${Date.now()}`,
      system: "5e",
      tone: "grim intrigue",
      partyLevel: 4,
      llmApiKey: "campaign-test-key",
    },
  });

  createdCampaignIds.add(campaign.id);
  return campaign;
}

async function seedCandidateFacts(campaignId: string) {
  return Promise.all([
    db.canonFact.create({
      data: {
        campaignId,
        subject: "Father Lucian",
        factType: "npc_state",
        value: "Alive and hiding relic evidence in the church cellar.",
        status: "uncertain",
        priority: 5,
        confidence: 0.84,
        evidence: "Session notes after the feast.",
      },
    }),
    db.canonFact.create({
      data: {
        campaignId,
        subject: "Father Lucian",
        factType: "npc_state",
        value: "Alive, but publicly denying the relic exists.",
        status: "uncertain",
        priority: 4,
        confidence: 0.74,
        evidence: "Module chapter four marginalia.",
      },
    }),
  ]);
}

async function deleteTestCampaigns() {
  const campaignIds = Array.from(createdCampaignIds);

  if (campaignIds.length === 0) {
    return;
  }

  await db.canonicalEntrySourceFact.deleteMany({
    where: {
      campaignId: {
        in: campaignIds,
      },
    },
  });
  await db.canonicalEntry.deleteMany({
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
  await db.campaign.deleteMany({
    where: {
      id: {
        in: campaignIds,
      },
    },
  });

  createdCampaignIds.clear();
}

describe("canon entry routes", () => {
  beforeEach(async () => {
    await deleteTestCampaigns();
  });

  afterEach(async () => {
    await deleteTestCampaigns();
  });

  it("builds a canon composer draft from selected candidate facts", async () => {
    const campaign = await createCampaign();
    const [factA, factB] = await seedCandidateFacts(campaign.id);

    const response = await COMPOSE(
      new Request("http://localhost/api/campaigns/camp_1/canon/composer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subject: "Father Lucian",
          factType: "npc_state",
          selectedFactIds: [factA.id, factB.id],
        }),
      }),
      {
        params: Promise.resolve({ campaignId: campaign.id }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      draft: {
        campaignId: campaign.id,
        subject: "Father Lucian",
        factType: "npc_state",
        selectedFactIds: [factA.id, factB.id],
        evidence: [
          expect.objectContaining({ factId: factA.id }),
          expect.objectContaining({ factId: factB.id }),
        ],
      },
      composerMeta: {
        providerConfigured: true,
        generationMode: "deterministic",
      },
    });
  });

  it("saves a canonical entry and preserves the original candidate evidence rows", async () => {
    const campaign = await createCampaign();
    const [factA, factB] = await seedCandidateFacts(campaign.id);

    const response = await SAVE(
      new Request("http://localhost/api/campaigns/camp_1/canon/entries", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subject: "Father Lucian",
          factType: "npc_state",
          canonicalValue:
            "Father Lucian is alive and hiding relic evidence in the church cellar.",
          notes: "Merged from module and session notes.",
          sourceFactIds: [factA.id, factB.id],
        }),
      }),
      {
        params: Promise.resolve({ campaignId: campaign.id }),
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      entry: expect.objectContaining({
        campaignId: campaign.id,
        subject: "Father Lucian",
        factType: "npc_state",
        sourceFactIds: expect.arrayContaining([factA.id, factB.id]),
      }),
    });

    const savedEntry = await db.canonicalEntry.findUnique({
      where: {
        campaignId_subject_factType: {
          campaignId: campaign.id,
          subject: "Father Lucian",
          factType: "npc_state",
        },
      },
      include: {
        sourceFacts: true,
      },
    });

    expect(
      savedEntry?.sourceFacts.map((sourceFact) => sourceFact.canonFactId).sort(),
    ).toEqual([factA.id, factB.id].sort());

    const remainingFacts = await db.canonFact.findMany({
      where: { campaignId: campaign.id },
      orderBy: [{ priority: "desc" }],
    });
    expect(remainingFacts.map((fact) => fact.id).sort()).toEqual(
      [factA.id, factB.id].sort(),
    );
  });
});
