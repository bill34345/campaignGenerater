import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  questDraftPatchSchema,
  toQuestDraftRecord,
  type QuestDraftPatch,
} from "@/lib/quests/draft-record";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    campaignId: string;
    questId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { campaignId, questId } = await context.params;

  const draft = await db.questDraft.findFirst({
    where: {
      id: questId,
      campaignId,
    },
  });

  if (!draft) {
    return NextResponse.json(
      { errorCode: "questDraftNotFound", error: "Quest draft not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ draft: toQuestDraftRecord(draft) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { campaignId, questId } = await context.params;
  let body: QuestDraftPatch;

  try {
    body = questDraftPatchSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return NextResponse.json(
        { errorCode: "invalidRequestBody", error: "Invalid request body." },
        { status: 400 },
      );
    }

    throw error;
  }

  const existing = await db.questDraft.findFirst({
    where: {
      id: questId,
      campaignId,
    },
    select: {
      id: true,
      campaignId: true,
      questRequestId: true,
      title: true,
      premise: true,
      hook: true,
      locale: true,
      generationMode: true,
      generationProvider: true,
      generationModel: true,
      fallbackReason: true,
      generationErrorCode: true,
      scenes: true,
      npcs: true,
      encounters: true,
      rewards: true,
      returnToMainPlot: true,
      gmSummary: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Quest draft not found" }, { status: 404 });
  }

  const currentDraft = toQuestDraftRecord(existing);
  const nextDraft = {
    ...currentDraft,
    ...body,
  };

  const draft = await db.questDraft.update({
    where: { id: questId },
    data: {
      locale: existing.locale,
      title: nextDraft.title,
      premise: nextDraft.premise,
      hook: nextDraft.hook,
      scenes: nextDraft.scenes,
      npcs: nextDraft.npcs,
      rewards: nextDraft.rewards,
      returnToMainPlot: nextDraft.returnToMainPlot,
      gmSummary: nextDraft.gmSummary,
    },
  });

  return NextResponse.json({ draft: toQuestDraftRecord(draft) });
}
