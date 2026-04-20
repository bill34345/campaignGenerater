export type DocxExtractionResult = {
  text: string;
  pageCount: number | null;
};

import { DocumentParseError } from "@/lib/files/extract-text";

export async function extractTextFromDocx(
  buffer: Buffer,
): Promise<DocxExtractionResult> {
  const mammothModule = await import("mammoth");
  const mammoth = (mammothModule as { default?: unknown }).default ?? mammothModule;
  try {
    const result = await (mammoth as {
      extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
    }).extractRawText({ buffer });

    return {
      text: result.value.trimEnd(),
      pageCount: null,
    };
  } catch (error) {
    throw new DocumentParseError(
      "docx",
      "Failed to parse DOCX upload",
      error,
    );
  }
}
