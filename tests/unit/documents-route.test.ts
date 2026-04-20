import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  documentChunkCreate: vi.fn(),
  canonFactCreate: vi.fn(),
  saveCampaignUpload: vi.fn(),
  removeCampaignUpload: vi.fn(),
  extractTextFromBuffer: vi.fn(),
  resolveLlmProvider: vi.fn(),
  extractFactsFromChunks: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    campaign: {
      findUnique: mocks.findUnique,
    },
    sourceDocument: {
      create: mocks.create,
    },
    documentChunk: {
      create: mocks.documentChunkCreate,
    },
    canonFact: {
      create: mocks.canonFactCreate,
    },
  },
}));

vi.mock("@/lib/files/storage", () => ({
  saveCampaignUpload: mocks.saveCampaignUpload,
  removeCampaignUpload: mocks.removeCampaignUpload,
}));

vi.mock("@/lib/files/extract-text", () => ({
  detectFileFormat: (fileName: string) =>
    fileName.endsWith(".txt") ? "txt" : null,
  extractTextFromBuffer: mocks.extractTextFromBuffer,
  isDocumentParseError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === "object" &&
        "name" in error &&
        (error as { name?: string }).name === "DocumentParseError",
    ),
}));

vi.mock("@/lib/llm/fallback-facts", () => ({
  extractFallbackFactsFromChunks: vi.fn(() => []),
  toFactType: vi.fn((category: string) => category),
}));

vi.mock("@/lib/llm/provider-resolver", () => ({
  resolveLlmProvider: mocks.resolveLlmProvider,
}));

import { POST } from "@/app/api/campaigns/[campaignId]/documents/route";

