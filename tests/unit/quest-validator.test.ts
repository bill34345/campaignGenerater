import { describe, expect, it } from "vitest";
import { validateQuestDraft } from "@/lib/quests/validate-quest";
import type { QuestDraft, QuestRequest } from "@/types/domain";

function createDraft(overrides: Partial<QuestDraft> = {}): QuestDraft {
  return {
    campaignId: "camp_1",
    locale: "zh",
    questRequestId: "req_1",
    generationMode: "unknown",
    generationModel: null,
    fallbackReason: null,
    generationErrorCode: null,
    title: "The Bell Below Blackwater",
    premise: "Blackwater's chapel crypt hums with stolen tide-magic.",
    hook: "A frantic sexton begs the party to investigate Blackwater before dusk.",
    scenes: [
      {
        name: "Market Rumors",
        goal: "Learn who disturbed the crypt",
        summary: "The party questions fishers and temple regulars in Blackwater.",
        location: "Blackwater market square",
        conflictType: "investigation",
        outcomeOptions: ["Identify the smuggler route", "Gain the sexton's trust"],
      },
      {
        name: "Harbor Intercept",
        goal: "Catch the relic runners",
        summary: "Suspicious dockhands try to flee with the stolen reliquary.",
        location: "Blackwater tide docks",
        conflictType: "combat",
        outcomeOptions: ["Capture a runner", "Recover the reliquary map"],
      },
      {
        name: "Crypt Reckoning",
        goal: "Seal the breach and recover the clue",
        summary: "The party descends into the flooded crypt beneath Blackwater chapel.",
        location: "Blackwater chapel crypt",
        conflictType: "investigation",
        outcomeOptions: ["Seal the breach", "Recover the cult ledger"],
      },
    ],
    npcs: [
      {
        name: "Sister Hale",
        role: "Sexton",
        motivation: "Protect the chapel and the town",
        secret: "She hid a prior omen from the council",
      },
    ],
    encounters: [
      {
        name: "Dockside chase",
        difficultyTarget: "medium",
        purpose: "Pressure the party before the crypt reveal",
        notes: "Use slippery piers and panicked civilians.",
      },
    ],
    rewards: [
      {
        type: "information",
        value: "A ledger tying the smugglers back to the main plot cult.",
      },
    ],
    returnToMainPlot: "The recovered ledger points to the cult patron financing the broader campaign threat.",
    gmSummary: "An investigation-heavy Blackwater quest that exposes a smuggling cell tied to the main cult.",
    ...overrides,
  };
}

function createRequest(overrides: Partial<QuestRequest> = {}): QuestRequest {
  return {
    id: "req_1",
    campaignId: "camp_1",
    requestMode: "standard",
    generationStatus: "queued",
    generationStage: "queued",
    locale: "zh",
    townProfileId: "town_1",
    townName: "Blackwater",
    townVibe: "Foggy and suspicious",
    localTension: "Smugglers are exploiting the flooded crypts",
    questType: "investigation",
    mainPlotRelation: "foreshadow",
    desiredLength: "standard",
    extraContext: "Keep the pressure local and tie it back to the cult.",
    ...overrides,
  };
}

describe("validateQuestDraft", () => {
  it("rejects drafts without a return-to-main-plot path", () => {
    const result = validateQuestDraft(createDraft({ returnToMainPlot: "" }));

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("returnToMainPlot is required.");
  });

  it("rejects drafts without at least one NPC", () => {
    const result = validateQuestDraft(createDraft({ npcs: [] }));

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("At least one NPC is required.");
  });

  it("rejects drafts that do not match the requested quest type", () => {
    const result = validateQuestDraft(
      createDraft({
        scenes: createDraft().scenes.map((scene) => ({
          ...scene,
          conflictType: "social",
        })),
      }),
      createRequest({ questType: "combat" }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Quest scenes must include the requested quest type: combat.",
    );
  });

  it("surfaces nested scene schema errors instead of silently accepting them", () => {
    const result = validateQuestDraft(
      createDraft({
        scenes: [
          {
            ...createDraft().scenes[0],
            outcomeOptions: [],
          },
          ...createDraft().scenes.slice(1),
        ],
      }),
      createRequest(),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "scenes.0.outcomeOptions: Too small: expected array to have >=1 items",
    );
  });

  it("accepts mixed scene conflict types for a mixed quest request", () => {
    const result = validateQuestDraft(
      createDraft({
        scenes: createDraft().scenes.map((scene) => ({
          ...scene,
          conflictType: "mixed",
        })),
      }),
      createRequest({ questType: "mixed" }),
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects drafts that never anchor the quest to the requested town", () => {
    const result = validateQuestDraft(
      createDraft({
        title: "The Bell Below the River Shrine",
        premise: "A stolen relic destabilizes the river shrine.",
        hook: "A priest asks the party for help before the next storm.",
        scenes: [
          {
            name: "Riverbank omen",
            goal: "Interpret the omen",
            summary: "The shrine keeper describes what was stolen.",
            location: "River shrine",
            conflictType: "investigation",
            outcomeOptions: ["Learn the symbol"],
          },
          {
            name: "Shrine descent",
            goal: "Recover the relic",
            summary: "The party explores the flooded tunnels beneath the shrine.",
            location: "Flooded tunnels",
            conflictType: "exploration",
            outcomeOptions: ["Find the relic"],
          },
          {
            name: "Storm ledger",
            goal: "Reveal the patron",
            summary: "Recovered notes tie the theft to the main plot.",
            location: "Collapsed archive",
            conflictType: "investigation",
            outcomeOptions: ["Identify the patron"],
          },
        ],
        gmSummary: "A shrine mystery with no stated town anchor.",
      }),
      createRequest({ townName: "Blackwater" }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Quest draft must stay anchored to the requested town: "Blackwater".',
    );
  });

  it("accepts a schema-valid draft that matches the town and requested type", () => {
    const result = validateQuestDraft(createDraft(), createRequest());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("requires at least two NPCs for quick start drafts", () => {
    const result = validateQuestDraft(
      createDraft(),
      createRequest({ requestMode: "quick_start" }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Quick Start drafts must include at least 2 NPCs.",
    );
  });
});
