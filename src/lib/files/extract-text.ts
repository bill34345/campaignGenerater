import path from "node:path";
import { extractTextFromDocx } from "@/lib/files/docx";
import { extractTextFromPdf } from "@/lib/files/pdf";

export type FileExtractionFormat = "txt" | "md" | "pdf" | "docx";

export type ExtractedTextResult = {
  text: string;
  pageCount: number | null;
};

export class DocumentParseError extends Error {
  readonly status = 400;
  readonly format: FileExtractionFormat;

  constructor(format: FileExtractionFormat, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "DocumentParseError";
    this.format = format;
  }
}

export function isDocumentParseError(error: unknown): error is DocumentParseError {
  return (
    error instanceof Error &&
    error.name === "DocumentParseError" &&
    "status" in error
  );
}

function normalizeText(text: string) {
  return text.replace(/\r\n/g, "\n").trimEnd();
}

export function detectFileFormat(
  fileName: string,
  mimeType?: string | null,
): FileExtractionFormat | null {
  const extension = path.extname(fileName).toLowerCase().replace(/^\./, "");

  if (extension === "txt" || extension === "md" || extension === "pdf" || extension === "docx") {
    return extension;
  }

  const normalizedMimeType = mimeType?.toLowerCase() ?? "";
  if (normalizedMimeType === "text/plain") {
    return "txt";
  }
  if (normalizedMimeType === "text/markdown") {
    return "md";
  }
  if (normalizedMimeType === "application/pdf") {
    return "pdf";
  }
  if (
    normalizedMimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }

  return null;
}

export async function extractTextFromBuffer(
  format: FileExtractionFormat,
  buffer: Buffer,
): Promise<ExtractedTextResult> {
  switch (format) {
    case "txt":
    case "md":
      return {
        text: normalizeText(buffer.toString("utf8")),
        pageCount: null,
      };
    case "pdf":
      return extractTextFromPdf(buffer);
    case "docx":
      return extractTextFromDocx(buffer);
    default: {
      const exhaustiveCheck: never = format;
      throw new Error(`Unsupported file format: ${String(exhaustiveCheck)}`);
    }
  }
}
