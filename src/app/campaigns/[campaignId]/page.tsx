import Link from "next/link";
import { db } from "@/lib/db";
import { ImportWorkbenchEntry } from "@/components/campaign/import-workbench-entry";
import { getLlmProviderLabel, getLlmSettingsCopy } from "@/lib/i18n/llm-copy";
import { getMessages, getRequestLocale, formatDateForLocale } from "@/lib/i18n/translate";
import { serializeImportBatch } from "@/lib/imports/batch-payload";
import { llmProviderSchema } from "@/types/domain";

type CampaignOverviewPageProps = {
  params: Promise<{
    campaignId: string;
  }>;
};

export default async function CampaignOverviewPage({
  params,
}: CampaignOverviewPageProps) {
  const locale = await getRequestLocale();
  const m = getMessages(locale);
  const settingsCopy = getLlmSettingsCopy(locale);
  const { campaignId } = await params;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      system: true,
      tone: true,
      partyLevel: true,
      contentConstraints: true,
      llmProvider: true,
      llmApiKey: true,
      llmModel: true,
      _count: {
        select: {
          sourceDocuments: true,
          townProfiles: true,
          questDrafts: true,
        },
      },
      importBatches: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        include: {
          files: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
      sourceDocuments: {
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          originalName: true,
          createdAt: true,
        },
        take: 5,
      },
      canonFacts: {
        select: {
          status: true,
        },
      },
      townProfiles: {
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          name: true,
          vibe: true,
          tension: true,
        },
        take: 5,
      },
      questDrafts: {
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          title: true,
          premise: true,
          updatedAt: true,
        },
        take: 5,
      },
    },
  });

  if (!campaign) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            {m.campaignOverview.notFound.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">
            {m.campaignOverview.notFound.title}
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {m.campaignOverview.notFound.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/campaigns/new"
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              {m.campaignOverview.actions.newCampaign}
            </Link>
            <Link
              href="/"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              {m.shared.backHome}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const canonCounts = campaign.canonFacts.reduce(
    (totals, fact) => {
      if (fact.status === "active") {
        totals.active += 1;
      } else if (fact.status === "overridden") {
        totals.overridden += 1;
      } else if (fact.status === "uncertain") {
        totals.uncertain += 1;
      }

      return totals;
    },
    { active: 0, overridden: 0, uncertain: 0 },
  );
  const llmProvider = llmProviderSchema.parse(campaign.llmProvider);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              {m.campaignOverview.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {campaign.name}
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {m.campaignOverview.intro
                .replace("{name}", campaign.name)
                .replace("{system}", campaign.system)
                .replace("{partyLevel}", campaign.partyLevel.toString())
                .replace("{tone}", campaign.tone.toLowerCase())}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              {campaign.contentConstraints
                ? `${m.campaignOverview.contentConstraintsPrefix}${campaign.contentConstraints}`
                : m.campaignOverview.noConstraints}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/campaigns/new"
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              {m.campaignOverview.actions.newCampaign}
            </Link>
            <Link
              href={`/campaigns/${campaignId}/canon`}
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              {m.campaignOverview.actions.openCanonReview}
            </Link>
            <Link
              href={`/campaigns/${campaignId}/quests/new`}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              {m.campaignOverview.actions.requestQuest}
            </Link>
            <Link
              href={`/campaigns/${campaignId}/quests/new?quick_start=1`}
              className="rounded-full border border-cyan-500/40 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-slate-900"
            >
              {m.quickStart.cta}
            </Link>
            <Link
              href={`/campaigns/${campaignId}/settings/llm`}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              {settingsCopy.overviewButton}
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              {m.campaignOverview.stats.importedFiles}
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{campaign._count.sourceDocuments}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              {m.campaignOverview.stats.activeCanon}
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{canonCounts.active}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              {m.campaignOverview.stats.currentTowns}
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{campaign._count.townProfiles}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
              {m.campaignOverview.stats.recentQuests}
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{campaign._count.questDrafts}</p>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              {m.quickStart.title}
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {m.quickStart.description}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {campaign._count.sourceDocuments > 0
                ? m.quickStart.seededHint.replace(
                    "{count}",
                    campaign._count.townProfiles.toString(),
                  )
                : m.quickStart.emptyHint}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/campaigns/${campaignId}/quests/new?quick_start=1`}
                data-testid="quick-start-cta"
                className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                {m.quickStart.cta}
              </Link>
              <Link
                href={`/campaigns/${campaignId}/quests/new`}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              >
                {m.campaignOverview.actions.requestQuest}
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              {m.quickStart.spotlightTitle}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {m.quickStart.spotlight.noCanon.title}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {m.quickStart.spotlight.noCanon.description}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {m.quickStart.spotlight.fastSetup.title}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {m.quickStart.spotlight.fastSetup.description}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {m.quickStart.spotlight.sameEditor.title}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {m.quickStart.spotlight.sameEditor.description}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <ImportWorkbenchEntry
            campaignId={campaignId}
            latestBatch={
              campaign.importBatches[0]
                ? {
                    id: campaign.importBatches[0].id,
                    status: campaign.importBatches[0].status,
                    createdAt: campaign.importBatches[0].createdAt.toISOString(),
                    summary: serializeImportBatch(campaign.importBatches[0]).summary,
                  }
                : null
            }
          />
          <p className="mt-3 text-sm text-slate-400">
            {campaign.canonFacts.length > 0
              ? m.campaignOverview.empty.canonReady
              : m.quickStart.emptyHint}
          </p>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">
                {m.campaignOverview.sections.importedFiles}
              </h2>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {m.campaignOverview.sections.latest}
              </span>
            </div>
            {campaign.sourceDocuments.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {campaign.sourceDocuments.map((document) => (
                  <li
                    key={document.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-slate-100">{document.originalName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateForLocale(locale, document.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-7 text-slate-400">
                {m.campaignOverview.empty.importedFiles}
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">
                {m.campaignOverview.sections.canonReviewStatus}
              </h2>
              <Link
                href={`/campaigns/${campaignId}/canon`}
                className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
              >
                {m.campaignOverview.actions.reviewCanon}
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
                  {m.campaignOverview.sections.active}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{canonCounts.active}</p>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300">
                  {m.campaignOverview.sections.uncertain}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{canonCounts.uncertain}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {m.campaignOverview.sections.overridden}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{canonCounts.overridden}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">{settingsCopy.overviewCardTitle}</h2>
              <Link
                href={`/campaigns/${campaignId}/settings/llm`}
                className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
              >
                {settingsCopy.overviewButton}
              </Link>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
              <p className="text-sm font-medium text-slate-100">
                {getLlmProviderLabel(llmProvider, locale)}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {campaign.llmApiKey
                  ? `••••${campaign.llmApiKey.slice(-4)}`
                  : settingsCopy.noKey}
              </p>
              {campaign.llmModel ? (
                <p className="mt-2 text-xs text-slate-500">{campaign.llmModel}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">
                {m.campaignOverview.sections.currentTowns}
              </h2>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {m.campaignOverview.sections.latest}
              </span>
            </div>
            {campaign.townProfiles.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {campaign.townProfiles.map((town) => (
                  <li
                    key={town.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-slate-100">{town.name}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {town.vibe ?? m.campaignOverview.empty.townVibe}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {town.tension ?? m.campaignOverview.empty.townTension}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-7 text-slate-400">
                {m.campaignOverview.empty.towns}
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">
                {m.campaignOverview.sections.recentQuestDrafts}
              </h2>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {m.campaignOverview.sections.latest}
              </span>
            </div>
            {campaign.questDrafts.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {campaign.questDrafts.map((draft) => (
                  <li
                    key={draft.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-slate-100">
                      <Link
                        href={`/campaigns/${campaignId}/quests/${draft.id}`}
                        className="transition hover:text-cyan-300"
                      >
                        {draft.title}
                      </Link>
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{draft.premise}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateForLocale(locale, draft.updatedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-7 text-slate-400">
                {m.campaignOverview.empty.quests}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
