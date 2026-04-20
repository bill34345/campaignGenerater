import {
  attachDuplicateWarnings,
  summarizeImportBatchReadiness,
} from "@/lib/imports/staging";
import {
  importBatchFileSchema,
  importBatchSchema,
} from "@/types/domain";

type ImportBatchFileRecord = {
  id: string;
  importBatchId: string;
  campaignId: string;
  originalName: string;
  storedPath: string | null;
  mimeType: string | null;
  checksum: string | null;
  sizeBytes: number | null;
  sourceType: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ImportBatchRecord = {
  id: string;
  campaignId: string;
  status: string;
  defaultSourceType: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  files: ImportBatchFileRecord[];
};

function normalizeReadinessStatus(status: string): "staged" | "failed" {
  return status === "failed" ? "failed" : "staged";
}

export function deriveImportBatchStatus(batch: ImportBatchRecord) {
  if (batch.status === "processing" || batch.status === "completed") {
    return batch.status;
  }

  const summary = summarizeImportBatchReadiness(
    batch.files.map((file) => ({
      originalName: file.originalName,
      checksum: file.checksum ?? undefined,
      status: normalizeReadinessStatus(file.status),
    })),
  );

  return summary.ready ? "ready" : "staged";
}

export function serializeImportBatch(batch: ImportBatchRecord) {
  const parsedFiles = batch.files.map((file) =>
    importBatchFileSchema.parse({
      id: file.id,
      importBatchId: file.importBatchId,
      campaignId: file.campaignId,
      originalName: file.originalName,
      storedPath: file.storedPath ?? undefined,
      mimeType: file.mimeType ?? undefined,
      checksum: file.checksum ?? undefined,
      sizeBytes: file.sizeBytes ?? undefined,
      sourceType: file.sourceType,
      status: file.status,
      errorCode: file.errorCode ?? undefined,
      errorMessage: file.errorMessage ?? undefined,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    }),
  );

  const duplicateWarningInputs = parsedFiles.map((file) => ({
    originalName: file.originalName,
    checksum: file.checksum,
    status: normalizeReadinessStatus(file.status),
  }));

  const duplicateWarnings = attachDuplicateWarnings(duplicateWarningInputs);
  const filesWithWarnings = parsedFiles.map((file, index) => ({
    ...file,
    warnings: duplicateWarnings[index]?.warnings ?? [],
  }));

  const summary = summarizeImportBatchReadiness(
    duplicateWarningInputs,
  );

  const parsedBatch = importBatchSchema.parse({
    id: batch.id,
    campaignId: batch.campaignId,
    status: batch.status,
    defaultSourceType: batch.defaultSourceType,
    startedAt: batch.startedAt,
    completedAt: batch.completedAt,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    files: filesWithWarnings,
  });

  return {
    batch: parsedBatch,
    summary,
  };
}
