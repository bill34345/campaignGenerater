import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { scheduleQuestGenerationDispatch } from "@/lib/quests/generation-dispatch";
import { questRequestSchema } from "@/types/domain";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

const createQuestRequestBodySchema = questRequestSchema
  .omit({
    id: true,
    campaignId: true,
    generationStatus: true,
    generationStage: true,
    generationProgressMessage: true,
    generationPreviewText: true,
    generationStartedAt: true,
    generationCompletedAt: true,
    generationFailedAt: true,
    generationLastErrorCode: true,
    generationLastErrorMessage: true,
  })
  .strict();

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export async function POST(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  let body: z.infer<typeof createQuestRequestBodySchema>;

  try {
    body = createQuestRequestBodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return NextResponse.json(
        { errorCode: "invalidRequestBody", error: "Invalid request body." },
        { status: 400 },
      );
    }

    throw error;
  }

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
    },
  });

  if (!campaign) {
    return NextResponse.json(
      { errorCode: "campaignNotFound", error: "Campaign not found." },
      { status: 404 },
    );
  }

  const townRecord = await db.townProfile.findFirst({
    where: body.townProfileId
      ? {
          campaignId,
          id: body.townProfileId,
        }
      : undefined,
    select: {
      id: true,
      name: true,
    },
  });

  if (
    townRecord &&
    body.townProfileId &&
    normalizeText(body.townName) !== normalizeText(townRecord.name)
  ) {
    return NextResponse.json(
      {
        errorCode: "townNameMismatch",
        error: `townName must match the selected town profile name "${townRecord.name}".`,
      },
      { status: 400 },
    );
  }

  const createdQuestRequest = await db.questRequest.create({
    data: {
      campaignId,
      townProfileId: townRecord?.id ?? null,
      requestMode: body.requestMode,
      generationStatus: "queued",
      generationStage: "queued",
      generationProgressMessage: "Queued for generation.",
      generationPreviewText: null,
      generationStartedAt: null,
      generationCompletedAt: null,
      generationFailedAt: null,
      generationLastErrorCode: null,
      generationLastErrorMessage: null,
      townName: townRecord?.name ?? body.townName,
      townVibe: body.townVibe ?? null,
      localTension: body.localTension ?? null,
      questType: body.questType ?? null,
      mainPlotRelation: body.mainPlotRelation ?? null,
      desiredLength: body.desiredLength ?? null,
      extraContext: body.extraContext ?? null,
      locale: body.locale,
    },
    select: {
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
    },
  });

  scheduleQuestGenerationDispatch({
    campaignId,
    questRequestId: createdQuestRequest.id,
  });

  return NextResponse.json(
    {
      questRequest: questRequestSchema.parse(createdQuestRequest),
      draft: null,
    },
    { status: 202 },
  );
}
