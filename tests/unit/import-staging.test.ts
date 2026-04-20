import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  importBatchFileSchema,
  importBatchSchema,
} from "@/types/domain";
import { SOURCE_TYPES } from "@/lib/imports/source-type";
import {
  attachDuplicateWarnings,
  detectDuplicateStagedFiles,
  saveStagedImportFiles,
  summarizeImportBatchReadiness,
} from "@/lib/imports/staging";

describe("import staging schemas", () => {
  it("parses the minimal staged import batch shape from the plan", () => {
    const parsed = importBatchSchema.safeParse({
      id: "batch_1",
      campaignId: "cmp_1",
      status: "staged",
      defaultSourceType: "official_module",
      files: [
        {
          id: "file_1",
          originalName: "chapter-1.pdf",
          sourceType: "official_module",
          status: "staged",
        },
      ],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw parsed.error;
    }

    expect(parsed.data.files[0]).toMatchObject({
      id: "file_1",
      originalName: "chapter-1.pdf",
      sourceType: "official_module",
      status: "staged",
    });
  });

  it("parses a fully populated staged import batch with stored file metadata", () => {
    const parsed = importBatchSchema.safeParse({
      id: "batch_1",
      campaignId: "cmp_1",
      status: "staged",
      defaultSourceType: "official_module",
      startedAt: null,
      completedAt: null,
      createdAt: new Date("2026-04-20T00:00:00.000Z"),
      updatedAt: new Date("2026-04-20T00:00:00.000Z"),
      files: [
        {
          id: "file_1",
          importBatchId: "batch_1",
          campaignId: "cmp_1",
          originalName: "chapter-1.pdf",
          storedPath: "data/imports/batch_1/chapter-1.pdf",
          mimeType: "application/pdf",
          checksum: "sha256:abc123",
          sizeBytes: 1024,
          sourceType: "official_module",
          status: "staged",
          errorCode: null,
          errorMessage: null,
          createdAt: new Date("2026-04-20T00:00:00.000Z"),
          updatedAt: new Date("2026-04-20T00:00:00.000Z"),
        },
      ],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw parsed.error;
    }

    expect(parsed.data.files).toHaveLength(1);
    expect(parsed.data.files[0]?.sourceType).toBe("official_module");
  });

  it("parses an import batch file with explicit file-level errors", () => {
    const parsed = importBatchFileSchema.safeParse({
      id: "file_2",
      importBatchId: "batch_1",
      campaignId: "cmp_1",
      originalName: "notes.docx",
      storedPath: "data/imports/batch_1/notes.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      checksum: "sha256:def456",
      sizeBytes: 2048,
      sourceType: "gm_notes",
      status: "failed",
      errorCode: "unsupported_format",
      errorMessage: "The uploaded file format is not supported.",
      createdAt: new Date("2026-04-20T00:00:00.000Z"),
      updatedAt: new Date("2026-04-20T00:00:00.000Z"),
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects nested files whose parent identity does not match the batch", () => {
    const parsed = importBatchSchema.safeParse({
      id: "batch_1",
      campaignId: "cmp_1",
      defaultSourceType: "official_module",
      files: [
        {
          id: "file_1",
          importBatchId: "batch_other",
          campaignId: "cmp_2",
          originalName: "chapter-1.pdf",
          sourceType: "official_module",
          status: "staged",
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("exposes the supported import source types", () => {
    expect(SOURCE_TYPES).toEqual([
      "official_module",
      "gm_notes",
      "session_record",
      "custom_reference",
    ]);
  });

  it("inherits the batch default source type when a file has no override", async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "import-staging-"));

    try {
      const [file] = await saveStagedImportFiles({
        batchId: "batch_1",
        campaignId: "cmp_1",
        defaultSourceType: "gm_notes",
        rootDir,
        files: [
          {
            fileName: "chapter-1.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("Town note"),
          },
        ],
      });

      expect(file.sourceType).toBe("gm_notes");
      expect(file.status).toBe("staged");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("uses a per-file source type override instead of the batch default", async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "import-staging-"));

    try {
      const [file] = await saveStagedImportFiles({
        batchId: "batch_1",
        campaignId: "cmp_1",
        defaultSourceType: "official_module",
        rootDir,
        files: [
          {
            fileName: "session-log.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("Session recap"),
            sourceType: "session_record",
          },
        ],
      });

      expect(file.sourceType).toBe("session_record");
      expect(file.status).toBe("staged");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("detects checksum duplicates and reports them in readiness warnings", async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "import-staging-"));

    try {
      const files = await saveStagedImportFiles({
        batchId: "batch_1",
        campaignId: "cmp_1",
        defaultSourceType: "official_module",
        rootDir,
        files: [
          {
            fileName: "chapter-1.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("Same content"),
          },
          {
            fileName: "chapter-1-copy.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("Same content"),
          },
        ],
      });

      const duplicates = detectDuplicateStagedFiles(files);
      const summary = summarizeImportBatchReadiness(files);

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0]?.fileNames).toEqual([
        "chapter-1.txt",
        "chapter-1-copy.txt",
      ]);
      expect(summary.warningCount).toBe(1);
      expect(summary.duplicateChecksums).toHaveLength(1);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("does not assign duplicate warnings by filename alone", () => {
    const files = [
      {
        id: "a",
        originalName: "notes.md",
        checksum: "dup",
        status: "staged" as const,
      },
      {
        id: "b",
        originalName: "notes.md",
        checksum: "unique",
        status: "staged" as const,
      },
      {
        id: "c",
        originalName: "other.md",
        checksum: "dup",
        status: "staged" as const,
      },
    ];

    const withWarnings = attachDuplicateWarnings(files);

    expect(withWarnings.find((file) => file.id === "a")?.warnings).toHaveLength(1);
    expect(withWarnings.find((file) => file.id === "c")?.warnings).toHaveLength(1);
    expect(withWarnings.find((file) => file.id === "b")?.warnings).toHaveLength(0);
  });

  it("rejects unsupported files before staging them for processing", async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "import-staging-"));

    try {
      const [file] = await saveStagedImportFiles({
        batchId: "batch_1",
        campaignId: "cmp_1",
        defaultSourceType: "custom_reference",
        rootDir,
        files: [
          {
            fileName: "unsupported.json",
            mimeType: "application/json",
            buffer: Buffer.from('{"name":"fixture"}'),
          },
        ],
      });

      expect(file.status).toBe("failed");
      expect(file.errorCode).toBe("unsupported_format");
      expect(file.storedPath).toBeUndefined();
      expect(existsSync(path.join(rootDir, "data", "imports"))).toBe(false);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
