import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

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
    canonicalValue: z.string().trim().min(1),
    notes: z.string().trim().min(1).nullable().optional(),
    sourceFactIds: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

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

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });

  if (!campaign) {
    return NextResponse.json(
      { errorCode: "campaignNotFound", error: "Campaign not found." },
      { status: 404 },
    );
  }

  const sourceFacts = await db.canonFact.findMany({
    where: {
      campaignId,
      id: {
        in: body.sourceFactIds,
      },
    },
    select: {
      id: true,
      subject: true,
      factType: true,
    },
  });

  if (sourceFacts.length !== body.sourceFactIds.length) {
    return NextResponse.json(
      {
        errorCode: "genericFailed",
        error: "One or more linked candidate facts could not be found.",
      },
      { status: 404 },
    );
  }

  const mismatchedFacts = sourceFacts.filter(
    (fact) => fact.subject !== body.subject || fact.factType !== body.factType,
  );

  if (mismatchedFacts.length > 0) {
    return NextResponse.json(
      {
        errorCode: "invalidRequestBody",
        error: "Linked candidate facts must match the canonical subject and fact type.",
      },
      { status: 400 },
    );
  }

  const entry = await db.$transaction(async (transaction) => {
    const savedEntry = await transaction.canonicalEntry.upsert({
      where: {
        campaignId_subject_factType: {
          campaignId,
          subject: body.subject,
          factType: body.factType,
        },
      },
      update: {
        canonicalValue: body.canonicalValue,
        notes: body.notes ?? null,
      },
      create: {
        campaignId,
        subject: body.subject,
        factType: body.factType,
        canonicalValue: body.canonicalValue,
        notes: body.notes ?? null,
      },
    });

    await transaction.canonicalEntrySourceFact.deleteMany({
      where: {
        campaignId,
        canonicalEntryId: savedEntry.id,
      },
    });

    await transaction.canonicalEntrySourceFact.createMany({
      data: body.sourceFactIds.map((canonFactId) => ({
        campaignId,
        canonicalEntryId: savedEntry.id,
        canonFactId,
      })),
    });

    return transaction.canonicalEntry.findUnique({
      where: {
        id: savedEntry.id,
      },
      include: {
        sourceFacts: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });
  });

  return NextResponse.json(
    {
      entry: entry
        ? {
            ...entry,
            sourceFactIds: entry.sourceFacts.map((sourceFact) => sourceFact.canonFactId),
          }
        : null,
    },
    { status: 201 },
  );
}
