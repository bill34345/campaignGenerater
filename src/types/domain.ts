import { z } from "zod";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";

const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = nonEmptyString.optional().nullable();
const factStatusSchema = z.enum(["active", "overridden", "uncertain"]);
export const importSourceTypeSchema = z.enum([
  "official_module",
  "gm_notes",
  "session_record",
  "custom_reference",
]);
export const importBatchStatusSchema = z.enum([
  "staged",
  "ready",
  "processing",
  "completed",
  "failed",
]);
export const importBatchFileStatusSchema = z.enum([
  "staged",
  "ready",
  "processing",
  "completed",
  "failed",
]);
const importBatchFileWarningSchema = z
  .object({
    code: z.literal("duplicate_checksum"),
    checksum: nonEmptyString,
    fileNames: z.array(nonEmptyString).min(2),
  })
  .strict();
export const llmProviderSchema = z.enum([
  "openai_responses",
  "openai_chat",
  "anthropic",
]);
export const questRequestModeSchema = z.enum(["standard", "quick_start"]);
const conflictTypeSchema = z.enum([
  "social",
  "investigation",
  "combat",
  "exploration",
  "mixed",
]);
export const questGenerationStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export const questGenerationStageSchema = z.enum([
  "queued",
  "building_context",
  "calling_provider",
  "streaming",
  "validating",
  "persisting",
  "completed",
  "failed",
  "cancelled",
]);
export const questGenerationEventTypeSchema = z.enum([
  "status",
  "text_delta",
  "completed",
  "failed",
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

function uniqueStringArraySchema(fieldName: string) {
  return z.array(nonEmptyString).min(1).superRefine((values, context) => {
    const seen = new Set<string>();

    for (const value of values) {
      if (seen.has(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fieldName} must not contain duplicates.`,
        });
        return;
      }

      seen.add(value);
    }
  });
}
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

export const importBatchFileSchema = z
  .object({
    id: nonEmptyString.optional(),
    importBatchId: nonEmptyString.optional(),
    campaignId: nonEmptyString.optional(),
    originalName: nonEmptyString,
    storedPath: nonEmptyString.optional(),
    mimeType: nonEmptyString.optional(),
    checksum: nonEmptyString.optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    sourceType: importSourceTypeSchema,
    status: importBatchFileStatusSchema.default("staged"),
    errorCode: z.string().trim().min(1).nullable().optional(),
    errorMessage: z.string().trim().min(1).nullable().optional(),
    warnings: z.array(importBatchFileWarningSchema).optional(),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
  })
  .strict();

export type ImportBatchFile = z.infer<typeof importBatchFileSchema>;

export const importBatchSchema = z
  .object({
    id: nonEmptyString.optional(),
    campaignId: nonEmptyString,
    status: importBatchStatusSchema.default("staged"),
    defaultSourceType: importSourceTypeSchema,
    startedAt: z.coerce.date().nullable().optional(),
    completedAt: z.coerce.date().nullable().optional(),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    files: z.array(importBatchFileSchema).default([]),
  })
  .superRefine((batch, context) => {
    for (const [index, file] of batch.files.entries()) {
      if (file.importBatchId && batch.id && file.importBatchId !== batch.id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "File importBatchId must match the parent batch id.",
          path: ["files", index, "importBatchId"],
        });
      }

      if (file.campaignId && file.campaignId !== batch.campaignId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "File campaignId must match the parent campaignId.",
          path: ["files", index, "campaignId"],
        });
      }
    }
  })
  .strict();

export type ImportBatch = z.infer<typeof importBatchSchema>;

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

export const canonicalEntrySchema = z
  .object({
    id: nonEmptyString.optional(),
    campaignId: nonEmptyString,
    subject: nonEmptyString,
    factType: nonEmptyString,
    canonicalValue: nonEmptyString,
    notes: z.string().trim().min(1).nullable().optional(),
    sourceFactIds: uniqueStringArraySchema("sourceFactIds"),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
  })
  .strict();

export type CanonicalEntry = z.infer<typeof canonicalEntrySchema>;

export const canonComposerRequestSchema = z
  .object({
    campaignId: nonEmptyString,
    subject: nonEmptyString,
    factType: nonEmptyString,
    selectedFactIds: uniqueStringArraySchema("selectedFactIds"),
  })
  .strict();

export type CanonComposerRequest = z.infer<typeof canonComposerRequestSchema>;

const canonComposerEvidenceSchema = z
  .object({
    factId: nonEmptyString,
    subject: nonEmptyString,
    factType: nonEmptyString,
    value: nonEmptyString,
    evidence: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

export const canonComposerDraftSchema = z
  .object({
    campaignId: nonEmptyString,
    subject: nonEmptyString,
    factType: nonEmptyString,
    canonicalValue: nonEmptyString,
    notes: z.string().trim().min(1).nullable().optional(),
    selectedFactIds: uniqueStringArraySchema("selectedFactIds"),
    evidence: z.array(canonComposerEvidenceSchema).min(1),
  })
  .strict();

export type CanonComposerDraft = z.infer<typeof canonComposerDraftSchema>;

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
    requestMode: questRequestModeSchema.default("standard"),
    generationStatus: questGenerationStatusSchema.default("queued"),
    generationStage: questGenerationStageSchema.default("queued"),
    generationProgressMessage: z.string().trim().min(1).nullable().optional(),
    generationPreviewText: z.string().trim().min(1).nullable().optional(),
    generationStartedAt: z.coerce.date().nullable().optional(),
    generationCompletedAt: z.coerce.date().nullable().optional(),
    generationFailedAt: z.coerce.date().nullable().optional(),
    generationLastErrorCode: z.string().trim().min(1).nullable().optional(),
    generationLastErrorMessage: z.string().trim().min(1).nullable().optional(),
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

export const questGenerationEventSchema = z
  .object({
    type: questGenerationEventTypeSchema,
    questRequestId: nonEmptyString,
    generationStatus: questGenerationStatusSchema,
    generationStage: questGenerationStageSchema,
    message: z.string().trim().min(1).nullable().optional(),
    previewText: z.string().trim().min(1).nullable().optional(),
    delta: z.string().trim().min(1).nullable().optional(),
    draftId: z.string().trim().min(1).nullable().optional(),
    errorCode: z.string().trim().min(1).nullable().optional(),
    errorMessage: z.string().trim().min(1).nullable().optional(),
    occurredAt: z.coerce.date(),
  })
  .strict();

export type QuestGenerationEvent = z.infer<typeof questGenerationEventSchema>;
export type QuestGenerationStatus = z.infer<typeof questGenerationStatusSchema>;
export type QuestGenerationStage = z.infer<typeof questGenerationStageSchema>;

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
