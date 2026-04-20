import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCanonComposerDraft } from "@/lib/canon/composer";
import { db } from "@/lib/db";
import { canonFactSchema } from "@/types/domain";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

const requestSchema = z
  .object({
    subject: z.string().trim().min(1),
    factType: z.string().trim().min(1),
    selectedFactIds: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

function toCanonFactInput(fact: {
  id: string;
  campaignId: string;
  sourceDocumentId: string | null;
  documentChunkId: string | null;
  subject: string;
  factType: string;
  value: string;
  status: string;
  priority: number;
  confidence: number | null;
  evidence: string | null;
}) {
  return {
    id: fact.id,
    campaignId: fact.campaignId,
    sourceDocumentId: fact.sourceDocumentId,
    documentChunkId: fact.documentChunkId,
    subject: fact.subject,
    factType: fact.factType,
    value: fact.value,
    status: fact.status,
    priority: fact.priority,
    confidence: fact.confidence,
    evidence: fact.evidence,
  };
}

export async function POST(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  let body: z.infer<typeof requestSchema>;

  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return NextResponse.json(
        { errorCode: "invalidRequestBody", error: "Invalid request body." },
        { status: 400 },
      );
    }

    throw error;
  }

  const [campaign, selectedFacts, existingEntry] = await Promise.all([
    db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        llmApiKey: true,
      },
    }),
    db.canonFact.findMany({
      where: {
        campaignId,
        id: {
          in: body.selectedFactIds,
        },
      },
      orderBy: [{ priority: "desc" }],
    }),
    db.canonicalEntry.findUnique({
      where: {
        campaignId_subject_factType: {
          campaignId,
          subject: body.subject,
          factType: body.factType,
        },
      },
      include: {
        sourceFacts: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
    }),
  ]);

  if (!campaign) {
    return NextResponse.json(
      { errorCode: "campaignNotFound", error: "Campaign not found." },
      { status: 404 },
    );
  }

  if (selectedFacts.length !== body.selectedFactIds.length) {
    return NextResponse.json(
      {
        errorCode: "genericFailed",
        error: "One or more selected candidate facts could not be found.",
      },
      { status: 404 },
    );
  }

  const mismatchedFacts = selectedFacts.filter(
    (fact) => fact.subject !== body.subject || fact.factType !== body.factType,
  );

  if (mismatchedFacts.length > 0) {
    return NextResponse.json(
      {
        errorCode: "invalidRequestBody",
        error: "Selected candidate facts must belong to the same subject and fact type.",
      },
      { status: 400 },
    );
  }

  const draft = buildCanonComposerDraft({
    campaignId,
    subject: body.subject,
    factType: body.factType,
    selectedFacts: selectedFacts.map((fact) =>
      canonFactSchema.parse(toCanonFactInput(fact)),
    ),
    existingEntry: existingEntry
      ? {
          ...existingEntry,
          sourceFactIds: existingEntry.sourceFacts.map((sourceFact) => sourceFact.canonFactId),
        }
      : null,
  });

  return NextResponse.json({
    draft,
    selectedCandidates: selectedFacts,
    existingEntry: existingEntry
      ? {
          ...existingEntry,
          sourceFactIds: existingEntry.sourceFacts.map((sourceFact) => sourceFact.canonFactId),
        }
      : null,
    composerMeta: {
      providerConfigured: Boolean(campaign.llmApiKey),
      generationMode: "deterministic",
    },
  });
}
