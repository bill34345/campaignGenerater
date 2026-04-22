import { NextResponse } from "next/server";
import { loadQuestGenerationStatus } from "@/lib/quests/generation-status";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    campaignId: string;
    requestId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { campaignId, requestId } = await context.params;
  const status = await loadQuestGenerationStatus({
    campaignId,
    questRequestId: requestId,
  });

  if (!status) {
    return NextResponse.json(
      { errorCode: "questRequestNotFound", error: "Quest request not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(status);
}
