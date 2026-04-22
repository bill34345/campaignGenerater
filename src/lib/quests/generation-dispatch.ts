import { z } from "zod";
import { buildTownQuestContext } from "@/lib/canon/context-builder";
import {
  mergeCanonicalAndLegacyFacts,
  projectCanonicalEntriesToCanonFacts,
} from "@/lib/canon/context-projection";
import { db } from "@/lib/db";
import { getLlmErrorCode } from "@/lib/llm/provider-errors";
import {
  appendQuestGenerationPreview,
  markQuestGenerationCompleted,
  markQuestGenerationFailed,
  markQuestGenerationRunning,
} from "@/lib/quests/generation-status";
import { runQuestGeneration } from "@/lib/quests/generation-run";
import { validateQuestDraft } from "@/lib/quests/validate-quest";
import {
  canonFactSchema,
  llmProviderSchema,
  questRequestSchema,
  type QuestRequest,
  type TownProfile,
} from "@/types/domain";

function parseQuestHooks(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toTownProfile(
  campaignId: string,
  town: {
    id?: string | null;
    name: string;
    vibe: string | null;
    tension: string | null;
    notes: string | null;
    questHooks: unknown;
  },
): TownProfile {
  return {
    id: town.id ?? `${campaignId}-${town.name.toLowerCase().replace(/\s+/g, "-")}`,
    campaignId,
    name: town.name,
    vibe: town.vibe,
    tension: town.tension,
    notes: town.notes,
    questHooks: parseQuestHooks(town.questHooks),
  };
}

function toAdHocTownProfile(campaignId: string, questRequest: QuestRequest): TownProfile {
  return {
    id: `${campaignId}-${questRequest.townName.toLowerCase().replace(/\s+/g, "-")}`,
    campaignId,
    name: questRequest.townName,
    vibe: questRequest.townVibe ?? null,
    tension: questRequest.localTension ?? null,
    notes: questRequest.extraContext ?? null,
    questHooks: [],
  };
}

async function loadQuestGenerationInput(campaignId: string, questRequestId: string) {
  const questRequestRecord = await db.questRequest.findFirst({
    where: {
      id: questRequestId,
      campaignId,
    },
    select: {
      id: true,
      campaignId: true,
      townProfileId: true,
      requestMode: true,
      generationStatus: true,
      generationStage: true,
      generationProgressMessage: true,
      generationPreviewText: true,
      generationStartedAt: true,
      generationCompletedAt: true,
      generationFailedAt: true,
      generationLastErrorCode: true,
      generationLastErrorMessage: true,
      townName: true,
      locale: true,
      townVibe: true,
      localTension: true,
      questType: true,
      mainPlotRelation: true,
      desiredLength: true,
      extraContext: true,
    },
  });

  if (!questRequestRecord) {
    throw Object.assign(new Error("Quest request not found."), {
      code: "quest_request_not_found",
    });
  }

  const questRequest = questRequestSchema.parse(questRequestRecord);
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      tone: true,
      partyLevel: true,
      llmProvider: true,
      llmApiKey: true,
      llmModel: true,
      llmBaseUrl: true,
    },
  });

  if (!campaign) {
    throw Object.assign(new Error("Campaign not found."), {
      code: "campaign_not_found",
    });
  }

  const townRecord = await db.townProfile.findFirst({
    where: questRequest.townProfileId
      ? {
          campaignId,
          id: questRequest.townProfileId,
        }
      : undefined,
    select: {
      id: true,
      name: true,
      vibe: true,
      tension: true,
      notes: true,
      questHooks: true,
    },
  });

  const useThinContext = questRequest.requestMode === "quick_start";
  const [rawCanonicalEntries, rawCanonFacts, deltas] = useThinContext
    ? [[], [], []]
    : await Promise.all([
        db.canonicalEntry.findMany({
          where: { campaignId },
          include: {
            sourceFacts: {
              include: {
                canonFact: {
                  select: {
                    id: true,
                    campaignId: true,
                    sourceDocumentId: true,
                    documentChunkId: true,
                    subject: true,
                    factType: true,
                    value: true,
                    status: true,
                    priority: true,
                    confidence: true,
                    evidence: true,
                  },
                },
              },
            },
          },
        }),
        db.canonFact.findMany({
          where: { campaignId },
          select: {
            id: true,
            campaignId: true,
            sourceDocumentId: true,
            documentChunkId: true,
            subject: true,
            factType: true,
            value: true,
            status: true,
            priority: true,
            confidence: true,
            evidence: true,
          },
        }),
        db.campaignDelta.findMany({
          where: { campaignId },
          orderBy: [{ createdAt: "desc" }],
          take: 8,
          select: {
            id: true,
            campaignId: true,
            deltaType: true,
            summary: true,
            createdAt: true,
            sourceFactId: true,
            sourceFact: {
              select: {
                id: true,
                subject: true,
                factType: true,
                value: true,
              },
            },
          },
        }),
      ]);

  const canonFacts = rawCanonFacts.flatMap((fact) => {
    const parsed = canonFactSchema.safeParse(fact);
    return parsed.success ? [parsed.data] : [];
  });
  const projectedCanonicalFacts = projectCanonicalEntriesToCanonFacts(
    rawCanonicalEntries.map((entry) => ({
      ...entry,
      sourceFactIds: entry.sourceFacts.map((sourceFact) => sourceFact.canonFactId),
    })),
  );
  const resolvedCanonFacts = mergeCanonicalAndLegacyFacts(
    projectedCanonicalFacts,
    canonFacts.filter((fact) => fact.status === "active"),
  );
  const workingContext = buildTownQuestContext({
    campaignId,
    campaignTone: campaign.tone,
    partyLevel: campaign.partyLevel,
    town: townRecord
      ? toTownProfile(campaignId, townRecord)
      : toAdHocTownProfile(campaignId, questRequest),
    canonFacts: useThinContext ? [] : resolvedCanonFacts,
    deltas: useThinContext ? [] : deltas,
  });

  return {
    questRequest,
    workingContext,
    llmSettings: {
      llmProvider: llmProviderSchema.parse(campaign.llmProvider),
      llmApiKey: campaign.llmApiKey,
      llmModel: campaign.llmModel,
      llmBaseUrl: campaign.llmBaseUrl,
    },
  };
}

