import { describe, expect, it } from "vitest";
import { buildFallbackQuestDraft } from "@/lib/quests/fallback-draft";
import type { TownQuestContext } from "@/lib/canon/context-builder";
import type { QuestRequest } from "@/types/domain";

function createWorkingContext(): TownQuestContext {
  return {
    campaignId: "camp_1",
    campaignTone: "Bleak maritime intrigue",
    partyLevel: 4,
    town: {
      id: "town_1",
      campaignId: "camp_1",
      name: "Blackwater",
      vibe: "Foggy and suspicious",
      tension: "Smugglers are using the crypts",
      notes: "The chapel bell has been wrong all week.",
      questHooks: ["The bell sounds before dawn", "Fishers saw lights below the chapel"],
    },
    townFacts: [],
    relevantNpcs: [
      {
        id: "fact_1",
        campaignId: "camp_1",
        sourceDocumentId: null,
        documentChunkId: null,
        subject: "Sister Hale",
        factType: "npc-role",
        value: "Sexton in Blackwater",
        status: "active",
        priority: 4,
        confidence: 0.8,
        evidence: "Sister Hale tends the Blackwater chapel.",
      },
    ],
    relevantFactions: [
      {
        id: "fact_2",
        campaignId: "camp_1",
        sourceDocumentId: null,
        documentChunkId: null,
        subject: "Tidebound Circle",
        factType: "faction-link",
        value: "A cult patron financing smuggling beneath Blackwater",
        status: "active",
        priority: 3,
        confidence: 0.7,
        evidence: null,
      },
    ],
    recentDeltas: [
      {
        id: "delta_1",
        campaignId: "camp_1",
        deltaType: "session-change",
        summary: "Blackwater sealed the crypt stairs after strange tides.",
        createdAt: new Date("2026-04-10T12:00:00.000Z"),
        sourceFactId: null,
        sourceFact: null,
      },
    ],
    openHooks: ["The bell sounds before dawn", "Fishers saw lights below the chapel"],
  };
}

function createQuestRequest(overrides: Partial<QuestRequest> = {}): QuestRequest {
  return {
    id: "req_1",
    campaignId: "camp_1",
    townProfileId: "town_1",
    townName: "Blackwater",
    locale: "zh",
    townVibe: "Foggy and suspicious",
    localTension: "Smugglers are using the crypts",
    questType: "investigation",
    mainPlotRelation: "foreshadow",
    desiredLength: "standard",
    extraContext: "Tie the payoff back to the cult.",
    ...overrides,
  };
}

describe("buildFallbackQuestDraft", () => {
  it("changes structure for combat and exploration requests", () => {
    const workingContext = createWorkingContext();
    const combatDraft = buildFallbackQuestDraft({
      workingContext,
      questRequest: createQuestRequest({ questType: "combat" }),
    });
    const explorationDraft = buildFallbackQuestDraft({
      workingContext,
      questRequest: createQuestRequest({ questType: "exploration" }),
    });

    expect(combatDraft.scenes.map((scene) => scene.goal)).not.toEqual(
      explorationDraft.scenes.map((scene) => scene.goal),
    );
    expect(combatDraft.encounters[0]?.purpose).not.toEqual(
      explorationDraft.encounters[0]?.purpose,
    );
    expect(combatDraft.scenes.filter((scene) => scene.conflictType === "combat").length).toBeGreaterThan(
      explorationDraft.scenes.filter((scene) => scene.conflictType === "combat").length,
    );
  });

  it("changes scene count and encounter depth for short and long requests", () => {
    const workingContext = createWorkingContext();
    const shortDraft = buildFallbackQuestDraft({
      workingContext,
      questRequest: createQuestRequest({ desiredLength: "short" }),
    });
    const longDraft = buildFallbackQuestDraft({
      workingContext,
      questRequest: createQuestRequest({ desiredLength: "long" }),
    });

    expect(shortDraft.scenes).toHaveLength(3);
    expect(longDraft.scenes.length).toBeGreaterThan(shortDraft.scenes.length);
    expect(longDraft.encounters.length).toBeGreaterThanOrEqual(shortDraft.encounters.length);
    expect(longDraft.returnToMainPlot).not.toEqual(shortDraft.returnToMainPlot);
  });

  it("changes the return path between standalone and follow-up quests", () => {
    const workingContext = createWorkingContext();
    const standaloneDraft = buildFallbackQuestDraft({
      workingContext,
      questRequest: createQuestRequest({ mainPlotRelation: "standalone" }),
    });
    const followUpDraft = buildFallbackQuestDraft({
      workingContext,
      questRequest: createQuestRequest({ mainPlotRelation: "follow-up" }),
    });

    expect(standaloneDraft.returnToMainPlot).not.toEqual(followUpDraft.returnToMainPlot);
    expect(standaloneDraft.gmSummary).not.toEqual(followUpDraft.gmSummary);
  });
});
