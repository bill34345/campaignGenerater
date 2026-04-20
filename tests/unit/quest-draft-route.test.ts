import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    questDraft: {
      findFirst: mocks.findFirst,
      update: mocks.update,
    },
  },
}));

import {
  GET,
  PATCH,
} from "@/app/api/campaigns/[campaignId]/quests/[questId]/route";

describe("quest draft route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findFirst.mockResolvedValue({
      id: "quest_1",
      campaignId: "camp_1",
      questRequestId: "request_1",
      title: "Ashes Beneath the Bell Tower",
      premise: "A bell tower hides the town's latest threat.",
      hook: "The innkeeper begs for help.",
      scenes: [
        {
          name: "Hook",
          goal: "Take the job",
          summary: "Meet the innkeeper in the square.",
          location: "Town square",
          conflictType: "social",
          outcomeOptions: ["Accept the job"],
        },
        {
          name: "Trail",
          goal: "Trace the threat",
          summary: "Follow clues through the old quarter.",
          location: "Old quarter",
          conflictType: "investigation",
          outcomeOptions: ["Find the cellar entrance"],
        },
        {
          name: "Climax",
          goal: "Stop the culprit",
          summary: "Confront the smugglers below the tower.",
          location: "Bell tower cellar",
          conflictType: "combat",
          outcomeOptions: ["Recover the proof"],
        },
      ],
      npcs: [
        {
          name: "Mara",
          role: "Innkeeper",
          motivation: "Protect the harbor district",
          secret: "She hid the first clue.",
        },
      ],
      encounters: [
        {
          name: "Cellar ambush",
          difficultyTarget: "medium",
          purpose: "Climax",
          notes: "Use smugglers and unstable crates.",
        },
      ],
      rewards: [
        {
          type: "information",
          value: "Evidence that points back to the mayor's patron.",
        },
      ],
      returnToMainPlot: "A recovered ledger points back to the main conspiracy.",
      gmSummary: "A three-scene town investigation with a clean return path.",
      createdAt: new Date("2026-04-11T00:00:00.000Z"),
      updatedAt: new Date("2026-04-11T00:00:00.000Z"),
    });

    mocks.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "quest_1",
      campaignId: "camp_1",
      questRequestId: "request_1",
      encounters: [
        {
          name: "Cellar ambush",
          difficultyTarget: "medium",
          purpose: "Climax",
          notes: "Use smugglers and unstable crates.",
        },
      ],
      createdAt: new Date("2026-04-11T00:00:00.000Z"),
      updatedAt: new Date("2026-04-11T00:00:00.000Z"),
      ...data,
    }));
  });

  it("accepts partial quest draft patches and preserves untouched fields", async () => {
    const request = new Request("http://localhost/api/campaigns/camp_1/quests/quest_1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Ashes Beneath Duskport",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({
        campaignId: "camp_1",
        questId: "quest_1",
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "quest_1" },
      data: expect.objectContaining({
        title: "Ashes Beneath Duskport",
        premise: "A bell tower hides the town's latest threat.",
        hook: "The innkeeper begs for help.",
        returnToMainPlot: "A recovered ledger points back to the main conspiracy.",
      }),
    });

    await expect(response.json()).resolves.toMatchObject({
      draft: expect.objectContaining({
        title: "Ashes Beneath Duskport",
        premise: "A bell tower hides the town's latest threat.",
      }),
    });
  });

  it("returns the normalized quest draft on GET", async () => {
    const response = await GET(
      new Request("http://localhost/api/campaigns/camp_1/quests/quest_1"),
      {
        params: Promise.resolve({
          campaignId: "camp_1",
          questId: "quest_1",
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      draft: expect.objectContaining({
        id: "quest_1",
        title: "Ashes Beneath the Bell Tower",
        gmSummary: "A three-scene town investigation with a clean return path.",
      }),
    });
  });

  it("returns a 400 for invalid patch payloads", async () => {
    const request = new Request("http://localhost/api/campaigns/camp_1/quests/quest_1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        scenes: [],
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({
        campaignId: "camp_1",
        questId: "quest_1",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid request body.",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns a 404 when the quest draft does not exist", async () => {
    mocks.findFirst.mockResolvedValueOnce(null);

    const getResponse = await GET(
      new Request("http://localhost/api/campaigns/camp_1/quests/missing"),
      {
        params: Promise.resolve({
          campaignId: "camp_1",
          questId: "missing",
        }),
      },
    );

    expect(getResponse.status).toBe(404);
    await expect(getResponse.json()).resolves.toMatchObject({
      error: "Quest draft not found.",
    });

    mocks.findFirst.mockResolvedValueOnce(null);

    const patchResponse = await PATCH(
      new Request("http://localhost/api/campaigns/camp_1/quests/missing", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Missing",
        }),
      }),
      {
        params: Promise.resolve({
          campaignId: "camp_1",
          questId: "missing",
        }),
      },
    );

    expect(patchResponse.status).toBe(404);
    await expect(patchResponse.json()).resolves.toMatchObject({
      error: "Quest draft not found",
    });
  });
});
