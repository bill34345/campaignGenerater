import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { importBatchSchema } from "@/types/domain";
import { GET, PATCH } from "@/app/api/campaigns/[campaignId]/imports/[batchId]/route";
import { POST as PROCESS } from "@/app/api/campaigns/[campaignId]/imports/[batchId]/process/route";
import { POST } from "@/app/api/campaigns/[campaignId]/imports/route";

const processMocks = vi.hoisted(() => ({
  extractFactsFromChunks: vi.fn(),
}));

vi.mock("@/lib/llm/provider-resolver", () => ({
  resolveLlmProvider: vi.fn(() => ({
    config: {
      llmProvider: "openai_chat",
      llmApiKey: "playwright-test-key",
      llmModel: null,
      llmBaseUrl: null,
    },
    adapter: {
      extractFactsFromChunks: processMocks.extractFactsFromChunks,
    },
  })),
}));

const TEST_NAME_PREFIX = "[test-import-batch-routes]";
const createdCampaignIds = new Set<string>();

function createUploadRequest(
  files: Array<{ name: string; type: string; content: string; size?: number }>,
  defaultSourceType = "official_module",
) {
  const uploads = files.map((file) => {
    const buffer = Buffer.from(file.content, "utf8");

    return {
      name: file.name,
      type: file.type,
      size: file.size ?? buffer.byteLength,
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
  });

  const formData = {
    get: (key: string) =>
      key === "defaultSourceType" ? defaultSourceType : null,
    getAll: (key: string) => (key === "files" ? uploads : []),
  };

  return {
    headers: {
      get: () => null,
    },
    formData: async () => formData,
  } as unknown as Request;
}

async function createCampaign() {
  const campaign = await db.campaign.create({
    data: {
      name: `${TEST_NAME_PREFIX} ${Date.now()}`,
      system: "5e",
      tone: "grim intrigue",
      partyLevel: 4,
    },
  });

  createdCampaignIds.add(campaign.id);
  return campaign;
}

async function deleteTestCampaigns() {
  const campaignIds = Array.from(createdCampaignIds);

  if (campaignIds.length === 0) {
    return;
  }

  await db.canonFact.deleteMany({
    where: {
      campaignId: {
        in: campaignIds,
      },
    },
  });
  await db.documentChunk.deleteMany({
    where: {
      campaignId: {
        in: campaignIds,
      },
    },
  });
  await db.sourceDocument.deleteMany({
    where: {
      campaignId: {
        in: campaignIds,
      },
    },
  });
  await db.importBatchFile.deleteMany({
    where: {
      campaignId: {
        in: campaignIds,
      },
    },
  });
  await db.importBatch.deleteMany({
    where: {
      campaignId: {
        in: campaignIds,
      },
    },
  });
  await db.campaign.deleteMany({
    where: {
      id: {
        in: campaignIds,
      },
    },
  });

  for (const campaignId of campaignIds) {
    rmSync(path.join(process.cwd(), "data", "imports", campaignId), {
      recursive: true,
      force: true,
    });
  }

  createdCampaignIds.clear();
}

describe("import batch routes", () => {
  beforeEach(async () => {
    await deleteTestCampaigns();
    processMocks.extractFactsFromChunks.mockReset();
  });

  afterEach(async () => {
    await deleteTestCampaigns();
  });

  it("creates a staged batch from multiple files and returns a confirmation summary payload", async () => {
    const campaign = await createCampaign();

    const response = await POST(
      createUploadRequest([
        {
          name: "chapter-1.txt",
          type: "text/plain",
          content: "Father Lucian keeps the relic hidden below the church.",
        },
        {
          name: "chapter-2.txt",
          type: "text/plain",
          content: "The burgomaster forbids travel after dusk.",
        },
      ]),
      {
        params: Promise.resolve({ campaignId: campaign.id }),
      },
    );

    expect(response.status).toBe(201);

    const payload = (await response.json()) as {
      batch: unknown;
      summary: {
        ready: boolean;
        stagedFileCount: number;
        failedFileCount: number;
        warningCount: number;
      };
    };

    const parsedBatch = importBatchSchema.parse(payload.batch);

    expect(parsedBatch).toMatchObject({
      campaignId: campaign.id,
      defaultSourceType: "official_module",
      files: [
        expect.objectContaining({
          originalName: "chapter-1.txt",
          sourceType: "official_module",
          status: "staged",
        }),
        expect.objectContaining({
          originalName: "chapter-2.txt",
          sourceType: "official_module",
          status: "staged",
        }),
      ],
    });
    expect(payload.summary).toMatchObject({
      ready: true,
      stagedFileCount: 2,
      failedFileCount: 0,
      warningCount: 0,
    });

    const getResponse = await GET(new Request("http://localhost"), {
      params: Promise.resolve({
        campaignId: campaign.id,
        batchId: parsedBatch.id!,
      }),
    });

    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      batch: expect.objectContaining({
        id: parsedBatch.id,
        files: expect.arrayContaining([
          expect.objectContaining({ originalName: "chapter-1.txt" }),
          expect.objectContaining({ originalName: "chapter-2.txt" }),
        ]),
      }),
      summary: expect.objectContaining({
        ready: true,
      }),
    });
  });

  it("updates the batch default source type and supports per-file overrides", async () => {
    const campaign = await createCampaign();
    const createResponse = await POST(
      createUploadRequest([
        {
          name: "chapter-1.txt",
          type: "text/plain",
          content: "The abbey cellar contains a sealed reliquary.",
        },
        {
          name: "session-log.txt",
          type: "text/plain",
          content: "The party learned the chapel bell rings before sunset.",
        },
      ]),
      {
        params: Promise.resolve({ campaignId: campaign.id }),
      },
    );

    const createdPayload = (await createResponse.json()) as {
      batch: {
        id: string;
        files: Array<{ id: string; originalName: string }>;
      };
    };

    const chapterFile = createdPayload.batch.files.find(
      (file) => file.originalName === "chapter-1.txt",
    );

    const patchResponse = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          defaultSourceType: "gm_notes",
          fileSourceTypes: [
            {
              fileId: chapterFile?.id,
              sourceType: "session_record",
            },
          ],
        }),
      }),
      {
        params: Promise.resolve({
          campaignId: campaign.id,
          batchId: createdPayload.batch.id,
        }),
      },
    );

    expect(patchResponse.status).toBe(200);

    const payload = (await patchResponse.json()) as {
      batch: {
        defaultSourceType: string;
        files: Array<{ originalName: string; sourceType: string }>;
      };
    };

    expect(payload.batch.defaultSourceType).toBe("gm_notes");
    expect(payload.batch.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          originalName: "chapter-1.txt",
          sourceType: "session_record",
        }),
        expect.objectContaining({
          originalName: "session-log.txt",
          sourceType: "gm_notes",
        }),
      ]),
    );

    const preserveOverrideResponse = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          defaultSourceType: "custom_reference",
        }),
      }),
      {
        params: Promise.resolve({
          campaignId: campaign.id,
          batchId: createdPayload.batch.id,
        }),
      },
    );

    expect(preserveOverrideResponse.status).toBe(200);
    await expect(preserveOverrideResponse.json()).resolves.toMatchObject({
      batch: {
        defaultSourceType: "custom_reference",
        files: expect.arrayContaining([
          expect.objectContaining({
            originalName: "chapter-1.txt",
            sourceType: "session_record",
          }),
          expect.objectContaining({
            originalName: "session-log.txt",
            sourceType: "custom_reference",
          }),
        ]),
      },
    });
  });

  it("removes staged files and updates the batch summary", async () => {
    const campaign = await createCampaign();
    const createResponse = await POST(
      createUploadRequest([
        {
          name: "chapter-1.txt",
          type: "text/plain",
          content: "The guard captain rotates watch posts at dusk.",
        },
        {
          name: "chapter-2.txt",
          type: "text/plain",
          content: "The western gate stays barred during heavy fog.",
        },
      ]),
      {
        params: Promise.resolve({ campaignId: campaign.id }),
      },
    );

    const createdPayload = (await createResponse.json()) as {
      batch: {
        id: string;
        files: Array<{ id: string; originalName: string; storedPath?: string }>;
      };
    };

    const fileToRemove = createdPayload.batch.files.find(
      (file) => file.originalName === "chapter-2.txt",
    );

    expect(fileToRemove?.storedPath).toBeTruthy();
    expect(
      existsSync(path.resolve(process.cwd(), fileToRemove!.storedPath!)),
    ).toBe(true);

    const patchResponse = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          removeFileIds: [fileToRemove?.id],
        }),
      }),
      {
        params: Promise.resolve({
          campaignId: campaign.id,
          batchId: createdPayload.batch.id,
        }),
      },
    );

    expect(patchResponse.status).toBe(200);
    await expect(patchResponse.json()).resolves.toMatchObject({
      batch: {
        files: [expect.objectContaining({ originalName: "chapter-1.txt" })],
      },
      summary: {
        ready: true,
        stagedFileCount: 1,
        failedFileCount: 0,
      },
    });

    expect(
      existsSync(path.resolve(process.cwd(), fileToRemove!.storedPath!)),
    ).toBe(false);
  });

  it("appends more staged files to an existing batch and inherits the current default source type", async () => {
    const campaign = await createCampaign();
    const createResponse = await POST(
      createUploadRequest([
        {
          name: "chapter-1.txt",
          type: "text/plain",
          content: "The abbey cellar hides the original relic ledger.",
        },
      ], "gm_notes"),
      {
        params: Promise.resolve({ campaignId: campaign.id }),
      },
    );

    const createdPayload = (await createResponse.json()) as {
      batch: { id: string };
    };

    const appendResponse = await PATCH(
      createUploadRequest([
        {
          name: "session-log.txt",
          type: "text/plain",
          content: "The party saw the sacristy lantern moving below the chapel.",
        },
      ], "gm_notes"),
      {
        params: Promise.resolve({
          campaignId: campaign.id,
          batchId: createdPayload.batch.id,
        }),
      },
    );

    expect(appendResponse.status).toBe(200);
    await expect(appendResponse.json()).resolves.toMatchObject({
      batch: {
        defaultSourceType: "gm_notes",
        files: expect.arrayContaining([
          expect.objectContaining({
            originalName: "chapter-1.txt",
            sourceType: "gm_notes",
          }),
          expect.objectContaining({
            originalName: "session-log.txt",
            sourceType: "gm_notes",
            status: "staged",
          }),
        ]),
      },
      summary: {
        ready: true,
        stagedFileCount: 2,
        failedFileCount: 0,
      },
    });
  });

  it("marks unsupported staged files as failed and keeps the readiness summary loud", async () => {
    const campaign = await createCampaign();

    const response = await POST(
      createUploadRequest([
        {
          name: "chapter-1.txt",
          type: "text/plain",
          content: "The chapel cellar has a false floor.",
        },
        {
          name: "unsupported.json",
          type: "application/json",
          content: '{"subject":"irrelevant"}',
        },
      ]),
      {
        params: Promise.resolve({ campaignId: campaign.id }),
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      batch: {
        files: expect.arrayContaining([
          expect.objectContaining({
            originalName: "chapter-1.txt",
            status: "staged",
          }),
          expect.objectContaining({
            originalName: "unsupported.json",
            status: "failed",
            errorCode: "unsupported_format",
          }),
        ]),
      },
      summary: {
        ready: false,
        stagedFileCount: 1,
        failedFileCount: 1,
      },
    });
  });

  it("rejects oversized uploads before staging them", async () => {
    const campaign = await createCampaign();

    const response = await POST(
      createUploadRequest([
        {
          name: "huge.txt",
          type: "text/plain",
          content: "Too large to stage",
          size: 10 * 1024 * 1024 + 1,
        },
      ]),
      {
        params: Promise.resolve({ campaignId: campaign.id }),
      },
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      errorCode: "uploadLimitExceeded",
      error: expect.stringContaining("upload limit"),
    });
  });

  it("processes a ready batch and returns the results route payload", async () => {
    processMocks.extractFactsFromChunks.mockImplementation(
      async ({
        campaignId,
        chunks,
      }: {
        campaignId: string;
        chunks: Array<{
          sourceDocumentId: string;
          documentChunkId?: string;
          chunkIndex: number;
          paragraphStartIndex: number;
          paragraphEndIndex: number;
          pageStart: number | null;
          pageEnd: number | null;
        }>;
      }) => [
        {
          campaignId,
          category: "npc",
          subject: "Father Lucian",
          summary: "Hides the relic evidence in the church cellar.",
          details: null,
          confidence: 0.91,
          sourceQuote: "Father Lucian hides the relic evidence in the church cellar.",
          sourceDocumentId: chunks[0]!.sourceDocumentId,
          documentChunkId: chunks[0]!.documentChunkId!,
          chunkIndex: chunks[0]!.chunkIndex,
          provenance: {
            sourceDocumentId: chunks[0]!.sourceDocumentId,
            documentChunkId: chunks[0]!.documentChunkId!,
            chunkIndex: chunks[0]!.chunkIndex,
            paragraphStartIndex: chunks[0]!.paragraphStartIndex,
            paragraphEndIndex: chunks[0]!.paragraphEndIndex,
            pageStart: chunks[0]!.pageStart,
            pageEnd: chunks[0]!.pageEnd,
            sourceQuote: "Father Lucian hides the relic evidence in the church cellar.",
          },
          sourceReferences: [],
        },
      ],
    );

    const campaign = await createCampaign();
    const createResponse = await POST(
      createUploadRequest([
        {
          name: "chapter-1.txt",
          type: "text/plain",
          content: "NPC: Father Lucian hides the relic evidence in the church cellar.",
        },
      ]),
      {
        params: Promise.resolve({ campaignId: campaign.id }),
      },
    );

    const createdPayload = (await createResponse.json()) as {
      batch: { id: string };
    };

    await db.campaign.update({
      where: { id: campaign.id },
      data: {
        llmProvider: "openai_chat",
        llmApiKey: "playwright-test-key",
      },
    });

    const processResponse = await PROCESS(new Request("http://localhost", {
      method: "POST",
    }), {
      params: Promise.resolve({
        campaignId: campaign.id,
        batchId: createdPayload.batch.id,
      }),
    });

    expect(processResponse.status).toBe(200);
    await expect(processResponse.json()).resolves.toMatchObject({
      resultsUrl: `/campaigns/${campaign.id}/imports/${createdPayload.batch.id}/results`,
      processing: {
        batchStatus: "completed",
        summary: {
          successCount: 1,
          failureCount: 0,
          candidateFactCount: 1,
        },
      },
      batch: {
        status: "completed",
      },
    });
  });
});
