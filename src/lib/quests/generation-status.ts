import { EventEmitter } from "node:events";
import { db } from "@/lib/db";
import {
  questGenerationEventSchema,
  questRequestSchema,
  type QuestGenerationEvent,
  type QuestGenerationStage,
  type QuestGenerationStatus,
} from "@/types/domain";

export type { QuestGenerationEvent };

type QuestGenerationEventInput = Omit<QuestGenerationEvent, "occurredAt"> & {
  occurredAt?: Date;
};

type RecordQuestGenerationStatusInput = {
  questRequestId: string;
  generationStatus: QuestGenerationStatus;
  generationStage: QuestGenerationStage;
  generationProgressMessage?: string | null;
  generationPreviewText?: string | null;
  generationStartedAt?: Date | null;
  generationCompletedAt?: Date | null;
  generationFailedAt?: Date | null;
  generationLastErrorCode?: string | null;
  generationLastErrorMessage?: string | null;
  draftId?: string | null;
  eventType?: QuestGenerationEvent["type"];
  delta?: string | null;
};

const QUEST_REQUEST_STATUS_SELECT = {
  id: true,
  campaignId: true,
  townProfileId: true,
  requestMode: true,
  generationStatus: true,
  generationStage: true,
  generationProgressMessage: true,
  generationPreviewText: true,
  generationStartedAt: true,
  generationCompletedAt: true,
  generationFailedAt: true,
  generationLastErrorCode: true,
  generationLastErrorMessage: true,
  townName: true,
  locale: true,
  townVibe: true,
  localTension: true,
  questType: true,
  mainPlotRelation: true,
  desiredLength: true,
  extraContext: true,
} as const;

const eventEmitterKey = "__questGenerationEventEmitter";

function getQuestGenerationEventEmitter() {
  const globalScope = globalThis as typeof globalThis & {
    [eventEmitterKey]?: EventEmitter;
  };

  if (!globalScope[eventEmitterKey]) {
    globalScope[eventEmitterKey] = new EventEmitter();
    globalScope[eventEmitterKey].setMaxListeners(100);
  }

  return globalScope[eventEmitterKey];
}

function getQuestGenerationChannel(questRequestId: string) {
  return `quest-generation:${questRequestId}`;
}

function toQuestRequestRecord(record: {
  id: string;
  campaignId: string;
  townProfileId: string | null;
  requestMode: string;
  generationStatus: string;
  generationStage: string;
  generationProgressMessage: string | null;
  generationPreviewText: string | null;
  generationStartedAt: Date | null;
  generationCompletedAt: Date | null;
  generationFailedAt: Date | null;
  generationLastErrorCode: string | null;
  generationLastErrorMessage: string | null;
  townName: string;
  locale: string;
  townVibe: string | null;
  localTension: string | null;
  questType: string | null;
  mainPlotRelation: string | null;
  desiredLength: string | null;
  extraContext: string | null;
}) {
  return questRequestSchema.parse(record);
}

export function createQuestGenerationEvent(input: QuestGenerationEventInput) {
  return questGenerationEventSchema.parse({
    ...input,
    occurredAt: input.occurredAt ?? new Date(),
  });
}

export function publishQuestGenerationEvent(input: QuestGenerationEventInput) {
  const event = createQuestGenerationEvent(input);
  getQuestGenerationEventEmitter().emit(
    getQuestGenerationChannel(event.questRequestId),
    event,
  );
  return event;
}

export function subscribeToQuestGenerationEvents(
  questRequestId: string,
  listener: (event: QuestGenerationEvent) => void,
) {
  const emitter = getQuestGenerationEventEmitter();
  const channel = getQuestGenerationChannel(questRequestId);

  emitter.on(channel, listener);

  return () => {
    emitter.off(channel, listener);
  };
}

