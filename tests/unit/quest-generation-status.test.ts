import { describe, expect, it } from "vitest";
import {
  createQuestGenerationEvent,
  publishQuestGenerationEvent,
  subscribeToQuestGenerationEvents,
} from "@/lib/quests/generation-status";
import {
  questGenerationEventSchema,
  questRequestSchema,
} from "@/types/domain";

function createBaseQuestRequest() {
  return {
    id: "req_1",
    campaignId: "camp_1",
    townProfileId: null,
    requestMode: "standard" as const,
    townName: "Blackwater",
    locale: "en" as const,
    townVibe: "Foggy and suspicious",
    localTension: "Smugglers are using the crypts",
    questType: "investigation",
    mainPlotRelation: "foreshadow",
    desiredLength: "standard",
    extraContext: "Tie the payoff back to the cult.",
  };
}

describe("quest generation lifecycle", () => {
  it("parses queued and running quest request lifecycle states", () => {
    const queued = questRequestSchema.parse({
      ...createBaseQuestRequest(),
      generationStatus: "queued",
      generationStage: "queued",
      generationProgressMessage: "Queued for generation.",
    });
    const running = questRequestSchema.parse({
      ...createBaseQuestRequest(),
      generationStatus: "running",
      generationStage: "calling_provider",
      generationProgressMessage: "Calling provider...",
      generationStartedAt: "2026-04-22T10:00:00.000Z",
      generationPreviewText: "Blackwater's chapel bell tolls twice.",
    });

    expect(queued.generationStatus).toBe("queued");
    expect(running.generationStage).toBe("calling_provider");
    expect(running.generationStartedAt).toBeInstanceOf(Date);
  });

  it("preserves terminal timestamps and errors for completed and failed requests", () => {
    const completed = questRequestSchema.parse({
      ...createBaseQuestRequest(),
      generationStatus: "completed",
      generationStage: "completed",
      generationStartedAt: "2026-04-22T10:00:00.000Z",
      generationCompletedAt: "2026-04-22T10:01:15.000Z",
    });
    const failed = questRequestSchema.parse({
      ...createBaseQuestRequest(),
      generationStatus: "failed",
      generationStage: "failed",
      generationStartedAt: "2026-04-22T10:00:00.000Z",
      generationFailedAt: "2026-04-22T10:01:15.000Z",
      generationLastErrorCode: "provider_timeout",
      generationLastErrorMessage: "Provider timed out before returning a draft.",
    });

    expect(completed.generationCompletedAt).toBeInstanceOf(Date);
    expect(failed.generationFailedAt).toBeInstanceOf(Date);
    expect(failed.generationLastErrorCode).toBe("provider_timeout");
  });

  it("creates and validates generation events", () => {
    const event = createQuestGenerationEvent({
      type: "completed",
      questRequestId: "req_1",
      generationStatus: "completed",
      generationStage: "completed",
      message: "Quest draft ready.",
      previewText: "Blackwater's chapel bell tolls twice.",
      draftId: "draft_1",
    });

    expect(questGenerationEventSchema.parse(event)).toMatchObject({
      type: "completed",
      draftId: "draft_1",
      generationStage: "completed",
    });
  });

  it("publishes events to subscribers", () => {
    const events: Array<ReturnType<typeof createQuestGenerationEvent>> = [];
    const unsubscribe = subscribeToQuestGenerationEvents("req_1", (event) => {
      events.push(event);
    });

    publishQuestGenerationEvent({
      type: "status",
      questRequestId: "req_1",
      generationStatus: "running",
      generationStage: "building_context",
      message: "Building quest context...",
    });
    unsubscribe();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      generationStage: "building_context",
      generationStatus: "running",
    });
  });
});
