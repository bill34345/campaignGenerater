import { describe, expect, it } from "vitest";
import { buildPrompt } from "@/lib/quests/generate-quest";
import type { TownQuestContext } from "@/lib/canon/context-builder";
import type { QuestRequest } from "@/types/domain";

const workingContext: TownQuestContext = {
  campaignId: "camp_1",
  campaignTone: "grim mystery",
  partyLevel: 3,
  town: {
    id: "town_1",
    campaignId: "camp_1",
    name: "Fog Harbor",
    vibe: "Wet docks and tolling bells.",
    tension: "Dockworkers disappear after dusk.",
    notes: null,
    questHooks: [],
  },
  townFacts: [],
  relevantNpcs: [],
  relevantFactions: [],
  recentDeltas: [],
  openHooks: [],
};

const request: QuestRequest = {
  id: "req_1",
  campaignId: "camp_1",
  townProfileId: null,
  requestMode: "quick_start",
  generationStatus: "queued",
  generationStage: "queued",
  townName: "Fog Harbor",
  locale: "en",
  townVibe: "Wet docks and tolling bells.",
  localTension: "Dockworkers disappear after dusk.",
  questType: "mixed",
  mainPlotRelation: null,
  desiredLength: "3h",
  extraContext: "Adventure premise: find the missing dockworkers.",
};

describe("buildPrompt quick start", () => {
  it("builds a quick_start prompt that asks for a self-contained short module", () => {
    const prompt = buildPrompt(workingContext, request);

    expect(prompt).toContain("self-contained short module");
    expect(prompt).toContain("3 to 5 scenes");
    expect(prompt).toContain("same-night playability");
  });
});
