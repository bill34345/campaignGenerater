import Link from "next/link";
import { db } from "@/lib/db";
import {
  buildTownQuestContext,
  type TownQuestContext,
} from "@/lib/canon/context-builder";
import {
  mergeCanonicalAndLegacyFacts,
  projectCanonicalEntriesToCanonFacts,
} from "@/lib/canon/context-projection";
import { QuestRequestForm } from "@/components/quests/quest-request-form";
import { getMessages, getRequestLocale } from "@/lib/i18n/translate";
import { canonFactSchema, type TownProfile } from "@/types/domain";

type NewQuestPageProps = {
  params: Promise<{
    campaignId: string;
  }>;
  searchParams: Promise<{
    townId?: string;
    quick_start?: string;
    requestId?: string;
  }>;
};

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

function inferTownFromCanon(
  campaignId: string,
  canonFacts: Array<{
    subject: string;
    factType: string;
    value: string;
    status: string;
  }>,
) {
  const activeLocationFact = canonFacts.find(
    (fact) =>
      fact.status === "active" &&
      fact.factType.toLowerCase().includes("town"),
  );
  const activeHookFact = canonFacts.find(
    (fact) =>
      fact.status === "active" &&
      (fact.factType.toLowerCase().includes("hook") ||
        fact.factType.toLowerCase().includes("clue")),
  );

  if (!activeLocationFact) {
    return null;
  }

  return {
    id: `${campaignId}-${activeLocationFact.subject.toLowerCase().replace(/\s+/g, "-")}`,
    name: activeLocationFact.subject,
    vibe: activeLocationFact.value,
    tension: activeHookFact?.value ?? null,
    notes: null,
    questHooks: activeHookFact ? [activeHookFact.value] : [],
  };
}

