import Link from "next/link";
import { getMessages } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locales";
import type { ImportBatchResultSummary } from "@/lib/imports/result-summary";

type ImportResultsSummaryProps = {
  campaignId: string;
  locale: Locale;
  summary: ImportBatchResultSummary;
};

export function ImportResultsSummary({
  campaignId,
  locale,
  summary,
}: ImportResultsSummaryProps) {
  const m = getMessages(locale);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          {m.importWorkbench.resultsTitle}
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          {m.importWorkbench.resultsDescription}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
            {m.importWorkbench.successCount}
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{summary.successCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-red-300">
            {m.importWorkbench.failureCount}
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{summary.failureCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
            {m.importWorkbench.candidateFactCount}
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{summary.candidateFactCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">
            {m.importWorkbench.conflictCount}
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{summary.conflictCount}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">
          {m.importWorkbench.conflictHeavySubjects}
        </h2>
        {summary.conflictSubjects.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {summary.conflictSubjects.map((subject) => (
              <li
                key={subject}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-200"
              >
                {subject}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm leading-7 text-slate-400">{m.shared.noData}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/campaigns/${campaignId}/canon`}
          data-testid="open-canon-inbox"
          className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          {m.importWorkbench.openCanonInbox}
        </Link>
        <Link
          href={`/campaigns/${campaignId}`}
          className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
        >
          {m.importWorkbench.backToOverview}
        </Link>
      </div>
    </section>
  );
}
