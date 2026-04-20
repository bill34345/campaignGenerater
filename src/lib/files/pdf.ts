export type PdfExtractionResult = {
  text: string;
  pageCount: number | null;
};

import { DocumentParseError } from "@/lib/files/extract-text";

export async function extractTextFromPdf(
  buffer: Buffer,
): Promise<PdfExtractionResult> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  let primaryError: unknown;

  try {
    const parsed = await parser.getText();

    return {
      text: parsed.text.trimEnd(),
      pageCount: parsed.total ?? null,
    };
  } catch (error) {
    primaryError = error;
    throw new DocumentParseError(
      "pdf",
      "Failed to parse PDF upload",
      error,
    );
  } finally {
    try {
      await parser.destroy();
    } catch (cleanupError) {
      if (!primaryError) {
        throw cleanupError;
      }
    }
  }
}
