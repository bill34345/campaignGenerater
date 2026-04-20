import { z } from "zod";

export const factCategorySchema = z.enum([
  "location",
  "npc",
  "faction",
  "event",
  "clue",
  "override",
]);

export type FactCategory = z.infer<typeof factCategorySchema>;

export const factSourceReferenceSchema = z
  .object({
    sourceDocumentId: z.string().min(1).nullable().optional(),
    documentChunkId: z.string().min(1).nullable().optional(),
    pageStart: z.number().int().positive().nullable().optional(),
    pageEnd: z.number().int().positive().nullable().optional(),
    sourceQuote: z.string().min(1).nullable().optional(),
  })
  .strict();

export const extractedFactSchema = z
  .object({
    category: factCategorySchema,
    subject: z.string().min(1),
    summary: z.string().min(1),
    details: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    sourceQuote: z.string().nullable().optional(),
    sourceReferences: z.array(factSourceReferenceSchema).default([]),
  })
  .strict();

export type ExtractedFact = z.infer<typeof extractedFactSchema>;

export const factExtractionResponseSchema = z
  .object({
    facts: z.array(extractedFactSchema).default([]),
  })
  .strict();

export type FactExtractionResponse = z.infer<
  typeof factExtractionResponseSchema
>;
