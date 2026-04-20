import path from "node:path";
import { detectFileFormat } from "@/lib/files/extract-text";
import { saveBufferedFile } from "@/lib/files/storage";
import {
  DEFAULT_SOURCE_TYPE,
  type SourceType,
} from "@/lib/imports/source-type";

export type StagedImportFileInput = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  sourceType?: SourceType | null;
};

export type SaveStagedImportFilesInput = {
  batchId: string;
  campaignId: string;
  files: StagedImportFileInput[];
  defaultSourceType?: SourceType;
  rootDir?: string;
};

export type StagedImportFileRecord = {
  campaignId: string;
  importBatchId: string;
  originalName: string;
  sourceType: SourceType;
  status: "staged" | "failed";
  mimeType?: string;
  checksum?: string;
  sizeBytes?: number;
  storedPath?: string;
  absolutePath?: string;
  errorCode?: "unsupported_format";
  errorMessage?: string;
  warnings?: DuplicateChecksumWarning[];
};

export type DuplicateStagedFileGroup = {
  checksum: string;
  fileNames: string[];
};

export type DuplicateChecksumWarning = {
  code: "duplicate_checksum";
  checksum: string;
  fileNames: string[];
};

export type ImportBatchReadinessSummary = {
  ready: boolean;
  stagedFileCount: number;
  failedFileCount: number;
  warningCount: number;
  duplicateChecksums: DuplicateStagedFileGroup[];
};

export function detectDuplicateStagedFiles(
  files: readonly Pick<StagedImportFileRecord, "checksum" | "originalName" | "status">[],
): DuplicateStagedFileGroup[] {
  const groupedByChecksum = new Map<string, string[]>();

  for (const file of files) {
    if (file.status !== "staged" || !file.checksum) {
      continue;
    }

    const existing = groupedByChecksum.get(file.checksum) ?? [];
    existing.push(file.originalName);
    groupedByChecksum.set(file.checksum, existing);
  }

  return Array.from(groupedByChecksum.entries())
    .filter(([, fileNames]) => fileNames.length > 1)
    .map(([checksum, fileNames]) => ({
      checksum,
      fileNames,
    }));
}

export function summarizeImportBatchReadiness(
  files: readonly Pick<StagedImportFileRecord, "checksum" | "originalName" | "status">[],
): ImportBatchReadinessSummary {
  const duplicateChecksums = detectDuplicateStagedFiles(files);
  const stagedFileCount = files.filter((file) => file.status === "staged").length;
  const failedFileCount = files.filter((file) => file.status === "failed").length;

  return {
    ready: stagedFileCount > 0 && failedFileCount === 0,
    stagedFileCount,
    failedFileCount,
    warningCount: duplicateChecksums.length,
    duplicateChecksums,
  };
}

export function attachDuplicateWarnings<
  TFile extends Pick<StagedImportFileRecord, "checksum" | "originalName" | "status">,
>(files: readonly TFile[]): Array<TFile & { warnings: DuplicateChecksumWarning[] }> {
  const duplicateChecksums = detectDuplicateStagedFiles(files);
  const warningsByFileName = new Map<string, DuplicateChecksumWarning[]>();

  for (const duplicate of duplicateChecksums) {
    for (const fileName of duplicate.fileNames) {
      const warnings = warningsByFileName.get(fileName) ?? [];
      warnings.push({
        code: "duplicate_checksum",
        checksum: duplicate.checksum,
        fileNames: duplicate.fileNames,
      });
      warningsByFileName.set(fileName, warnings);
    }
  }

  return files.map((file) => ({
    ...file,
    warnings: warningsByFileName.get(file.originalName) ?? [],
  }));
}

export async function saveStagedImportFiles({
  batchId,
  campaignId,
  files,
  defaultSourceType = DEFAULT_SOURCE_TYPE,
  rootDir,
}: SaveStagedImportFilesInput): Promise<StagedImportFileRecord[]> {
  const stagedFiles: StagedImportFileRecord[] = [];

  for (const file of files) {
    const format = detectFileFormat(file.fileName, file.mimeType);
    const sourceType = file.sourceType ?? defaultSourceType;

    if (!format) {
      stagedFiles.push({
        campaignId,
        importBatchId: batchId,
        originalName: file.fileName,
        sourceType,
        status: "failed",
        errorCode: "unsupported_format",
        errorMessage: "The uploaded file format is not supported.",
      });
      continue;
    }

    const savedFile = await saveBufferedFile({
      fileName: file.fileName,
      mimeType: file.mimeType,
      buffer: file.buffer,
      relativeDirectory: path.posix.join(
        "data",
        "imports",
        campaignId,
        batchId,
      ),
      rootDir,
    });

    stagedFiles.push({
      campaignId,
      importBatchId: batchId,
      originalName: savedFile.originalName,
      sourceType,
      status: "staged",
      mimeType: savedFile.mimeType,
      checksum: savedFile.checksum,
      sizeBytes: savedFile.size,
      storedPath: savedFile.storedPath,
      absolutePath: savedFile.absolutePath,
    });
  }

  return attachDuplicateWarnings(stagedFiles);
}
