import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveLlmProvider } from "@/lib/llm/provider-resolver";
import { llmProviderSchema } from "@/types/domain";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
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

  const { config, adapter } = resolveLlmProvider({
    llmProvider: llmProviderSchema.parse(campaign.llmProvider),
    llmApiKey: campaign.llmApiKey,
    llmModel: campaign.llmModel,
    llmBaseUrl: campaign.llmBaseUrl,
  });

  if (!config.llmApiKey) {
    return NextResponse.json(
      {
        errorCode: "llmSettingsRequired",
        error: "Configure an API key before testing the provider.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await adapter.testConnection({ config });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        errorCode: "llmConnectionTestFailed",
        error: error instanceof Error ? error.message : "Provider test failed.",
      },
      { status: 502 },
    );
  }
}
