import { z } from "zod";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";

const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = nonEmptyString.optional().nullable();
const factStatusSchema = z.enum(["active", "overridden", "uncertain"]);
export const llmProviderSchema = z.enum([
  "openai_responses",
  "openai_chat",
  "anthropic",
]);
const conflictTypeSchema = z.enum([
  "social",
  "investigation",
  "combat",
  "exploration",
  "mixed",
]);
const generationModeSchema = z.enum(["provider", "fallback", "unknown", "openai"]);
const generationProviderSchema = llmProviderSchema;
const fallbackReasonSchema = z.enum([
  "missing_api_key",
  "invalid_api_key",
  "authentication_error",
  "insufficient_quota",
  "openai_request_failed",
]);

export const createCampaignSchema = z
  .object({
    name: nonEmptyString,
    system: z.literal("5e").default("5e"),
    tone: nonEmptyString,
    partyLevel: z.coerce.number().int().min(1).max(20),
    contentConstraints: z.string().trim().optional().nullable(),
  })
  .strict()
  .transform((campaign) => ({
    ...campaign,
    contentConstraints:
      campaign.contentConstraints && campaign.contentConstraints.length > 0
        ? campaign.contentConstraints
        : null,
  }));

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const campaignLlmSettingsSchema = z
  .object({
    llmProvider: llmProviderSchema.default("openai_responses"),
    llmApiKey: z.string().trim().nullable().optional(),
    llmModel: z.string().trim().nullable().optional(),
    llmBaseUrl: z.string().trim().nullable().optional(),
  })
  .strict()
  .transform((settings) => ({
    llmProvider: settings.llmProvider,
    llmApiKey: settings.llmApiKey?.trim() ? settings.llmApiKey.trim() : null,
    llmModel: settings.llmModel?.trim() ? settings.llmModel.trim() : null,
    llmBaseUrl: settings.llmBaseUrl?.trim() ? settings.llmBaseUrl.trim() : null,
  }));

export type CampaignLlmSettings = z.infer<typeof campaignLlmSettingsSchema>;

export const campaignSummarySchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    system: z.literal("5e"),
    tone: nonEmptyString,
    partyLevel: z.number().int().min(1).max(20),
    contentConstraints: z.string().trim().nullable(),
    llmProvider: llmProviderSchema,
    llmApiKey: z.string().trim().nullable(),
    llmModel: z.string().trim().nullable(),
    llmBaseUrl: z.string().trim().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .strict();

export type CampaignSummary = z.infer<typeof campaignSummarySchema>;

const questSceneSchema = z
  .object({
    name: nonEmptyString,
    goal: nonEmptyString,
    summary: nonEmptyString,
    location: nonEmptyString,
    conflictType: conflictTypeSchema,
    outcomeOptions: z.array(nonEmptyString).min(1),
  })
  .strict();

const questNpcSchema = z
  .object({
    name: nonEmptyString,
    role: nonEmptyString,
    motivation: nonEmptyString,
    secret: nonEmptyString,
  })
  .strict();

const questEncounterSchema = z
  .object({
    name: nonEmptyString,
    difficultyTarget: nonEmptyString,
    purpose: nonEmptyString,
    notes: nonEmptyString,
  })
  .strict();

const questRewardSchema = z
  .object({
    type: nonEmptyString,
    value: nonEmptyString,
  })
  .strict();

export const canonFactSchema = z
  .object({
    id: nonEmptyString.optional(),
    campaignId: nonEmptyString,
    sourceDocumentId: optionalNonEmptyString,
    documentChunkId: optionalNonEmptyString,
    subject: nonEmptyString,
    factType: nonEmptyString,
    value: nonEmptyString,
    status: factStatusSchema.default("active"),
    priority: z.number().int().default(0),
    confidence: z.number().min(0).max(1).nullable().optional(),
    evidence: z.string().trim().min(1).optional().nullable(),
  })
  .strict();

export type CanonFact = z.infer<typeof canonFactSchema>;

export const townProfileSchema = z
  .object({
    id: nonEmptyString.optional(),
    campaignId: nonEmptyString,
    name: nonEmptyString,
    vibe: z.string().trim().min(1).optional().nullable(),
    tension: z.string().trim().min(1).optional().nullable(),
    notes: z.string().trim().min(1).optional().nullable(),
    questHooks: z.array(nonEmptyString).default([]),
  })
  .strict();

export type TownProfile = z.infer<typeof townProfileSchema>;

export const questRequestSchema = z
  .object({
    id: nonEmptyString.optional(),
    campaignId: nonEmptyString,
    townProfileId: optionalNonEmptyString,
    townName: nonEmptyString,
    locale: z.enum(["zh", "en"]).default(DEFAULT_LOCALE),
    townVibe: z.string().trim().min(1).optional().nullable(),
    localTension: z.string().trim().min(1).optional().nullable(),
    questType: z.string().trim().min(1).optional().nullable(),
    mainPlotRelation: z.string().trim().min(1).optional().nullable(),
    desiredLength: z.string().trim().min(1).optional().nullable(),
    extraContext: z.string().trim().min(1).optional().nullable(),
  })
  .strict();

export type QuestRequest = z.infer<typeof questRequestSchema>;

export const questDraftSchema = z
  .object({
    id: nonEmptyString.optional(),
    campaignId: nonEmptyString,
    questRequestId: optionalNonEmptyString,
    locale: z.enum(["zh", "en"]).default(DEFAULT_LOCALE),
    generationMode: generationModeSchema.default("unknown"),
    generationProvider: generationProviderSchema.nullable().optional(),
    generationModel: z.string().trim().min(1).nullable().optional(),
    fallbackReason: fallbackReasonSchema.nullable().optional(),
    generationErrorCode: z.string().trim().min(1).nullable().optional(),
    title: nonEmptyString,
    premise: nonEmptyString,
    hook: nonEmptyString,
    scenes: z.array(questSceneSchema).min(3).max(5),
    npcs: z.array(questNpcSchema).min(1),
    encounters: z.array(questEncounterSchema).min(1),
    rewards: z.array(questRewardSchema).min(1),
    returnToMainPlot: nonEmptyString,
    gmSummary: nonEmptyString,
  })
  .strict();

export type QuestDraft = z.infer<typeof questDraftSchema>;
export type LlmProvider = z.infer<typeof llmProviderSchema>;
