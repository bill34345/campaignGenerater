import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deriveImportBatchStatus, serializeImportBatch } from "@/lib/imports/batch-payload";
import { removeCampaignUpload } from "@/lib/files/storage";
import { saveStagedImportFiles } from "@/lib/imports/staging";
import { importSourceTypeSchema } from "@/types/domain";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    campaignId: string;
    batchId: string;
  }>;
};

const patchImportBatchSchema = z
  .object({
    defaultSourceType: importSourceTypeSchema.optional(),
    fileSourceTypes: z
      .array(
        z
          .object({
            fileId: z.string().trim().min(1),
            sourceType: importSourceTypeSchema,
          })
          .strict(),
      )
      .optional(),
    removeFileIds: z.array(z.string().trim().min(1)).optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.defaultSourceType !== undefined ||
      (body.fileSourceTypes?.length ?? 0) > 0 ||
      (body.removeFileIds?.length ?? 0) > 0,
    {
      message: "At least one batch change is required.",
    },
  );

async function loadBatch(campaignId: string, batchId: string) {
  return db.importBatch.findFirst({
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
}

function getUploadedFiles(formData: FormData) {
  return formData.getAll("files").filter(
    (entry): entry is File =>
      typeof entry === "object" &&
      entry !== null &&
      "name" in entry &&
      typeof entry.name === "string",
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const { campaignId, batchId } = await context.params;
  const batch = await loadBatch(campaignId, batchId);

  if (!batch) {
    return NextResponse.json(
      { errorCode: "importBatchNotFound", error: "Import batch not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(serializeImportBatch(batch));
}

export async function PATCH(request: Request, context: RouteContext) {
  const { campaignId, batchId } = await context.params;

  const batch = await loadBatch(campaignId, batchId);
  if (!batch) {
    return NextResponse.json(
      { errorCode: "importBatchNotFound", error: "Import batch not found." },
      { status: 404 },
    );
  }

  if (batch.status === "processing" || batch.status === "completed") {
    return NextResponse.json(
      {
        errorCode: "importBatchLocked",
        error: "This import batch can no longer be edited.",
      },
      { status: 409 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data") || !contentType) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { errorCode: "invalidMultipartUpload", error: "Invalid multipart upload." },
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

    const parsedDefaultSourceType = importSourceTypeSchema.safeParse(
      formData.get("defaultSourceType") ?? batch.defaultSourceType,
    );

    if (!parsedDefaultSourceType.success) {
      return NextResponse.json(
        { errorCode: "invalidSourceType", error: "Invalid default source type." },
        { status: 400 },
      );
    }

    for (const upload of uploads) {
      if (upload.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          {
            errorCode: "uploadLimitExceeded",
            error: `File exceeds the ${Math.round(
              (10 * 1024 * 1024) / (1024 * 1024),
            )} MB upload limit`,
          },
          { status: 413 },
        );
      }
    }

    const stagedFiles = await saveStagedImportFiles({
      batchId,
      campaignId,
      defaultSourceType: parsedDefaultSourceType.data,
      files: await Promise.all(
        uploads.map(async (upload) => ({
          fileName: upload.name,
          mimeType: upload.type || "application/octet-stream",
          buffer: Buffer.from(await upload.arrayBuffer()),
        })),
      ),
    });

    if (parsedDefaultSourceType.data !== batch.defaultSourceType) {
      await db.importBatch.update({
        where: { id: batchId },
        data: {
          defaultSourceType: parsedDefaultSourceType.data,
        },
      });
    }

    if (stagedFiles.length > 0) {
      await db.importBatchFile.createMany({
        data: stagedFiles.map((file) => ({
          importBatchId: batchId,
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
      });
    }

    const reloadedBatch = await loadBatch(campaignId, batchId);
    if (!reloadedBatch) {
      return NextResponse.json(
        { errorCode: "importBatchNotFound", error: "Import batch not found." },
        { status: 404 },
      );
    }

    const nextStatus = deriveImportBatchStatus(reloadedBatch);
    const updatedBatch =
      nextStatus === reloadedBatch.status
        ? reloadedBatch
        : await db.importBatch.update({
            where: { id: batchId },
            data: {
              status: nextStatus,
            },
            include: {
              files: {
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              },
            },
          });

    return NextResponse.json(serializeImportBatch(updatedBatch));
  }

  let body: z.infer<typeof patchImportBatchSchema>;
  try {
    body = patchImportBatchSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return NextResponse.json(
        { errorCode: "invalidRequestBody", error: "Invalid request body." },
        { status: 400 },
      );
    }

    throw error;
  }

  const removeFileIds = new Set(body.removeFileIds ?? []);
  const overrides = new Map(
    (body.fileSourceTypes ?? []).map((entry) => [entry.fileId, entry.sourceType]),
  );
  const batchFileIds = new Set(batch.files.map((file) => file.id));

  const unknownFileId = [...removeFileIds, ...overrides.keys()].find(
    (fileId) => !batchFileIds.has(fileId),
  );

  if (unknownFileId) {
    return NextResponse.json(
      { errorCode: "importBatchFileNotFound", error: "Import batch file not found." },
      { status: 400 },
    );
  }

  const storedPathsToDelete = batch.files
    .filter((file) => removeFileIds.has(file.id) && file.storedPath)
    .map((file) => file.storedPath)
    .filter((storedPath): storedPath is string => Boolean(storedPath));

  const updatedBatch = await db.$transaction(async (tx) => {
    if (removeFileIds.size > 0) {
      await tx.importBatchFile.deleteMany({
        where: {
          importBatchId: batchId,
          campaignId,
          id: {
            in: [...removeFileIds],
          },
        },
      });
    }

    if (body.defaultSourceType) {
      await tx.importBatch.update({
        where: { id: batchId },
        data: {
          defaultSourceType: body.defaultSourceType,
        },
      });

      await tx.importBatchFile.updateMany({
        where: {
          importBatchId: batchId,
          campaignId,
          sourceType: batch.defaultSourceType,
        },
        data: {
          sourceType: body.defaultSourceType,
        },
      });
    }

    for (const [fileId, sourceType] of overrides.entries()) {
      if (removeFileIds.has(fileId)) {
        continue;
      }

      await tx.importBatchFile.update({
        where: { id: fileId },
        data: { sourceType },
      });
    }

    const nextBatch = await tx.importBatch.findFirst({
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

    if (!nextBatch) {
      throw new Error("Import batch could not be reloaded after update.");
    }

    const nextStatus = deriveImportBatchStatus(nextBatch);
    if (nextStatus === nextBatch.status) {
      return nextBatch;
    }

    return tx.importBatch.update({
      where: { id: batchId },
      data: {
        status: nextStatus,
      },
      include: {
        files: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });
  });

  await Promise.all(
    storedPathsToDelete.map((storedPath) =>
      removeCampaignUpload(path.resolve(process.cwd(), storedPath)).catch(() => {
        // Best-effort cleanup. Keep the batch edit result even if the file is already gone.
      }),
    ),
  );

  return NextResponse.json(serializeImportBatch(updatedBatch));
}
