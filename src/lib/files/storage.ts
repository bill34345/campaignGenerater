import { randomUUID, createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type SaveBufferedFileInput = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  relativeDirectory: string;
  rootDir?: string;
};

export type SavedBufferedFile = {
  originalName: string;
  storedPath: string;
  absolutePath: string;
  checksum: string;
  mimeType: string;
  size: number;
};

export type SaveCampaignUploadInput = {
  campaignId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  rootDir?: string;
};

export type SavedCampaignUpload = SavedBufferedFile;

export function sanitizeStoredFileName(fileName: string) {
  const normalized = path.basename(fileName).replace(/[^\w.-]+/g, "_");
  return normalized.length > 0 ? normalized : "upload";
}

export function computeBufferChecksum(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function saveBufferedFile(
  input: SaveBufferedFileInput,
): Promise<SavedBufferedFile> {
  const rootDir = input.rootDir ?? process.cwd();
  const storedPath = path.posix.join(
    input.relativeDirectory,
    `${Date.now()}-${randomUUID()}-${sanitizeStoredFileName(input.fileName)}`,
  );
  const absolutePath = path.resolve(rootDir, storedPath);
  const checksum = computeBufferChecksum(input.buffer);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);

  return {
    originalName: input.fileName,
    storedPath,
    absolutePath,
    checksum,
    mimeType: input.mimeType,
    size: input.buffer.byteLength,
  };
}

export async function saveCampaignUpload(
  input: SaveCampaignUploadInput,
): Promise<SavedCampaignUpload> {
  return saveBufferedFile({
    fileName: input.fileName,
    mimeType: input.mimeType,
    buffer: input.buffer,
    relativeDirectory: path.posix.join("data", "uploads", input.campaignId),
    rootDir: input.rootDir,
  });
}

export async function removeCampaignUpload(absolutePath: string): Promise<void> {
  try {
    await unlink(absolutePath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}