function buildExtraContext(context: TownQuestContext, locale: "zh" | "en") {
  const labels =
      locale === "zh"
      ? {
          townNotes: "城镇笔记",
          townFact: "城镇事实",
          npc: "NPC",
          faction: "阵营",
          recentChange: "最近变化",
          openHooks: "开放线索",
        }
      : {
          townNotes: "Town notes",
          townFact: "Town fact",
          npc: "NPC",
          faction: "Faction",
          recentChange: "Recent change",
          openHooks: "Open hooks",
        };

  const lines = [
    context.town.notes ? `${labels.townNotes}: ${context.town.notes}` : null,
    ...context.townFacts
      .slice(0, 2)
      .map((fact) => `${labels.townFact}: ${fact.subject} - ${fact.value}`),
    ...context.relevantNpcs
      .slice(0, 2)
      .map((fact) => `${labels.npc}: ${fact.subject} - ${fact.value}`),
    ...context.relevantFactions
      .slice(0, 2)
      .map((fact) => `${labels.faction}: ${fact.subject} - ${fact.value}`),
    ...context.recentDeltas
      .slice(0, 2)
      .map((delta) => `${labels.recentChange}: ${delta.summary}`),
    context.openHooks.length > 0
      ? `${labels.openHooks}: ${context.openHooks.join("; ")}`
      : null,
  ];

  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

export default async function NewQuestPage({
  params,
  searchParams,
}: NewQuestPageProps) {
  const locale = await getRequestLocale();
  const m = getMessages(locale);
  const { campaignId } = await params;
  const { townId, quick_start, requestId } = await searchParams;
  const isQuickStart = quick_start === "1";

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      tone: true,
      partyLevel: true,
      townProfiles: {
        orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          vibe: true,
          tension: true,
          notes: true,
          questHooks: true,
        },
      },
    },
  });

  if (!campaign) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-500/30 bg-red-500/10 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-300">
            {m.campaignOverview.notFound.eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
            {m.campaignOverview.notFound.title}
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            {m.campaignOverview.notFound.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/campaigns/${campaignId}/canon`}
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              {m.questNew.actions.reviewCanon}
            </Link>
            <Link
              href={`/campaigns/${campaignId}`}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-950"
            >
              {m.questNew.actions.campaignOverview}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const [rawCanonicalEntries, rawCanonFacts, deltas] = await Promise.all([
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

  const legacyCanonFacts = rawCanonFacts.flatMap((fact) => {
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
    legacyCanonFacts.filter((fact) => fact.status === "active"),
  );
  const inferredTownRecord = inferTownFromCanon(campaignId, resolvedCanonFacts);
  const selectedTownRecord =
    campaign.townProfiles.find((town) => town.id === townId) ??
    campaign.townProfiles[0] ??
    inferredTownRecord;

  if (!isQuickStart && !selectedTownRecord) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            {m.questNew.eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
            {campaign.name}
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            {m.questNew.noTown.title}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/campaigns/${campaignId}/canon`}
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              {m.questNew.actions.reviewCanon}
            </Link>
            <Link
              href={`/campaigns/${campaignId}`}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-950"
            >
              {m.questNew.actions.campaignOverview}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const quickStartSeedTown: TownProfile = {
    id: `${campaignId}-quick-start-seed`,
    campaignId,
    name: m.quickStart.seedStatus.placeholderName,
    vibe: null,
    tension: null,
    notes: null,
    questHooks: [],
  };
  const selectedTown = selectedTownRecord
    ? toTownProfile(campaignId, selectedTownRecord)
    : quickStartSeedTown;

  const workingContext = buildTownQuestContext({
    campaignId,
    campaignTone: campaign.tone,
    partyLevel: campaign.partyLevel,
    town: selectedTown,
    canonFacts: isQuickStart ? [] : resolvedCanonFacts,
    deltas: isQuickStart ? [] : deltas,
  });

  const initialValues = isQuickStart
    ? {
        townName: selectedTownRecord?.name ?? "",
        townVibe: selectedTownRecord?.vibe ?? "",
        localTension: selectedTownRecord?.tension ?? workingContext.openHooks[0] ?? "",
        questType: "mixed",
        mainPlotRelation: "",
        desiredLength: "3h",
        extraContext: "",
        requestMode: "quick_start" as const,
      }
    : {
        townName: selectedTown.name,
        townVibe: selectedTown.vibe ?? "",
        localTension: selectedTown.tension ?? workingContext.openHooks[0] ?? "",
        questType: "",
        mainPlotRelation: workingContext.recentDeltas.length > 0 ? "follow-up" : "",
        desiredLength: "standard",
        extraContext: buildExtraContext(workingContext, locale),
        requestMode: "standard" as const,
      };
  const standardQuestHref = townId
    ? `/campaigns/${campaignId}/quests/new?townId=${townId}`
    : `/campaigns/${campaignId}/quests/new`;
  const quickStartHref = townId
    ? `/campaigns/${campaignId}/quests/new?townId=${townId}&quick_start=1`
    : `/campaigns/${campaignId}/quests/new?quick_start=1`;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              {isQuickStart ? m.quickStart.title : m.questNew.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {campaign.name}
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {isQuickStart ? m.quickStart.formIntro : m.questNew.intro}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/campaigns/${campaignId}`}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              {m.questNew.actions.campaignOverview}
            </Link>
            <Link
              href={`/campaigns/${campaignId}/canon`}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              {m.questNew.actions.reviewCanon}
            </Link>
            <Link
              href={isQuickStart ? standardQuestHref : quickStartHref}
              className="rounded-full border border-cyan-500/40 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-slate-900"
            >
              {isQuickStart ? m.quickStart.fullFormCta : m.quickStart.cta}
            </Link>
          </div>
        </div>

        {isQuickStart ? (
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                {m.questNew.sections.partyLevel}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">{campaign.partyLevel}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                {m.quickStart.stats.existingTownSeeds}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {campaign.townProfiles.length}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                {m.quickStart.stats.noSourceRequired}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-200">
                {m.quickStart.description}
              </p>
            </div>
          </section>
        ) : (
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                {m.questNew.stats.selectedTown}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {selectedTown.name}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                {m.questNew.stats.townFacts}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {workingContext.townFacts.length}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                {m.questNew.stats.recentDeltas}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {workingContext.recentDeltas.length}
              </p>
            </div>
          </section>
        )}

        <div className="mt-8">
          <QuestRequestForm
            campaignId={campaignId}
            activeRequestId={requestId}
            mode={isQuickStart ? "quick_start" : "standard"}
            townOptions={campaign.townProfiles.map((town) => ({
              id: town.id,
              name: town.name,
            }))}
            selectedTownId={
              !isQuickStart &&
              campaign.townProfiles.some((town) => town.id === selectedTown.id)
                ? selectedTown.id
                : undefined
            }
            initialValues={initialValues}
            workingContext={workingContext}
          />
        </div>
      </div>
    </main>
  );
}
