import Link from "next/link";
import { db } from "@/lib/db";
import { mergeCanonFacts } from "@/lib/canon/merge";
import { CanonReviewTable } from "@/components/canon/canon-review-table";
import { getMessages, getRequestLocale } from "@/lib/i18n/translate";

type CanonReviewPageProps = {
  params: Promise<{
    campaignId: string;
  }>;
};

export default async function CanonReviewPage({
  params,
}: CanonReviewPageProps) {
  const locale = await getRequestLocale();
  const m = getMessages(locale);
  const { campaignId } = await params;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!campaign) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            {m.canonReview.notFound.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">
            {m.canonReview.notFound.title}
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {m.canonReview.notFound.description}
          </p>
        </div>
      </main>
    );
  }

  const facts = await db.canonFact.findMany({
    where: { campaignId },
    orderBy: [{ subject: "asc" }, { factType: "asc" }, { priority: "desc" }],
  });

  const merged = mergeCanonFacts(facts);
  const factGroupCount = merged.groups.reduce(
    (total, group) => total + group.factGroups.length,
    0,
  );

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              {m.canonReview.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {campaign.name}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              {m.canonReview.intro}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/campaigns/${campaignId}/quests/new`}
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              {m.canonReview.actions.requestQuest}
            </Link>
            <Link
              href={`/campaigns/${campaignId}`}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              {m.canonReview.actions.campaignOverview}
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              {m.canonReview.stats.entities}
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {merged.groups.length}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              {m.canonReview.stats.factGroups}
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {factGroupCount}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              {m.canonReview.stats.candidates}
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {merged.allFacts.length}
            </p>
          </div>
        </section>

        <section className="mt-8">
          <CanonReviewTable
            campaignId={campaignId}
            initialGroups={merged.groups}
          />
        </section>
      </div>
    </main>
  );
}
