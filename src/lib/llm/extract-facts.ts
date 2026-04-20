import { zodTextFormat } from "openai/helpers/zod";
import {
  createOpenAIResponsesClient,
  type OpenAIClientOptions,
  type OpenAIResponsesClient,
} from "@/lib/openai/client";
import {
  factExtractionResponseSchema,
  type FactCategory,
  type ExtractedFact,
} from "@/lib/llm/fact-schema";

export type FactExtractionChunk = {
  chunkIndex: number;
  sourceDocumentId: string;
  pageStart: number | null;
  pageEnd: number | null;
  paragraphStartIndex: number;
  paragraphEndIndex: number;
  text: string;
  documentChunkId?: string;
};

export type ExtractFactsFromChunksInput = {
  campaignId: string;
  chunks: FactExtractionChunk[]; // chunks are processed one-by-one to preserve provenance
  client?: OpenAIResponsesClient;
  model?: string;
  openAI?: OpenAIClientOptions;
};

export type ExtractedCampaignFact = ExtractedFact & {
  campaignId: string;
  sourceDocumentId: string;
  documentChunkId: string;
  chunkIndex: number;
  provenance: {
    sourceDocumentId: string;
    documentChunkId: string;
    chunkIndex: number;
    paragraphStartIndex: number;
    paragraphEndIndex: number;
    pageStart: number | null;
    pageEnd: number | null;
    sourceQuote: string | null;
  };
};

function buildPrompt(chunk: FactExtractionChunk) {
  return [
    "Extract canon facts from the campaign source chunk below.",
    "Return only facts directly supported by the text.",
    "Use the categories location, npc, faction, event, clue, and override.",
    "Prefer concise subject names and summaries.",
    "",
    `Source document: ${chunk.sourceDocumentId}`,
    `Chunk index: ${chunk.chunkIndex}`,
    `Paragraph range: ${chunk.paragraphStartIndex}-${chunk.paragraphEndIndex}`,
    "",
    chunk.text,
  ].join("\n");
}

function normalizeSourceQuote(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toFactRecord(
  campaignId: string,
  chunk: FactExtractionChunk,
  fact: ExtractedFact,
): ExtractedCampaignFact {
  const documentChunkId =
    chunk.documentChunkId ?? `${chunk.sourceDocumentId}-chunk-${chunk.chunkIndex}`;

  return {
    ...fact,
    campaignId,
    sourceDocumentId: chunk.sourceDocumentId,
    documentChunkId,
    chunkIndex: chunk.chunkIndex,
    provenance: {
      sourceDocumentId: chunk.sourceDocumentId,
      documentChunkId,
      chunkIndex: chunk.chunkIndex,
      paragraphStartIndex: chunk.paragraphStartIndex,
      paragraphEndIndex: chunk.paragraphEndIndex,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      sourceQuote: normalizeSourceQuote(fact.sourceQuote),
    },
    sourceReferences: fact.sourceReferences.map((reference) => ({
      ...reference,
      sourceDocumentId: reference.sourceDocumentId ?? chunk.sourceDocumentId,
      documentChunkId: reference.documentChunkId ?? documentChunkId,
      sourceQuote: normalizeSourceQuote(reference.sourceQuote),
    })),
  };
}

export async function extractFactsFromChunks({
  campaignId,
  chunks,
  client,
  model = "gpt-4.1-mini",
  openAI,
}: ExtractFactsFromChunksInput): Promise<ExtractedCampaignFact[]> {
  const resolvedClient = client ?? createOpenAIResponsesClient(openAI);
  const facts: ExtractedCampaignFact[] = [];

  for (const chunk of chunks) {
    const response = await resolvedClient.responses.parse({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You extract campaign canon facts and return only structured JSON.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(chunk),
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(
          factExtractionResponseSchema,
          "campaign_fact_extraction",
        ),
      },
    });

    const parsed = factExtractionResponseSchema.parse(response.output_parsed);

    for (const fact of parsed.facts) {
      facts.push(toFactRecord(campaignId, chunk, fact));
    }
  }

  return facts;
}

export type { FactCategory };
