import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { campaignLlmSettingsSchema } from "@/types/domain";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { campaignId } = await context.params;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      llmProvider: true,
      llmApiKey: true,
      llmModel: true,
      llmBaseUrl: true,
    },
  });

  if (!campaign) {
    return NextResponse.json(
      { errorCode: "campaignNotFound", error: "Campaign not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    settings: campaignLlmSettingsSchema.parse({
      llmProvider: campaign.llmProvider,
      llmApiKey: campaign.llmApiKey,
      llmModel: campaign.llmModel,
      llmBaseUrl: campaign.llmBaseUrl,
    }),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  let body: z.infer<typeof campaignLlmSettingsSchema>;

  try {
    body = campaignLlmSettingsSchema.parse(await request.json());
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
    select: { id: true },
  });

  if (!campaign) {
    return NextResponse.json(
      { errorCode: "campaignNotFound", error: "Campaign not found." },
      { status: 404 },
    );
  }

  const updatedCampaign = await db.campaign.update({
    where: { id: campaignId },
    data: {
      llmProvider: body.llmProvider,
      llmApiKey: body.llmApiKey,
      llmModel: body.llmModel,
      llmBaseUrl: body.llmBaseUrl,
    },
    select: {
      llmProvider: true,
      llmApiKey: true,
      llmModel: true,
      llmBaseUrl: true,
    },
  });

  return NextResponse.json({
    settings: campaignLlmSettingsSchema.parse(updatedCampaign),
  });
}
