import { randomUUID, createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type SaveCampaignUploadInput = {
  campaignId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  rootDir?: string;
};

export type SavedCampaignUpload = {
  originalName: string;
  storedPath: string;
  absolutePath: string;
  checksum: string;
  mimeType: string;
  size: number;
};

function sanitizeFileName(fileName: string) {
  const normalized = path.basename(fileName).replace(/[^\w.-]+/g, "_");
  return normalized.length > 0 ? normalized : "upload";
}

export async function saveCampaignUpload(
  input: SaveCampaignUploadInput,
): Promise<SavedCampaignUpload> {
  const rootDir = input.rootDir ?? process.cwd();
  const storedPath = path.posix.join(
    "data",
    "uploads",
    input.campaignId,
    `${Date.now()}-${randomUUID()}-${sanitizeFileName(input.fileName)}`,
  );
  const absolutePath = path.resolve(rootDir, storedPath);
  const checksum = createHash("sha256").update(input.buffer).digest("hex");

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
