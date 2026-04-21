import { NextResponse } from "next/server";
import { z } from "zod";
import { buildTownQuestContext } from "@/lib/canon/context-builder";
import {
  mergeCanonicalAndLegacyFacts,
  projectCanonicalEntriesToCanonFacts,
} from "@/lib/canon/context-projection";
import { db } from "@/lib/db";
import { runQuestGeneration } from "@/lib/quests/generation-run";
import { validateQuestDraft } from "@/lib/quests/validate-quest";
import {
  canonFactSchema,
  llmProviderSchema,
  questRequestSchema,
  type QuestRequest,
  type TownProfile,
} from "@/types/domain";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

const createQuestRequestBodySchema = questRequestSchema
  .omit({
    id: true,
    campaignId: true,
  })
  .strict();

function parseQuestHooks(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
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

function toAdHocTownProfile(
  campaignId: string,
  body: z.infer<typeof createQuestRequestBodySchema>,
): TownProfile {
  return {
    id: `${campaignId}-${body.townName.toLowerCase().replace(/\s+/g, "-")}`,
    campaignId,
    name: body.townName,
    vibe: body.townVibe ?? null,
    tension: body.localTension ?? null,
    notes: body.extraContext ?? null,
    questHooks: [],
  };
}

export async function POST(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  let body: z.infer<typeof createQuestRequestBodySchema>;

  try {
    body = createQuestRequestBodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return NextResponse.json(
        { errorCode: "invalidRequestBody", error: "Invalid request body." },
        { status: 400 },
      );
    }

    throw error;
  }

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
    return NextResponse.json(
      { errorCode: "campaignNotFound", error: "Campaign not found." },
      { status: 404 },
    );
  }

  const townRecord = await db.townProfile.findFirst({
    where: body.townProfileId
      ? {
          campaignId,
          id: body.townProfileId,
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

  if (
    townRecord &&
    body.townProfileId &&
    normalizeText(body.townName) !== normalizeText(townRecord.name)
  ) {
    return NextResponse.json(
      {
        errorCode: "townNameMismatch",
        error: `townName must match the selected town profile name "${townRecord.name}".`,
      },
      { status: 400 },
    );
  }

  const createdQuestRequest = await db.questRequest.create({
    data: {
      campaignId,
      townProfileId: townRecord?.id ?? null,
      requestMode: body.requestMode,
      townName: townRecord?.name ?? body.townName,
      townVibe: body.townVibe ?? null,
      localTension: body.localTension ?? null,
      questType: body.questType ?? null,
      mainPlotRelation: body.mainPlotRelation ?? null,
      desiredLength: body.desiredLength ?? null,
      extraContext: body.extraContext ?? null,
      locale: body.locale,
    },
  });
  const questRequest = questRequestSchema.parse({
    id: createdQuestRequest.id,
    campaignId: createdQuestRequest.campaignId,
    townProfileId: createdQuestRequest.townProfileId,
    townName: createdQuestRequest.townName,
    locale: body.locale,
    townVibe: createdQuestRequest.townVibe,
    localTension: createdQuestRequest.localTension,
    questType: createdQuestRequest.questType,
    mainPlotRelation: createdQuestRequest.mainPlotRelation,
    desiredLength: createdQuestRequest.desiredLength,
    extraContext: createdQuestRequest.extraContext,
    requestMode: body.requestMode,
  }) satisfies QuestRequest;

  const useThinContext = body.requestMode === "quick_start";
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
      : toAdHocTownProfile(campaignId, body),
    canonFacts: useThinContext ? [] : resolvedCanonFacts,
    deltas: useThinContext ? [] : deltas,
  });

  const { draft: generatedDraft, meta: generationMeta } = await runQuestGeneration({
    llmSettings: {
      llmProvider: llmProviderSchema.parse(campaign.llmProvider),
      llmApiKey: campaign.llmApiKey,
      llmModel: campaign.llmModel,
      llmBaseUrl: campaign.llmBaseUrl,
    },
    workingContext,
    questRequest,
  });
  const validation = validateQuestDraft(generatedDraft, questRequest);

  if (!validation.valid) {
    return NextResponse.json(
      {
        questRequest,
        draft: generatedDraft,
        validation,
      },
      { status: 422 },
    );
  }

  const questDraft = await db.questDraft.create({
    data: {
      campaignId,
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

  return NextResponse.json(
    {
      questRequest,
      draft: questDraft,
      validation,
    },
    { status: 201 },
  );
}
