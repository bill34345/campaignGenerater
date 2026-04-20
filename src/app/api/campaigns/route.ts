import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createCampaignSchema } from "@/types/domain";

export const runtime = "nodejs";

function toCampaignSummary(campaign: {
  id: string;
  name: string;
  system: string;
  tone: string;
  partyLevel: number;
  contentConstraints: string | null;
  llmProvider: string;
  llmApiKey: string | null;
  llmModel: string | null;
  llmBaseUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: campaign.id,
    name: campaign.name,
    system: campaign.system,
    tone: campaign.tone,
    partyLevel: campaign.partyLevel,
    contentConstraints: campaign.contentConstraints,
    llmProvider: campaign.llmProvider,
    llmApiKey: campaign.llmApiKey,
    llmModel: campaign.llmModel,
    llmBaseUrl: campaign.llmBaseUrl,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

export async function GET() {
  const campaigns = await db.campaign.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      system: true,
      tone: true,
      partyLevel: true,
      contentConstraints: true,
      llmProvider: true,
      llmApiKey: true,
      llmModel: true,
      llmBaseUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    campaigns: campaigns.map(toCampaignSummary),
  });
}

export async function POST(request: Request) {
  let body: z.infer<typeof createCampaignSchema>;

  try {
    body = createCampaignSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return NextResponse.json(
        { errorCode: "invalidRequestBody", error: "Invalid request body." },
        { status: 400 },
      );
    }

    throw error;
  }

  const campaign = await db.campaign.create({
    data: body,
    select: {
      id: true,
      name: true,
      system: true,
      tone: true,
      partyLevel: true,
      contentConstraints: true,
      llmProvider: true,
      llmApiKey: true,
      llmModel: true,
      llmBaseUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(
    {
      campaign: toCampaignSummary(campaign),
    },
    { status: 201 },
  );
}
