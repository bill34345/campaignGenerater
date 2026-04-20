export type DocumentChunk = {
  chunkIndex: number;
  sourceDocumentId: string;
  pageStart: number | null;
  pageEnd: number | null;
  paragraphStartIndex: number;
  paragraphEndIndex: number;
  text: string;
  paragraphCount: number;
};

export type ChunkDocumentTextInput = {
  text: string;
  sourceDocumentId: string;
  pageStart?: number | null;
  pageEnd?: number | null;
  maxParagraphsPerChunk?: number;
  overlapParagraphs?: number;
};

function normalizeText(text: string) {
  return text.replace(/\r\n/g, "\n").trim();
}

function splitParagraphs(text: string) {
  return normalizeText(text)
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function chunkDocumentText(
  input: ChunkDocumentTextInput,
): DocumentChunk[] {
  const paragraphs = splitParagraphs(input.text);
  const maxParagraphsPerChunk = Math.max(
    1,
    input.maxParagraphsPerChunk ?? 4,
  );
  const overlapParagraphs = Math.max(0, input.overlapParagraphs ?? 0);
  const step = Math.max(1, maxParagraphsPerChunk - overlapParagraphs);
  const chunks: DocumentChunk[] = [];

  if (paragraphs.length === 0) {
    return chunks;
  }

  let chunkIndex = 0;

  for (let start = 0; start < paragraphs.length; start += step) {
    const end = Math.min(paragraphs.length, start + maxParagraphsPerChunk);
    const chunkParagraphs = paragraphs.slice(start, end);

    chunks.push({
      chunkIndex,
      sourceDocumentId: input.sourceDocumentId,
      pageStart: input.pageStart ?? null,
      pageEnd: input.pageEnd ?? input.pageStart ?? null,
      paragraphStartIndex: start,
      paragraphEndIndex: end,
      text: chunkParagraphs.join("\n\n"),
      paragraphCount: chunkParagraphs.length,
    });

    chunkIndex += 1;

    if (end >= paragraphs.length) {
      break;
    }
  }

  return chunks;
}
