import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  townProfileFindFirst: vi.fn(),
  questRequestCreate: vi.fn(),
  canonFactFindMany: vi.fn(),
  campaignDeltaFindMany: vi.fn(),
  questDraftCreate: vi.fn(),
  responsesParse: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    campaign: {
      findUnique: mocks.campaignFindUnique,
    },
    townProfile: {
      findFirst: mocks.townProfileFindFirst,
    },
    questRequest: {
      create: mocks.questRequestCreate,
    },
    canonFact: {
      findMany: mocks.canonFactFindMany,
    },
    campaignDelta: {
      findMany: mocks.campaignDeltaFindMany,
    },
    questDraft: {
      create: mocks.questDraftCreate,
    },
  },
}));

vi.mock("@/lib/openai/client", () => ({
  createOpenAIResponsesClient: vi.fn(() => ({
    responses: {
      parse: mocks.responsesParse,
    },
  })),
}));

vi.mock("@/lib/env", () => ({
  env: {
    nodeEnv: "test",
    openAiApiKey: "test-openai-key",
  },
}));

import { POST } from "@/app/api/campaigns/[campaignId]/quests/route";

function createRequestBody() {
  return {
    townProfileId: "town_1",
    townName: "Blackwater",
    townVibe: "Foggy and suspicious",
    localTension: "Smugglers are using the crypts",
    questType: "investigation",
    mainPlotRelation: "foreshadow",
    desiredLength: "standard",
    extraContext: "Tie the payoff back to the cult.",
  };
}

function createGeneratedDraft() {
  return {
    locale: "zh" as const,
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
        motivation: "Protect Blackwater",
        secret: "She hid an earlier omen from the council",
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
        value: "A ledger tying the smugglers to the cult patron.",
      },
    ],
    returnToMainPlot: "The ledger identifies the cult patron behind the broader campaign threat.",
    gmSummary: "An investigation-heavy Blackwater quest that exposes a smuggling cell tied to the main cult.",
  };
}

