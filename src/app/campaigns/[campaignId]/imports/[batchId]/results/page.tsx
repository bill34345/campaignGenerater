import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportResultsSummary } from "@/components/import/import-results-summary";
import { getMessages, getRequestLocale } from "@/lib/i18n/translate";
import { loadImportBatchResultSummary } from "@/lib/imports/result-summary";

type ImportBatchResultsPageProps = {
  params: Promise<{
    campaignId: string;
    batchId: string;
  }>;
};

export default async function ImportBatchResultsPage({
  params,
}: ImportBatchResultsPageProps) {
  const locale = await getRequestLocale();
  const m = getMessages(locale);
  const { campaignId, batchId } = await params;

  const results = await loadImportBatchResultSummary(campaignId, batchId);
  if (!results) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              {m.importWorkbench.entryEyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {m.importWorkbench.resultsTitle}
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {m.importWorkbench.resultsDescription}
            </p>
          </div>
          <Link
            href={`/campaigns/${campaignId}/imports/${batchId}`}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            {m.importWorkbench.openBatch}
          </Link>
        </div>

        <div className="mt-8">
          <ImportResultsSummary
            campaignId={campaignId}
            locale={locale}
            summary={results.summary}
          />
        </div>
      </div>
    </main>
  );
}
