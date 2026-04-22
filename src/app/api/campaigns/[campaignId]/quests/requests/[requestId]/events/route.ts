import {
  loadQuestGenerationStatus,
  subscribeToQuestGenerationEvents,
  type QuestGenerationEvent,
} from "@/lib/quests/generation-status";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    campaignId: string;
    requestId: string;
  }>;
};

function encodeSseMessage(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(_request: Request, context: RouteContext) {
  const { campaignId, requestId } = await context.params;
  const status = await loadQuestGenerationStatus({
    campaignId,
    questRequestId: requestId,
  });

  if (!status) {
    return new Response(
      encodeSseMessage("failed", {
        errorCode: "questRequestNotFound",
        errorMessage: "Quest request not found.",
      }),
      {
        status: 404,
        headers: {
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "content-type": "text/event-stream",
        },
      },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(encodeSseMessage(event, data)));
      };
      const closeIfTerminal = (event: QuestGenerationEvent) => {
        if (event.type === "completed" || event.type === "failed") {
          cleanup();
          controller.close();
        }
      };
      const eventListener = (event: QuestGenerationEvent) => {
        send(event.type, event);
        closeIfTerminal(event);
      };
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 15000);
      const unsubscribe = subscribeToQuestGenerationEvents(requestId, eventListener);
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      send("status", {
        questRequest: status.questRequest,
        draft: status.draft,
      });

      if (status.questRequest.generationPreviewText) {
        send("text_delta", {
          type: "text_delta",
          questRequestId: requestId,
          generationStatus: status.questRequest.generationStatus,
          generationStage: status.questRequest.generationStage,
          previewText: status.questRequest.generationPreviewText,
          delta: null,
          message: status.questRequest.generationProgressMessage ?? null,
          occurredAt: new Date(),
        });
      }

      if (status.questRequest.generationStatus === "completed") {
        send("completed", {
          type: "completed",
          questRequestId: requestId,
          generationStatus: status.questRequest.generationStatus,
          generationStage: status.questRequest.generationStage,
          previewText: status.questRequest.generationPreviewText ?? null,
          message: status.questRequest.generationProgressMessage ?? null,
          draftId: status.draft?.id ?? null,
          occurredAt: new Date(),
        });
        cleanup();
        controller.close();
        return;
      }

      if (status.questRequest.generationStatus === "failed") {
        send("failed", {
          type: "failed",
          questRequestId: requestId,
          generationStatus: status.questRequest.generationStatus,
          generationStage: status.questRequest.generationStage,
          message: status.questRequest.generationProgressMessage ?? null,
          errorCode: status.questRequest.generationLastErrorCode ?? null,
          errorMessage: status.questRequest.generationLastErrorMessage ?? null,
          occurredAt: new Date(),
        });
        cleanup();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream",
    },
  });
}