describe("quest generation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.campaignFindUnique.mockResolvedValue({
      id: "camp_1",
      tone: "Bleak maritime intrigue",
      partyLevel: 4,
      llmProvider: "openai_responses",
      llmApiKey: "campaign-openai-key",
      llmModel: null,
      llmBaseUrl: null,
    });
    mocks.townProfileFindFirst.mockResolvedValue({
      id: "town_1",
      name: "Blackwater",
      vibe: "Foggy and suspicious",
      tension: "Smugglers are using the crypts",
      notes: "The chapel bell has been wrong all week.",
      questHooks: ["The bell sounds before dawn", "Fishers saw lights below the chapel"],
    });
    mocks.questRequestCreate.mockResolvedValue({
      id: "req_1",
      campaignId: "camp_1",
      ...createRequestBody(),
    });
    mocks.canonFactFindMany.mockResolvedValue([
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
    ]);
    mocks.campaignDeltaFindMany.mockResolvedValue([
      {
        id: "delta_1",
        campaignId: "camp_1",
        deltaType: "session-change",
        summary: "Blackwater sealed the crypt stairs after strange tides.",
        createdAt: new Date("2026-04-10T12:00:00.000Z"),
        sourceFactId: null,
        sourceFact: null,
      },
    ]);
  });

  it("uses structured generation and persists a valid draft", async () => {
    const generatedDraft = createGeneratedDraft();
    mocks.responsesParse.mockResolvedValue({
      output_parsed: generatedDraft,
    });
    mocks.questDraftCreate.mockResolvedValue({
      id: "draft_1",
      campaignId: "camp_1",
      questRequestId: "req_1",
      generationMode: "provider",
      generationProvider: "openai_responses",
      generationModel: "gpt-5.4-mini",
      fallbackReason: null,
      generationErrorCode: null,
      ...generatedDraft,
    });

    const response = await POST(
      new Request("http://localhost/api/campaigns/camp_1/quests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(createRequestBody()),
      }),
      {
        params: Promise.resolve({ campaignId: "camp_1" }),
      },
    );

    expect(response.status).toBe(201);
    expect(mocks.responsesParse).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.objectContaining({
          format: expect.objectContaining({
            type: "json_schema",
            name: "quest_draft",
            strict: true,
            schema: expect.objectContaining({
              type: "object",
              properties: expect.objectContaining({
                title: expect.any(Object),
                scenes: expect.any(Object),
                returnToMainPlot: expect.any(Object),
              }),
            }),
          }),
        }),
      }),
    );
    expect(mocks.questDraftCreate).toHaveBeenCalledTimes(1);
    expect(mocks.questDraftCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "camp_1",
        questRequestId: "req_1",
        title: generatedDraft.title,
        generationMode: "provider",
        generationProvider: "openai_responses",
        generationModel: expect.any(String),
        fallbackReason: null,
        generationErrorCode: null,
      }),
    });

    await expect(response.json()).resolves.toMatchObject({
      validation: {
        valid: true,
        errors: [],
      },
      draft: expect.objectContaining({
        id: "draft_1",
        title: generatedDraft.title,
        generationMode: "provider",
        generationProvider: "openai_responses",
        generationModel: expect.any(String),
      }),
    });
  });

  it("persists fallback provenance when the API key is missing", async () => {
    mocks.campaignFindUnique.mockResolvedValueOnce({
      id: "camp_1",
      tone: "Bleak maritime intrigue",
      partyLevel: 4,
      llmProvider: "openai_chat",
      llmApiKey: null,
      llmModel: null,
      llmBaseUrl: null,
    });

    mocks.questDraftCreate.mockResolvedValue({
      id: "draft_1",
      campaignId: "camp_1",
      questRequestId: "req_1",
      generationMode: "fallback",
      generationProvider: "openai_chat",
      generationModel: null,
      fallbackReason: "missing_api_key",
      generationErrorCode: null,
      ...createGeneratedDraft(),
    });

    const response = await POST(
      new Request("http://localhost/api/campaigns/camp_1/quests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(createRequestBody()),
      }),
      {
        params: Promise.resolve({ campaignId: "camp_1" }),
      },
    );

    expect(response.status).toBe(201);
    expect(mocks.responsesParse).not.toHaveBeenCalled();
    expect(mocks.questDraftCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        generationMode: "fallback",
        generationProvider: "openai_chat",
        generationModel: null,
        fallbackReason: "missing_api_key",
        generationErrorCode: null,
      }),
    });
  });

  it("persists fallback provenance when OpenAI authentication fails", async () => {
    mocks.responsesParse.mockRejectedValue({
      code: "invalid_api_key",
      status: 401,
      message: "invalid API key",
    });
    mocks.questDraftCreate.mockResolvedValue({
      id: "draft_1",
      campaignId: "camp_1",
      questRequestId: "req_1",
      generationMode: "fallback",
      generationProvider: "openai_responses",
      generationModel: null,
      fallbackReason: "invalid_api_key",
      generationErrorCode: "invalid_api_key",
      ...createGeneratedDraft(),
    });

    const response = await POST(
      new Request("http://localhost/api/campaigns/camp_1/quests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(createRequestBody()),
      }),
      {
        params: Promise.resolve({ campaignId: "camp_1" }),
      },
    );

    expect(response.status).toBe(201);
    expect(mocks.responsesParse).toHaveBeenCalledTimes(1);
    expect(mocks.questDraftCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        generationMode: "fallback",
        generationProvider: "openai_responses",
        generationModel: null,
        fallbackReason: "invalid_api_key",
        generationErrorCode: "invalid_api_key",
      }),
    });

    await expect(response.json()).resolves.toMatchObject({
      draft: expect.objectContaining({
        generationMode: "fallback",
        generationProvider: "openai_responses",
        fallbackReason: "invalid_api_key",
        generationErrorCode: "invalid_api_key",
      }),
    });
  });

  it("does not persist the draft when validation fails", async () => {
    mocks.responsesParse.mockResolvedValue({
      output_parsed: {
        ...createGeneratedDraft(),
        scenes: createGeneratedDraft().scenes.map((scene) => ({
          ...scene,
          conflictType: "social",
        })),
      },
    });

    const response = await POST(
      new Request("http://localhost/api/campaigns/camp_1/quests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(createRequestBody()),
      }),
      {
        params: Promise.resolve({ campaignId: "camp_1" }),
      },
    );

    expect(response.status).toBe(422);
    expect(mocks.questDraftCreate).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      validation: {
        valid: false,
        errors: expect.arrayContaining([
          "Quest scenes must include the requested quest type: investigation.",
        ]),
      },
    });
  });

  it("rejects contradictory town identity when townProfileId and townName disagree", async () => {
    const response = await POST(
      new Request("http://localhost/api/campaigns/camp_1/quests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...createRequestBody(),
          townName: "Redharbor",
        }),
      }),
      {
        params: Promise.resolve({ campaignId: "camp_1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(mocks.questRequestCreate).not.toHaveBeenCalled();
    expect(mocks.responsesParse).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: 'townName must match the selected town profile name "Blackwater".',
    });
  });
});
