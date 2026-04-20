import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { serializeImportBatch, deriveImportBatchStatus } from "@/lib/imports/batch-payload";
import { saveStagedImportFiles } from "@/lib/imports/staging";
import { importSourceTypeSchema } from "@/types/domain";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

type BufferedUpload = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

type FailedUpload = {
  originalName: string;
  mimeType: string;
  sourceType: z.infer<typeof importSourceTypeSchema>;
  errorCode: string;
  errorMessage: string;
};

function getUploadedFiles(formData: FormData) {
  return formData.getAll("files").filter(
    (entry): entry is File =>
      typeof entry === "object" &&
      entry !== null &&
      "name" in entry &&
      typeof entry.name === "string",
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { errorCode: "invalidMultipartUpload", error: "Invalid multipart upload." },
      { status: 400 },
    );
  }

  const defaultSourceTypeResult = importSourceTypeSchema.safeParse(
    formData.get("defaultSourceType") ?? "custom_reference",
  );

  if (!defaultSourceTypeResult.success) {
    return NextResponse.json(
      { errorCode: "invalidSourceType", error: "Invalid default source type." },
      { status: 400 },
    );
  }

  const uploads = getUploadedFiles(formData);
  if (uploads.length === 0) {
    return NextResponse.json(
      { errorCode: "missingFileUpload", error: "Missing file upload." },
      { status: 400 },
    );
  }

  const bufferedUploads: BufferedUpload[] = [];
  const failedUploads: FailedUpload[] = [];

  for (const upload of uploads) {
    if (upload.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          errorCode: "uploadLimitExceeded",
          error: `File exceeds the ${Math.round(
            MAX_UPLOAD_BYTES / (1024 * 1024),
          )} MB upload limit`,
        },
        { status: 413 },
      );
    }

    try {
      bufferedUploads.push({
        fileName: upload.name,
        mimeType: upload.type || "application/octet-stream",
        buffer: Buffer.from(await upload.arrayBuffer()),
      });
    } catch {
      failedUploads.push({
        originalName: upload.name,
        mimeType: upload.type || "application/octet-stream",
        sourceType: defaultSourceTypeResult.data,
        errorCode: "uploadedFileUnreadable",
        errorMessage: "Uploaded file could not be read.",
      });
    }
  }

  const createdBatch = await db.importBatch.create({
    data: {
      campaignId,
      status: "staged",
      defaultSourceType: defaultSourceTypeResult.data,
    },
    select: {
      id: true,
      campaignId: true,
      status: true,
      defaultSourceType: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const stagedFiles = await saveStagedImportFiles({
    batchId: createdBatch.id,
    campaignId,
    defaultSourceType: defaultSourceTypeResult.data,
    files: bufferedUploads,
  });

  if (stagedFiles.length + failedUploads.length > 0) {
    await db.importBatchFile.createMany({
      data: [
        ...stagedFiles.map((file) => ({
          importBatchId: createdBatch.id,
          campaignId,
          originalName: file.originalName,
          storedPath: file.storedPath ?? null,
          mimeType: file.mimeType ?? null,
          checksum: file.checksum ?? null,
          sizeBytes: file.sizeBytes ?? null,
          sourceType: file.sourceType,
          status: file.status,
          errorCode: file.errorCode ?? null,
          errorMessage: file.errorMessage ?? null,
        })),
        ...failedUploads.map((file) => ({
          importBatchId: createdBatch.id,
          campaignId,
          originalName: file.originalName,
          storedPath: null,
          mimeType: file.mimeType,
          checksum: null,
          sizeBytes: null,
          sourceType: file.sourceType,
          status: "failed",
          errorCode: file.errorCode,
          errorMessage: file.errorMessage,
        })),
      ],
    });
  }

  const batch = await db.importBatch.findFirst({
    where: {
      id: createdBatch.id,
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
      { errorCode: "genericFailed", error: "Import batch could not be loaded." },
      { status: 500 },
    );
  }

  const nextStatus = deriveImportBatchStatus(batch);
  const updatedBatch =
    nextStatus === batch.status
      ? batch
      : await db.importBatch.update({
          where: { id: batch.id },
          data: {
            status: nextStatus,
          },
          include: {
            files: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            },
          },
        });

  return NextResponse.json(serializeImportBatch(updatedBatch), { status: 201 });
}
