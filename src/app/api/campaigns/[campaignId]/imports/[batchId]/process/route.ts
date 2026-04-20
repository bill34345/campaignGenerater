import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeImportBatch } from "@/lib/imports/batch-payload";
import {
  ImportBatchProcessingError,
  processImportBatch,
} from "@/lib/imports/process-batch";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    campaignId: string;
    batchId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { campaignId, batchId } = await context.params;

  try {
    const processing = await processImportBatch({
      campaignId,
      batchId,
    });

    const batch = await db.importBatch.findFirst({
      where: {
        id: batchId,
        campaignId,
      },
      include: {
        files: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!batch) {
      return NextResponse.json(
        { errorCode: "importBatchNotFound", error: "Import batch not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ...serializeImportBatch(batch),
      processing,
      resultsUrl: `/campaigns/${campaignId}/imports/${batchId}/results`,
    });
  } catch (error) {
    if (error instanceof ImportBatchProcessingError) {
      return NextResponse.json(
        {
          errorCode: error.errorCode,
          error: error.message,
        },
        { status: error.status },
      );
    }

    throw error;
  }
}
