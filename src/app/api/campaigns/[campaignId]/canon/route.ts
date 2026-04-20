import { NextResponse } from "next/server";
import { z } from "zod";
import { mergeCanonFacts } from "@/lib/canon/merge";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

const updateCanonFactSchema = z
  .object({
    factId: z.string().trim().min(1),
    status: z.enum(["active", "overridden", "uncertain"]),
  })
  .strict();

async function loadCanonOverview(campaignId: string) {
  const [facts, canonicalEntries, campaign] = await Promise.all([
    db.canonFact.findMany({
      where: { campaignId },
      orderBy: [{ subject: "asc" }, { factType: "asc" }, { priority: "desc" }],
    }),
    db.canonicalEntry.findMany({
      where: { campaignId },
      orderBy: [{ subject: "asc" }, { factType: "asc" }],
      include: {
        sourceFacts: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
    }),
    db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        llmApiKey: true,
      },
    }),
  ]);

  if (!campaign) {
    return null;
  }

  const merged = mergeCanonFacts(facts, canonicalEntries);

  return {
    groups: merged.groups,
    conflictGroups: merged.conflictGroups,
    canonicalEntries: merged.canonicalEntries,
    composerMeta: {
      providerConfigured: Boolean(campaign.llmApiKey),
    },
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  const overview = await loadCanonOverview(campaignId);

  if (!overview) {
    return NextResponse.json(
      { errorCode: "campaignNotFound", error: "Campaign not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(overview);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  let body: z.infer<typeof updateCanonFactSchema>;

  try {
    body = updateCanonFactSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return NextResponse.json(
        { errorCode: "invalidRequestBody", error: "Invalid request body." },
        { status: 400 },
      );
    }

    throw error;
  }

  const fact = await db.canonFact.findFirst({
    where: {
      id: body.factId,
      campaignId,
    },
    select: {
      id: true,
      subject: true,
      factType: true,
      priority: true,
    },
  });

  if (!fact) {
    return NextResponse.json(
      { errorCode: "genericFailed", error: "Fact not found." },
      { status: 404 },
    );
  }

  if (body.status === "active") {
    const peers = await db.canonFact.findMany({
      where: {
        campaignId,
        subject: fact.subject,
        factType: fact.factType,
      },
      select: {
        id: true,
        priority: true,
      },
    });

    const nextPriority =
      Math.max(...peers.map((peer) => peer.priority), fact.priority) + 1;

    await db.$transaction([
      db.canonFact.updateMany({
        where: {
          campaignId,
          subject: fact.subject,
          factType: fact.factType,
          id: {
            not: fact.id,
          },
          status: "active",
        },
        data: {
          status: "overridden",
        },
      }),
      db.canonFact.update({
        where: { id: fact.id },
        data: {
          status: "active",
          priority: nextPriority,
        },
      }),
    ]);
  } else {
    await db.canonFact.update({
      where: { id: fact.id },
      data: {
        status: body.status,
      },
    });
  }

  const overview = await loadCanonOverview(campaignId);

  if (!overview) {
    return NextResponse.json(
      { errorCode: "campaignNotFound", error: "Campaign not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(overview);
}
