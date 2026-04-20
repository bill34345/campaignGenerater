import { describe, expect, it, vi } from "vitest";
import { chunkDocumentText } from "@/lib/files/chunk";
import { extractFactsFromChunks } from "@/lib/llm/extract-facts";

describe("fact extraction", () => {
  it("returns schema-valid facts with provenance metadata", async () => {
    const chunks = chunkDocumentText({
      text: [
        "The bell tower in Vallaki is sealed at dusk.",
        "Mara keeps the key behind the bar.",
      ].join("\n\n"),
      sourceDocumentId: "doc_1",
      pageStart: 4,
      maxParagraphsPerChunk: 2,
    });

    const responsesParse = vi.fn().mockResolvedValue({
      output_parsed: {
        facts: [
          {
            category: "location",
            subject: "Vallaki bell tower",
            summary: "The bell tower is sealed at dusk.",
            details: "The tower is a notable town location.",
            confidence: 0.93,
            sourceQuote: "The bell tower in Vallaki is sealed at dusk.",
            sourceReferences: [
              {
                sourceDocumentId: null,
                documentChunkId: null,
                pageStart: null,
                pageEnd: null,
                sourceQuote: "  The bell tower in Vallaki is sealed at dusk.  ",
              },
            ],
          },
          {
            category: "npc",
            subject: "Mara",
            summary: "Mara keeps the key behind the bar.",
            details: null,
            confidence: 0.88,
            sourceQuote: "Mara keeps the key behind the bar.",
            sourceReferences: [
              {
                sourceDocumentId: "doc_1",
                documentChunkId: "doc_1-chunk-0",
                pageStart: 4,
                pageEnd: 4,
                sourceQuote: "Mara keeps the key behind the bar.",
              },
            ],
          },
        ],
      },
    });

    const client = {
      responses: {
        parse: responsesParse,
      },
    };

    const facts = await extractFactsFromChunks({
      campaignId: "camp_1",
      chunks,
      client,
      model: "mock-model",
    });

    expect(responsesParse).toHaveBeenCalledTimes(1);
    expect(responsesParse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
        input: [
          expect.objectContaining({
            role: "system",
          }),
          expect.objectContaining({
            role: "user",
          }),
        ],
        text: expect.objectContaining({
          format: expect.objectContaining({
            type: "json_schema",
            name: "campaign_fact_extraction",
            strict: true,
            schema: expect.objectContaining({
              type: "object",
              properties: expect.objectContaining({
                facts: expect.objectContaining({
                  type: "array",
                }),
              }),
            }),
          }),
        }),
      }),
    );
    expect(facts).toHaveLength(2);
    expect(facts[0]).toMatchObject({
      campaignId: "camp_1",
      category: "location",
      subject: "Vallaki bell tower",
      provenance: {
        sourceDocumentId: "doc_1",
        chunkIndex: 0,
      },
    });
    expect(facts[0]?.sourceReferences).toEqual([
      {
        sourceDocumentId: "doc_1",
        documentChunkId: "doc_1-chunk-0",
        pageStart: null,
        pageEnd: null,
        sourceQuote: "The bell tower in Vallaki is sealed at dusk.",
      },
    ]);
    expect(facts[1]?.sourceReferences).toEqual([
      {
        sourceDocumentId: "doc_1",
        documentChunkId: "doc_1-chunk-0",
        pageStart: 4,
        pageEnd: 4,
        sourceQuote: "Mara keeps the key behind the bar.",
      },
    ]);
    expect(
      facts.every((fact) =>
        [
          "location",
          "npc",
          "faction",
          "event",
          "clue",
          "override",
        ].includes(fact.category),
      ),
    ).toBe(true);
    expect(facts[1]?.provenance.sourceQuote).toContain("Mara");
  });
});
