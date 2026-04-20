import { describe, expect, it } from "vitest";
import { chunkDocumentText } from "@/lib/files/chunk";

describe("chunking", () => {
  it("preserves source metadata and overlaps paragraph boundaries", () => {
    const chunks = chunkDocumentText({
      text: [
        "Section A",
        "One.",
        "Section B",
        "Two.",
        "Section C",
      ].join("\n\n"),
      sourceDocumentId: "src_1",
      pageStart: 1,
      maxParagraphsPerChunk: 2,
      overlapParagraphs: 1,
    });

    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toMatchObject({
      sourceDocumentId: "src_1",
      pageStart: 1,
      paragraphStartIndex: 0,
      paragraphEndIndex: 2,
    });
    expect(chunks[1]).toMatchObject({
      sourceDocumentId: "src_1",
      paragraphStartIndex: 1,
      paragraphEndIndex: 3,
    });
    expect(chunks[1]?.text).toContain("One.");
    expect(chunks[3]?.text).toContain("Section C");
    expect(chunks[3]?.sourceDocumentId).toBe("src_1");
  });
});
