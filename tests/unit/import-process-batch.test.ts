import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  processImportBatch,
} from "@/lib/imports/process-batch";

const mocks = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  importBatchFindFirst: vi.fn(),
  importBatchUpdate: vi.fn(),
  importBatchFileUpdate: vi.fn(),
  sourceDocumentCreate: vi.fn(),
  sourceDocumentUpdate: vi.fn(),
  documentChunkCreate: vi.fn(),
  canonFactCreate: vi.fn(),
  readFile: vi.fn(),
  extractTextFromBuffer: vi.fn(),
  resolveLlmProvider: vi.fn(),
  extractFactsFromChunks: vi.fn(),
}));

function createDependencies() {
  return {
    db: {
      campaign: {
        findUnique: mocks.campaignFindUnique,
      },
      importBatch: {
        findFirst: mocks.importBatchFindFirst,
        update: mocks.importBatchUpdate,
      },
      importBatchFile: {
        update: mocks.importBatchFileUpdate,
      },
      sourceDocument: {
        create: mocks.sourceDocumentCreate,
        update: mocks.sourceDocumentUpdate,
      },
      documentChunk: {
        create: mocks.documentChunkCreate,
      },
      canonFact: {
        create: mocks.canonFactCreate,
      },
    },
    readFile: mocks.readFile,
    extractTextFromBuffer: mocks.extractTextFromBuffer,
    resolveLlmProvider: mocks.resolveLlmProvider,
  };
}