export async function loadQuestGenerationStatus(input: {
  campaignId: string;
  questRequestId: string;
}) {
  const questRequest = await db.questRequest.findFirst({
    where: {
      id: input.questRequestId,
      campaignId: input.campaignId,
    },
    select: {
      ...QUEST_REQUEST_STATUS_SELECT,
      questDraft: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (!questRequest) {
    return null;
  }

  const { questDraft, ...questRequestRecord } = questRequest;

  return {
    questRequest: toQuestRequestRecord(questRequestRecord),
    draft: questDraft,
  };
}

export async function recordQuestGenerationStatus({
  questRequestId,
  generationStatus,
  generationStage,
  generationProgressMessage,
  generationPreviewText,
  generationStartedAt,
  generationCompletedAt,
  generationFailedAt,
  generationLastErrorCode,
  generationLastErrorMessage,
  draftId = null,
  eventType,
  delta = null,
}: RecordQuestGenerationStatusInput) {
  const updatedQuestRequest = await db.questRequest.update({
    where: { id: questRequestId },
    data: {
      generationStatus,
      generationStage,
      generationProgressMessage:
        generationProgressMessage === undefined
          ? undefined
          : generationProgressMessage,
      generationPreviewText:
        generationPreviewText === undefined ? undefined : generationPreviewText,
      generationStartedAt:
        generationStartedAt === undefined ? undefined : generationStartedAt,
      generationCompletedAt:
        generationCompletedAt === undefined ? undefined : generationCompletedAt,
      generationFailedAt:
        generationFailedAt === undefined ? undefined : generationFailedAt,
      generationLastErrorCode:
        generationLastErrorCode === undefined ? undefined : generationLastErrorCode,
      generationLastErrorMessage:
        generationLastErrorMessage === undefined
          ? undefined
          : generationLastErrorMessage,
    },
    select: QUEST_REQUEST_STATUS_SELECT,
  });

  const questRequest = toQuestRequestRecord(updatedQuestRequest);
  const resolvedEventType =
    eventType ??
    (generationStatus === "completed"
      ? "completed"
      : generationStatus === "failed"
        ? "failed"
        : delta
          ? "text_delta"
          : "status");

  const event = publishQuestGenerationEvent({
    type: resolvedEventType,
    questRequestId,
    generationStatus: questRequest.generationStatus,
    generationStage: questRequest.generationStage,
    message: questRequest.generationProgressMessage ?? null,
    previewText: questRequest.generationPreviewText ?? null,
    delta,
    draftId,
    errorCode: questRequest.generationLastErrorCode ?? null,
    errorMessage: questRequest.generationLastErrorMessage ?? null,
  });

  return {
    questRequest,
    event,
  };
}

export async function appendQuestGenerationPreview(input: {
  questRequestId: string;
  delta: string;
  generationProgressMessage?: string | null;
}) {
  if (input.delta.trim().length === 0) {
    return null;
  }

  const currentQuestRequest = await db.questRequest.findUnique({
    where: { id: input.questRequestId },
    select: {
      generationPreviewText: true,
    },
  });

  if (!currentQuestRequest) {
    return null;
  }

  return recordQuestGenerationStatus({
    questRequestId: input.questRequestId,
    generationStatus: "running",
    generationStage: "streaming",
    generationProgressMessage:
      input.generationProgressMessage ?? "Streaming draft text...",
    generationPreviewText: `${
      currentQuestRequest.generationPreviewText ?? ""
    }${input.delta}`,
    eventType: "text_delta",
    delta: input.delta,
  });
}

export async function markQuestGenerationQueued(input: {
  questRequestId: string;
  message?: string | null;
}) {
  return recordQuestGenerationStatus({
    questRequestId: input.questRequestId,
    generationStatus: "queued",
    generationStage: "queued",
    generationProgressMessage: input.message ?? null,
    generationStartedAt: null,
    generationCompletedAt: null,
    generationFailedAt: null,
    generationLastErrorCode: null,
    generationLastErrorMessage: null,
    eventType: "status",
  });
}

export async function markQuestGenerationRunning(input: {
  questRequestId: string;
  stage: QuestGenerationStage;
  message?: string | null;
  startedAt?: Date | null;
}) {
  return recordQuestGenerationStatus({
    questRequestId: input.questRequestId,
    generationStatus: "running",
    generationStage: input.stage,
    generationProgressMessage: input.message ?? null,
    generationStartedAt:
      input.startedAt === undefined ? undefined : input.startedAt,
    generationCompletedAt: null,
    generationFailedAt: null,
    generationLastErrorCode: null,
    generationLastErrorMessage: null,
    eventType: "status",
  });
}

export async function markQuestGenerationCompleted(input: {
  questRequestId: string;
  draftId: string;
  message?: string | null;
}) {
  return recordQuestGenerationStatus({
    questRequestId: input.questRequestId,
    generationStatus: "completed",
    generationStage: "completed",
    generationProgressMessage: input.message ?? "Quest draft ready.",
    generationCompletedAt: new Date(),
    generationFailedAt: null,
    draftId: input.draftId,
    eventType: "completed",
  });
}

export async function markQuestGenerationFailed(input: {
  questRequestId: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  message?: string | null;
}) {
  return recordQuestGenerationStatus({
    questRequestId: input.questRequestId,
    generationStatus: "failed",
    generationStage: "failed",
    generationProgressMessage:
      input.message ?? input.errorMessage ?? "Quest generation failed.",
    generationFailedAt: new Date(),
    generationLastErrorCode: input.errorCode ?? null,
    generationLastErrorMessage: input.errorMessage ?? null,
    eventType: "failed",
  });
}
