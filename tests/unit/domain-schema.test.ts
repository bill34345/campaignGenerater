import { describe, expect, it } from "vitest";
import {
  canonFactSchema,
  questDraftSchema,
  questRequestSchema,
  townProfileSchema,
} from "@/types/domain";

describe("domain schemas", () => {
  it("applies canon fact defaults and parses required fields", () => {
    const parsed = canonFactSchema.safeParse({
      campaignId: "camp_1",
      subject: "Mara",
      factType: "npc",
      value: "Innkeeper",
      sourceDocumentId: null,
      documentChunkId: null,
      confidence: null,
      evidence: null,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw parsed.error;
    }

    expect(parsed.data.status).toBe("active");
    expect(parsed.data.priority).toBe(0);
  });

  it("parses town profiles with structured quest hooks", () => {
    const parsed = townProfileSchema.safeParse({
      campaignId: "camp_1",
      name: "Vallaki",
      vibe: "oppressive",
      tension: null,
      notes: null,
      questHooks: ["missing bells", "watchful guards"],
    });

    expect(parsed.success).toBe(true);
  });

  it("parses quest requests with required campaign context", () => {
    const parsed = questRequestSchema.safeParse({
      campaignId: "camp_1",
      requestMode: "standard",
      townName: "Vallaki",
      townProfileId: null,
      townVibe: null,
      localTension: "missing bells",
      questType: "investigation",
      mainPlotRelation: null,
      desiredLength: "short",
      extraContext: null,
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts quest requests in quick_start mode", () => {
    const parsed = questRequestSchema.safeParse({
      campaignId: "cmp_1",
      townProfileId: null,
      generationStatus: "queued",
      generationStage: "queued",
      townName: "Fog Harbor",
      locale: "en",
      townVibe: "Wet docks, nervous bells, and shuttered inns.",
      localTension: "People vanish at dusk.",
      questType: "investigation",
      mainPlotRelation: null,
      desiredLength: "3h",
      extraContext: "Adventure premise: find the missing dockworkers.",
      requestMode: "quick_start",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts quest requests with persisted generation lifecycle fields", () => {
    const parsed = questRequestSchema.safeParse({
      campaignId: "camp_1",
      townProfileId: null,
      requestMode: "standard",
      generationStatus: "running",
      generationStage: "streaming",
      generationProgressMessage: "Drafting scenes...",
      generationPreviewText: "The chapel bell tolls over Blackwater.",
      generationStartedAt: "2026-04-22T10:00:00.000Z",
      townName: "Blackwater",
      locale: "en",
      townVibe: "Foggy and suspicious",
      localTension: "Smugglers are using the crypts",
      questType: "investigation",
      mainPlotRelation: "foreshadow",
      desiredLength: "standard",
      extraContext: "Tie the payoff back to the cult.",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts a valid quest draft", () => {
    const parsed = questDraftSchema.safeParse({
      campaignId: "camp_1",
      title: "Test Quest",
      premise: "A bell tolls at midnight.",
      hook: "The innkeeper begs for help.",
      scenes: [
        {
          name: "Hook",
          goal: "Accept the job",
          summary: "Meet the innkeeper",
          location: "Inn",
          conflictType: "social",
          outcomeOptions: ["Accept"],
        },
        {
          name: "Clue",
          goal: "Find the bell tower",
          summary: "Ask around",
          location: "Town square",
          conflictType: "investigation",
          outcomeOptions: ["Learn rumor"],
        },
        {
          name: "Climax",
          goal: "Stop the cult",
          summary: "Fight in the crypt",
          location: "Crypt",
          conflictType: "combat",
          outcomeOptions: ["Win fight"],
        },
      ],
      npcs: [
        {
          name: "Mara",
          role: "Innkeeper",
          motivation: "Save her brother",
          secret: "She hid the first clue",
        },
      ],
      encounters: [
        {
          name: "Crypt battle",
          difficultyTarget: "medium",
          purpose: "Climax",
          notes: "3 cultists",
        },
      ],
      rewards: [
        {
          type: "information",
          value: "Points back to the main plot",
        },
      ],
      returnToMainPlot: "A recovered letter names the mayor's patron.",
      gmSummary: "Investigation into missing bells.",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects quest drafts with too few scenes", () => {
    const parsed = questDraftSchema.safeParse({
      campaignId: "camp_1",
      title: "Broken Quest",
      premise: "Something is wrong",
      hook: "Help now",
      scenes: [
        {
          name: "Only scene",
          goal: "Start",
          summary: "A quick intro",
          location: "Inn",
          conflictType: "social",
          outcomeOptions: ["Proceed"],
        },
        {
          name: "Unused second scene",
          goal: "Stay valid",
          summary: "Enough structure for the rest of the schema",
          location: "Road",
          conflictType: "investigation",
          outcomeOptions: ["Continue"],
        },
      ],
      npcs: [
        {
          name: "Mara",
          role: "Innkeeper",
          motivation: "Get help",
          secret: "She knows the route",
        },
      ],
      encounters: [
        {
          name: "Ambush",
          difficultyTarget: "medium",
          purpose: "Pressure",
          notes: "Two bandits",
        },
      ],
      rewards: [
        {
          type: "information",
          value: "A clue to the crypt",
        },
      ],
      returnToMainPlot: "The plot continues elsewhere.",
      gmSummary: "Missing structure.",
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected quest draft to be rejected");
    }

    expect(
      parsed.error.issues.some(
        (issue) => issue.path[0] === "scenes" && issue.code === "too_small",
      ),
    ).toBe(true);
  });
});
