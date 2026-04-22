import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  townProfileFindFirst: vi.fn(),
  questRequestCreate: vi.fn(),
  loadQuestGenerationStatus: vi.fn(),
  scheduleQuestGenerationDispatch: vi.fn(),
  subscribeToQuestGenerationEvents: vi.fn(),
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
  },
}));

vi.mock("@/lib/quests/generation-dispatch", () => ({
  scheduleQuestGenerationDispatch: mocks.scheduleQuestGenerationDispatch,
}));

vi.mock("@/lib/quests/generation-status", () => ({
  loadQuestGenerationStatus: mocks.loadQuestGenerationStatus,
  subscribeToQuestGenerationEvents: mocks.subscribeToQuestGenerationEvents,
}));

import { GET as GET_EVENTS } from "@/app/api/campaigns/[campaignId]/quests/requests/[requestId]/events/route";
import { GET as GET_STATUS } from "@/app/api/campaigns/[campaignId]/quests/requests/[requestId]/status/route";
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
    locale: "en",
    requestMode: "standard",
  };
}

function createQueuedQuestRequest() {
  return {
    id: "req_1",
    campaignId: "camp_1",
    townProfileId: "town_1",
    requestMode: "standard",
    generationStatus: "queued",
    generationStage: "queued",
    generationProgressMessage: "Queued for generation.",
    generationPreviewText: null,
    generationStartedAt: null,
    generationCompletedAt: null,
    generationFailedAt: null,
    generationLastErrorCode: null,
    generationLastErrorMessage: null,
    townName: "Blackwater",
    locale: "en",
    townVibe: "Foggy and suspicious",
    localTension: "Smugglers are using the crypts",
    questType: "investigation",
    mainPlotRelation: "foreshadow",
    desiredLength: "standard",
    extraContext: "Tie the payoff back to the cult.",
  };
}

describe("quest generation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.campaignFindUnique.mockResolvedValue({
      id: "camp_1",
    });
    mocks.townProfileFindFirst.mockResolvedValue({
      id: "town_1",
      name: "Blackwater",
    });
    mocks.questRequestCreate.mockResolvedValue(createQueuedQuestRequest());
    mocks.subscribeToQuestGenerationEvents.mockImplementation(() => () => {});
  });

  it("accepts quest submission, stores queued lifecycle state, and schedules dispatch", async () => {
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

    expect(response.status).toBe(202);
    expect(mocks.questRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: "camp_1",
          generationStatus: "queued",
          generationStage: "queued",
          generationProgressMessage: "Queued for generation.",
        }),
      }),
    );
    expect(mocks.scheduleQuestGenerationDispatch).toHaveBeenCalledWith({
      campaignId: "camp_1",
      questRequestId: "req_1",
    });

    await expect(response.json()).resolves.toMatchObject({
      draft: null,
      questRequest: {
        id: "req_1",
        generationStatus: "queued",
        generationStage: "queued",
      },
    });
  });

  it("accepts quick_start submissions without a stored town profile", async () => {
    mocks.townProfileFindFirst.mockResolvedValueOnce(null);
    mocks.questRequestCreate.mockResolvedValueOnce({
      ...createQueuedQuestRequest(),
      townProfileId: null,
      requestMode: "quick_start",
      townName: "Fog Harbor",
    });

    const response = await POST(
      new Request("http://localhost/api/campaigns/camp_1/quests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...createRequestBody(),
          townProfileId: null,
          townName: "Fog Harbor",
          requestMode: "quick_start",
        }),
      }),
      {
        params: Promise.resolve({ campaignId: "camp_1" }),
      },
    );

    expect(response.status).toBe(202);
    expect(mocks.questRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          townProfileId: null,
          townName: "Fog Harbor",
          requestMode: "quick_start",
        }),
      }),
    );
  });

  it("rejects mismatched town names before queuing generation", async () => {
    const response = await POST(
      new Request("http://localhost/api/campaigns/camp_1/quests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...createRequestBody(),
          townName: "Wrong Town",
        }),
      }),
      {
        params: Promise.resolve({ campaignId: "camp_1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(mocks.questRequestCreate).not.toHaveBeenCalled();
    expect(mocks.scheduleQuestGenerationDispatch).not.toHaveBeenCalled();
  });

  it("returns the current lifecycle state from the status route", async () => {
    mocks.loadQuestGenerationStatus.mockResolvedValue({
      questRequest: {
        ...createQueuedQuestRequest(),
        generationStatus: "running",
        generationStage: "calling_provider",
        generationProgressMessage: "Calling Anthropic provider...",
        generationStartedAt: new Date("2026-04-22T10:00:00.000Z"),
      },
      draft: null,
    });

    const response = await GET_STATUS(new Request("http://localhost"), {
      params: Promise.resolve({ campaignId: "camp_1", requestId: "req_1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      questRequest: {
        id: "req_1",
        generationStatus: "running",
        generationStage: "calling_provider",
      },
      draft: null,
    });
  });

  it("renders terminal completed events from the SSE route", async () => {
    mocks.loadQuestGenerationStatus.mockResolvedValue({
      questRequest: {
        ...createQueuedQuestRequest(),
        generationStatus: "completed",
        generationStage: "completed",
        generationProgressMessage: "Quest draft ready.",
        generationPreviewText: "Blackwater's chapel bell tolls twice.",
        generationCompletedAt: new Date("2026-04-22T10:01:15.000Z"),
      },
      draft: {
        id: "draft_1",
        title: "The Bell Below Blackwater",
      },
    });

    const response = await GET_EVENTS(new Request("http://localhost"), {
      params: Promise.resolve({ campaignId: "camp_1", requestId: "req_1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.text();

    expect(body).toContain("event: status");
    expect(body).toContain("event: text_delta");
    expect(body).toContain("event: completed");
    expect(body).toContain('"draftId":"draft_1"');
  });
});