describe("campaign documents route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      id: "camp_1",
      llmProvider: "openai_chat",
      llmApiKey: "test-key",
      llmModel: null,
      llmBaseUrl: null,
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
    mocks.extractTextFromBuffer.mockResolvedValue({
      text: "Town note: The old bell tower is sealed at dusk.",
      pageCount: null,
    });
    mocks.extractFactsFromChunks.mockResolvedValue([]);
    mocks.create.mockResolvedValue({
      id: "doc_1",
      campaignId: "camp_1",
      originalName: "sample-note.txt",
      storedPath: "data/uploads/camp_1/sample-note.txt",
      mimeType: "text/plain",
      checksum: "abc123",
      extractedText: "Town note: The old bell tower is sealed at dusk.",
      pageCount: null,
      createdAt: new Date("2026-04-09T00:00:00.000Z"),
    });
    mocks.documentChunkCreate.mockImplementation(
      async ({ data }: { data: { chunkIndex: number } }) => ({
        id: `chunk_${data.chunkIndex}`,
        chunkIndex: data.chunkIndex,
      }),
    );
    mocks.canonFactCreate.mockResolvedValue({
      id: "fact_1",
    });
    mocks.saveCampaignUpload.mockResolvedValue({
      originalName: "sample-note.txt",
      storedPath: "data/uploads/camp_1/sample-note.txt",
      absolutePath: "C:/temp/data/uploads/camp_1/sample-note.txt",
      checksum: "abc123",
      mimeType: "text/plain",
      size: 48,
    });
  });

  it("accepts a multipart txt upload and creates a source document", async () => {
    const buffer = readFileSync(
      path.join(process.cwd(), "tests", "fixtures", "sample-note.txt"),
    );
    const file = {
      name: "sample-note.txt",
      type: "text/plain",
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };

    const request = {
      formData: async () => ({
        get: () => file,
      }),
    } as unknown as Request;

    const response = await POST(request, {
      params: Promise.resolve({ campaignId: "camp_1" }),
    });

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: "camp_1",
          originalName: "sample-note.txt",
          storedPath: "data/uploads/camp_1/sample-note.txt",
          extractedText: expect.stringContaining("Town note"),
        }),
      }),
    );
    expect(mocks.extractFactsFromChunks).toHaveBeenCalledTimes(1);
  });

  it("cleans up the uploaded file when document creation fails", async () => {
    const buffer = readFileSync(
      path.join(process.cwd(), "tests", "fixtures", "sample-note.txt"),
    );
    const file = {
      name: "sample-note.txt",
      type: "text/plain",
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };

    mocks.create.mockRejectedValueOnce(new Error("db failed"));

    const request = {
      formData: async () => ({
        get: () => file,
      }),
    } as unknown as Request;

    await expect(
      POST(request, {
        params: Promise.resolve({ campaignId: "camp_1" }),
      }),
    ).rejects.toThrow("db failed");

    expect(mocks.removeCampaignUpload).toHaveBeenCalledWith(
      "C:/temp/data/uploads/camp_1/sample-note.txt",
    );
  });

  it("returns a 400 and cleans up when extraction fails", async () => {
    const buffer = readFileSync(
      path.join(process.cwd(), "tests", "fixtures", "sample-note.txt"),
    );
    const file = {
      name: "sample-note.txt",
      type: "text/plain",
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };

    mocks.extractTextFromBuffer.mockRejectedValueOnce(
      Object.assign(new Error("parse failed"), {
        name: "DocumentParseError",
        status: 400,
      }),
    );

    const request = {
      formData: async () => ({
        get: () => file,
      }),
    } as unknown as Request;

    const response = await POST(request, {
      params: Promise.resolve({ campaignId: "camp_1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "parse failed",
    });

    expect(mocks.removeCampaignUpload).toHaveBeenCalledWith(
      "C:/temp/data/uploads/camp_1/sample-note.txt",
    );
  });

  it("rejects oversized uploads before buffering", async () => {
    const formData = vi.fn();

    const request = {
      headers: {
        get: (name: string) =>
          name === "content-length"
            ? String(10 * 1024 * 1024 + 1024 * 1024 + 1)
            : null,
      },
      formData,
    } as unknown as Request;

    const response = await POST(request, {
      params: Promise.resolve({ campaignId: "camp_1" }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("upload limit"),
    });
    expect(formData).not.toHaveBeenCalled();
    expect(mocks.saveCampaignUpload).not.toHaveBeenCalled();
    expect(mocks.extractTextFromBuffer).not.toHaveBeenCalled();
  });

  it("allows modest multipart overhead to reach parsing", async () => {
    const buffer = readFileSync(
      path.join(process.cwd(), "tests", "fixtures", "sample-note.txt"),
    );
    const file = {
      name: "sample-note.txt",
      type: "text/plain",
      size: 10 * 1024 * 1024,
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
    const formData = vi.fn().mockResolvedValue({
      get: () => file,
    });

    const request = {
      headers: {
        get: (name: string) =>
          name === "content-length"
            ? String(10 * 1024 * 1024 + 256 * 1024)
            : null,
      },
      formData,
    } as unknown as Request;

    const response = await POST(request, {
      params: Promise.resolve({ campaignId: "camp_1" }),
    });

    expect(response.status).toBe(201);
    expect(formData).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized uploads after parsing file metadata", async () => {
    const arrayBuffer = vi.fn();
    const file = {
      name: "huge.txt",
      type: "text/plain",
      size: 10 * 1024 * 1024 + 1,
      arrayBuffer,
    };

    const request = {
      headers: {
        get: () => null,
      },
      formData: async () => ({
        get: () => file,
      }),
    } as unknown as Request;

    const response = await POST(request, {
      params: Promise.resolve({ campaignId: "camp_1" }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("upload limit"),
    });
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(mocks.saveCampaignUpload).not.toHaveBeenCalled();
    expect(mocks.extractTextFromBuffer).not.toHaveBeenCalled();
  });

  it("returns a 400 when multipart parsing fails", async () => {
    const formData = vi.fn().mockRejectedValue(new Error("bad multipart"));

    const request = {
      headers: {
        get: () => null,
      },
      formData,
    } as unknown as Request;

    const response = await POST(request, {
      params: Promise.resolve({ campaignId: "camp_1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid multipart upload.",
    });
    expect(mocks.saveCampaignUpload).not.toHaveBeenCalled();
    expect(mocks.extractTextFromBuffer).not.toHaveBeenCalled();
  });

  it("returns a configuration error when llm settings are missing", async () => {
    const buffer = readFileSync(
      path.join(process.cwd(), "tests", "fixtures", "sample-note.txt"),
    );
    const file = {
      name: "sample-note.txt",
      type: "text/plain",
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };

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

    const request = {
      formData: async () => ({
        get: () => file,
      }),
      headers: {
        get: () => null,
      },
    } as unknown as Request;

    const response = await POST(request, {
      params: Promise.resolve({ campaignId: "camp_1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      errorCode: "llmSettingsRequired",
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("surfaces provider extraction failures instead of silently downgrading", async () => {
    const buffer = readFileSync(
      path.join(process.cwd(), "tests", "fixtures", "sample-note.txt"),
    );
    const file = {
      name: "sample-note.txt",
      type: "text/plain",
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };

    mocks.extractFactsFromChunks.mockRejectedValueOnce(new Error("provider down"));

    const request = {
      formData: async () => ({
        get: () => file,
      }),
      headers: {
        get: () => null,
      },
    } as unknown as Request;

    const response = await POST(request, {
      params: Promise.resolve({ campaignId: "camp_1" }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      errorCode: "llmExtractionFailed",
      error: "provider down",
    });
  });
});
