import { readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { extractTextFromBuffer } from "@/lib/files/extract-text";
import { saveCampaignUpload } from "@/lib/files/storage";

describe("file extraction", () => {
  it("extracts plain text from txt uploads", async () => {
    const buffer = readFileSync(
      path.join(process.cwd(), "tests", "fixtures", "sample-note.txt"),
    );

    const result = await extractTextFromBuffer("txt", buffer);

    expect(result.text).toContain("Town note");
  });

  it("stores uploads under the campaign directory with a checksum", async () => {
    const buffer = readFileSync(
      path.join(process.cwd(), "tests", "fixtures", "sample-note.txt"),
    );
    const rootDir = path.join(os.tmpdir(), `uploads-${Date.now()}`);

    try {
      const result = await saveCampaignUpload({
        campaignId: "camp_1",
        fileName: "sample-note.txt",
        mimeType: "text/plain",
        buffer,
        rootDir,
      });

      expect(result.storedPath).toContain(
        "data/uploads/camp_1",
      );
      expect(result.checksum).toHaveLength(64);
      expect(result.absolutePath.startsWith(rootDir)).toBe(true);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("extracts plain text from docx uploads", async () => {
    const buffer = readFileSync(
      path.join(process.cwd(), "tests", "fixtures", "sample-note.docx"),
    );

    const result = await extractTextFromBuffer("docx", buffer);

    expect(result.text).toContain("bell tower");
  });

  it("extracts plain text from pdf uploads through PDFParse", async () => {
    await vi.resetModules();

    const getText = vi.fn().mockResolvedValue({
      text: "Town note from PDF",
      total: 4,
    });
    const destroy = vi.fn().mockResolvedValue(undefined);
    const pdfParseSpy = vi.fn().mockImplementation(() => ({
      getText,
      destroy,
    }));

    vi.doMock("pdf-parse", () => ({
      PDFParse: pdfParseSpy,
    }));

    const { extractTextFromPdf } = await import("@/lib/files/pdf");
    const result = await extractTextFromPdf(Buffer.from("%PDF-1.4"));

    expect(pdfParseSpy).toHaveBeenCalledWith({ data: Buffer.from("%PDF-1.4") });
    expect(getText).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(result.text).toContain("Town note from PDF");
    expect(result.pageCount).toBe(4);
  });

  it("wraps PDF parse failures as client document errors", async () => {
    await vi.resetModules();

    const getText = vi.fn().mockRejectedValue(new Error("bad pdf"));
    const destroy = vi.fn().mockResolvedValue(undefined);
    const pdfParseSpy = vi.fn().mockImplementation(() => ({
      getText,
      destroy,
    }));

    vi.doMock("pdf-parse", () => ({
      PDFParse: pdfParseSpy,
    }));

    const { DocumentParseError } = await import("@/lib/files/extract-text");
    const { extractTextFromPdf } = await import("@/lib/files/pdf");

    try {
      await extractTextFromPdf(Buffer.from("%PDF-1.4"));
      throw new Error("Expected PDF parse to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentParseError);
      expect(error).toMatchObject({
        name: "DocumentParseError",
        status: 400,
        format: "pdf",
      });
      expect((error as Error & { cause?: unknown }).cause).toBeInstanceOf(Error);
      expect(
        (error as Error & { cause?: Error }).cause?.message,
      ).toBe("bad pdf");
    }
  });

  it("destroys the PDF parser when extraction fails", async () => {
    await vi.resetModules();

    const getText = vi.fn().mockRejectedValue(new Error("bad pdf"));
    const destroy = vi.fn().mockResolvedValue(undefined);
    const pdfParseSpy = vi.fn().mockImplementation(() => ({
      getText,
      destroy,
    }));

    vi.doMock("pdf-parse", () => ({
      PDFParse: pdfParseSpy,
    }));

    const { DocumentParseError } = await import("@/lib/files/extract-text");
    const { extractTextFromPdf } = await import("@/lib/files/pdf");

    try {
      await extractTextFromPdf(Buffer.from("%PDF-1.4"));
      throw new Error("Expected PDF parse to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentParseError);
      expect(error).toMatchObject({
        name: "DocumentParseError",
        status: 400,
        format: "pdf",
      });
    }

    expect(getText).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("preserves the parse error when PDF parser cleanup fails", async () => {
    await vi.resetModules();

    const getText = vi.fn().mockRejectedValue(new Error("bad pdf"));
    const destroy = vi.fn().mockRejectedValue(new Error("cleanup failed"));
    const pdfParseSpy = vi.fn().mockImplementation(() => ({
      getText,
      destroy,
    }));

    vi.doMock("pdf-parse", () => ({
      PDFParse: pdfParseSpy,
    }));

    const { DocumentParseError } = await import("@/lib/files/extract-text");
    const { extractTextFromPdf } = await import("@/lib/files/pdf");

    try {
      await extractTextFromPdf(Buffer.from("%PDF-1.4"));
      throw new Error("Expected PDF parse to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentParseError);
      expect(error).toMatchObject({
        name: "DocumentParseError",
        status: 400,
        format: "pdf",
      });
      expect((error as Error & { cause?: unknown }).cause).toBeInstanceOf(Error);
      expect(
        (error as Error & { cause?: Error }).cause?.message,
      ).toBe("bad pdf");
    }

    expect(getText).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("wraps DOCX parse failures as client document errors", async () => {
    await vi.resetModules();

    const extractRawText = vi.fn().mockRejectedValue(new Error("bad docx"));
    vi.doMock("mammoth", () => ({
      default: {
        extractRawText,
      },
    }));

    const { DocumentParseError } = await import("@/lib/files/extract-text");
    const { extractTextFromDocx } = await import("@/lib/files/docx");

    await expect(
      extractTextFromDocx(Buffer.from("broken")),
    ).rejects.toBeInstanceOf(DocumentParseError);
    await expect(
      extractTextFromDocx(Buffer.from("broken")),
    ).rejects.toMatchObject({
      name: "DocumentParseError",
      status: 400,
      format: "docx",
    });
  });
});