export async function dispatchQuestGeneration(input: {
  campaignId: string;
  questRequestId: string;
}) {
  const startedAt = new Date();

  try {
    await markQuestGenerationRunning({
      questRequestId: input.questRequestId,
      stage: "building_context",
      message: "Building quest context...",
      startedAt,
    });

    const { questRequest, workingContext, llmSettings } =
      await loadQuestGenerationInput(input.campaignId, input.questRequestId);
    const { draft: generatedDraft, meta: generationMeta } = await runQuestGeneration({
      llmSettings,
      workingContext,
      questRequest,
      onStageChange: async (stage, message) => {
        if (stage === "failed") {
          await markQuestGenerationFailed({
            questRequestId: input.questRequestId,
            errorMessage: message ?? "Quest generation failed.",
            message,
          });
          return;
        }

        await markQuestGenerationRunning({
          questRequestId: input.questRequestId,
          stage,
          message: message ?? null,
        });
      },
      onTextDelta: async (delta) => {
        await appendQuestGenerationPreview({
          questRequestId: input.questRequestId,
          delta,
          generationProgressMessage: "Streaming draft text...",
        });
      },
    });

    await markQuestGenerationRunning({
      questRequestId: input.questRequestId,
      stage: "validating",
      message: "Validating quest structure...",
    });

    const validation = validateQuestDraft(generatedDraft, questRequest);
    if (!validation.valid) {
      await markQuestGenerationFailed({
        questRequestId: input.questRequestId,
        errorCode: "quest_validation_failed",
        errorMessage: validation.errors.join(" "),
        message: "Quest draft validation failed.",
      });
      return;
    }

    await markQuestGenerationRunning({
      questRequestId: input.questRequestId,
      stage: "persisting",
      message: "Saving quest draft...",
    });

    const questDraft = await db.questDraft.upsert({
      where: {
        questRequestId: questRequest.id,
      },
      update: {
        locale: generatedDraft.locale,
        generationMode: generationMeta.generationMode,
        generationProvider: generationMeta.generationProvider,
        generationModel: generationMeta.generationModel,
        fallbackReason: generationMeta.fallbackReason,
        generationErrorCode: generationMeta.generationErrorCode,
        title: generatedDraft.title,
        premise: generatedDraft.premise,
        hook: generatedDraft.hook,
        scenes: generatedDraft.scenes,
        npcs: generatedDraft.npcs,
        encounters: generatedDraft.encounters,
        rewards: generatedDraft.rewards,
        returnToMainPlot: generatedDraft.returnToMainPlot,
        gmSummary: generatedDraft.gmSummary,
      },
      create: {
        campaignId: input.campaignId,
        questRequestId: questRequest.id,
        locale: generatedDraft.locale,
        generationMode: generationMeta.generationMode,
        generationProvider: generationMeta.generationProvider,
        generationModel: generationMeta.generationModel,
        fallbackReason: generationMeta.fallbackReason,
        generationErrorCode: generationMeta.generationErrorCode,
        title: generatedDraft.title,
        premise: generatedDraft.premise,
        hook: generatedDraft.hook,
        scenes: generatedDraft.scenes,
        npcs: generatedDraft.npcs,
        encounters: generatedDraft.encounters,
        rewards: generatedDraft.rewards,
        returnToMainPlot: generatedDraft.returnToMainPlot,
        gmSummary: generatedDraft.gmSummary,
      },
    });

    await markQuestGenerationCompleted({
      questRequestId: input.questRequestId,
      draftId: questDraft.id,
      message: "Quest draft ready.",
    });
  } catch (error) {
    const errorCode =
      getLlmErrorCode(error) ??
      (error instanceof z.ZodError ? "invalid_quest_generation_state" : null) ??
      (error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : "quest_generation_failed");

    await markQuestGenerationFailed({
      questRequestId: input.questRequestId,
      errorCode,
      errorMessage:
        error instanceof Error ? error.message : "Quest generation failed.",
      message: "Quest generation failed.",
    });
  }
}

export function scheduleQuestGenerationDispatch(input: {
  campaignId: string;
  questRequestId: string;
}) {
  setTimeout(() => {
    void dispatchQuestGeneration(input);
  }, 0);
}