describe("processImportBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.campaignFindUnique.mockResolvedValue({
      id: "camp_1",
      llmProvider: "openai_chat",
      llmApiKey: "test-key",
      llmModel: null,
      llmBaseUrl: null,
    });
    mocks.importBatchFindFirst.mockResolvedValue({
      id: "batch_1",
      campaignId: "camp_1",
      status: "ready",
      defaultSourceType: "official_module",
      files: [
        {
          id: "file_1",
          importBatchId: "batch_1",
          campaignId: "camp_1",
          originalName: "chapter-1.txt",
          storedPath: "data/imports/camp_1/batch_1/chapter-1.txt",
          mimeType: "text/plain",
          checksum: "abc123",
          sizeBytes: 64,
          sourceType: "official_module",
          status: "staged",
          errorCode: null,
          errorMessage: null,
        },
      ],
    });
    mocks.resolveLlmProvider.mockReturnValue({
      config: {
        llmProvider: "openai_chat",
        llmApiKey: "test-key",
        llmModel: null,
        llmBaseUrl: null,
      },
      adapter: {
        extractFactsFromChunks: mocks.extractFactsFromChunks,
      },
    });
    mocks.readFile.mockResolvedValue(Buffer.from("NPC: Father Lucian guards the relic."));
    mocks.extractTextFromBuffer.mockResolvedValue({
      text: "NPC: Father Lucian guards the relic.",
      pageCount: null,
    });
    mocks.sourceDocumentCreate.mockResolvedValue({
      id: "doc_1",
    });
    mocks.documentChunkCreate.mockImplementation(
      async ({ data }: { data: { chunkIndex: number } }) => ({
        id: `chunk_${data.chunkIndex}`,
        chunkIndex: data.chunkIndex,
      }),
    );
    mocks.canonFactCreate.mockResolvedValue({ id: "fact_1" });
  });

  it("creates source documents, chunks, and candidate facts while preserving batch metadata", async () => {
    mocks.extractFactsFromChunks.mockResolvedValue([
      {
        campaignId: "camp_1",
        category: "npc",
        subject: "Father Lucian",
        summary: "Guards the relic.",
        details: null,
        confidence: 0.92,
        sourceQuote: "Father Lucian guards the relic.",
        sourceDocumentId: "doc_1",
        documentChunkId: "chunk_0",
        chunkIndex: 0,
        provenance: {
          sourceDocumentId: "doc_1",
          documentChunkId: "chunk_0",
          chunkIndex: 0,
          paragraphStartIndex: 0,
          paragraphEndIndex: 1,
          pageStart: 1,
          pageEnd: 1,
          sourceQuote: "Father Lucian guards the relic.",
        },
        sourceReferences: [],
      },
    ]);

    const result = await processImportBatch({
      campaignId: "camp_1",
      batchId: "batch_1",
      dependencies: createDependencies(),
    });

    expect(mocks.sourceDocumentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "camp_1",
        importBatchId: "batch_1",
        originalName: "chapter-1.txt",
        sourceType: "official_module",
        processingStatus: "processing",
      }),
    });
    expect(mocks.canonFactCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "camp_1",
        sourceDocumentId: "doc_1",
        subject: "Father Lucian",
        factType: "npc-role",
        status: "uncertain",
      }),
    });
    expect(result).toMatchObject({
      batchId: "batch_1",
      batchStatus: "completed",
      summary: {
        successCount: 1,
        failureCount: 0,
        candidateFactCount: 1,
        conflictCount: 0,
      },
    });
  });

  it("marks files and source documents as failed when provider extraction errors", async () => {
    mocks.extractFactsFromChunks.mockRejectedValueOnce(new Error("provider down"));

    const result = await processImportBatch({
      campaignId: "camp_1",
      batchId: "batch_1",
      dependencies: createDependencies(),
    });

    expect(mocks.sourceDocumentUpdate).toHaveBeenCalledWith({
      where: { id: "doc_1" },
      data: {
        processingStatus: "failed",
        extractionError: "provider down",
      },
    });
    expect(mocks.importBatchFileUpdate).toHaveBeenCalledWith({
      where: { id: "file_1" },
      data: {
        status: "failed",
        errorCode: "llmExtractionFailed",
        errorMessage: "provider down",
      },
    });
    expect(result).toMatchObject({
      batchStatus: "failed",
      summary: {
        successCount: 0,
        failureCount: 1,
        candidateFactCount: 0,
      },
    });
  });

  it("summarizes partial failures and conflict-heavy fact groups", async () => {
    mocks.importBatchFindFirst.mockResolvedValueOnce({
      id: "batch_1",
      campaignId: "camp_1",
      status: "ready",
      defaultSourceType: "official_module",
      files: [
        {
          id: "file_1",
          importBatchId: "batch_1",
          campaignId: "camp_1",
          originalName: "chapter-1.txt",
          storedPath: "data/imports/camp_1/batch_1/chapter-1.txt",
          mimeType: "text/plain",
          checksum: "abc123",
          sizeBytes: 64,
          sourceType: "official_module",
          status: "staged",
          errorCode: null,
          errorMessage: null,
        },
        {
          id: "file_2",
          importBatchId: "batch_1",
          campaignId: "camp_1",
          originalName: "chapter-2.txt",
          storedPath: "data/imports/camp_1/batch_1/chapter-2.txt",
          mimeType: "text/plain",
          checksum: "def456",
          sizeBytes: 64,
          sourceType: "official_module",
          status: "staged",
          errorCode: null,
          errorMessage: null,
        },
      ],
    });
    mocks.sourceDocumentCreate
      .mockResolvedValueOnce({ id: "doc_1" })
      .mockResolvedValueOnce({ id: "doc_2" });
    mocks.extractTextFromBuffer
      .mockResolvedValueOnce({
        text: "NPC: Father Lucian guards the relic.",
        pageCount: null,
      })
      .mockRejectedValueOnce(
        Object.assign(new Error("parse failed"), {
          name: "DocumentParseError",
          status: 400,
        }),
      );
    mocks.extractFactsFromChunks.mockResolvedValueOnce([
      {
        campaignId: "camp_1",
        category: "npc",
        subject: "Father Lucian",
        summary: "Guards the relic.",
        details: null,
        confidence: 0.92,
        sourceQuote: "Father Lucian guards the relic.",
        sourceDocumentId: "doc_1",
        documentChunkId: "chunk_0",
        chunkIndex: 0,
        provenance: {
          sourceDocumentId: "doc_1",
          documentChunkId: "chunk_0",
          chunkIndex: 0,
          paragraphStartIndex: 0,
          paragraphEndIndex: 1,
          pageStart: 1,
          pageEnd: 1,
          sourceQuote: "Father Lucian guards the relic.",
        },
        sourceReferences: [],
      },
      {
        campaignId: "camp_1",
        category: "npc",
        subject: "Father Lucian",
        summary: "Hides the relic ledger.",
        details: null,
        confidence: 0.81,
        sourceQuote: "Father Lucian hides the relic ledger.",
        sourceDocumentId: "doc_1",
        documentChunkId: "chunk_0",
        chunkIndex: 0,
        provenance: {
          sourceDocumentId: "doc_1",
          documentChunkId: "chunk_0",
          chunkIndex: 0,
          paragraphStartIndex: 0,
          paragraphEndIndex: 1,
          pageStart: 1,
          pageEnd: 1,
          sourceQuote: "Father Lucian hides the relic ledger.",
        },
        sourceReferences: [],
      },
    ]);

    const result = await processImportBatch({
      campaignId: "camp_1",
      batchId: "batch_1",
      dependencies: createDependencies(),
    });

    expect(result).toMatchObject({
      batchStatus: "completed",
      summary: {
        successCount: 1,
        failureCount: 1,
        candidateFactCount: 2,
        conflictCount: 1,
        conflictSubjects: ["Father Lucian"],
      },
    });
  });

  it("requires configured llm settings before extraction starts", async () => {
    mocks.campaignFindUnique.mockResolvedValueOnce({
      id: "camp_1",
      llmProvider: "openai_chat",
      llmApiKey: null,
      llmModel: null,
      llmBaseUrl: null,
    });
    mocks.resolveLlmProvider.mockReturnValueOnce({
      config: {
        llmProvider: "openai_chat",
        llmApiKey: null,
        llmModel: null,
        llmBaseUrl: null,
      },
      adapter: {
        extractFactsFromChunks: mocks.extractFactsFromChunks,
      },
    });

    await expect(
      processImportBatch({
        campaignId: "camp_1",
        batchId: "batch_1",
        dependencies: createDependencies(),
      }),
    ).rejects.toMatchObject({
      errorCode: "llmSettingsRequired",
      status: 400,
    });
  });
});
