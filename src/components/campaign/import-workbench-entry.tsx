"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImportDropzone } from "@/components/import/import-dropzone";
import { useLanguage } from "@/components/i18n/language-provider";
import {
  DEFAULT_SOURCE_TYPE,
  SOURCE_TYPES,
  getSourceTypeLabel,
  type SourceType,
} from "@/lib/imports/source-type";

type LatestBatchSummary = {
  id: string;
  status: string;
  createdAt: string;
  summary: {
    ready: boolean;
    stagedFileCount: number;
    failedFileCount: number;
    warningCount: number;
  };
};

type ImportWorkbenchEntryProps = {
  campaignId: string;
  latestBatch?: LatestBatchSummary | null;
};

export function ImportWorkbenchEntry({
  campaignId,
  latestBatch,
}: ImportWorkbenchEntryProps) {
  const router = useRouter();
  const { locale, messages: m } = useLanguage();
  const [defaultSourceType, setDefaultSourceType] =
    useState<SourceType>(DEFAULT_SOURCE_TYPE);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateBatch(files: File[]) {
    setError(null);

    const formData = new FormData();
    formData.set("defaultSourceType", defaultSourceType);
    for (const file of files) {
      formData.append("files", file);
    }

    const response = await fetch(`/api/campaigns/${campaignId}/imports`, {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as {
      batch?: { id: string };
      error?: string;
    };

    if (!response.ok || !payload.batch) {
      setError(payload.error ?? m.importWorkbench.errors.createFailed);
      return;
    }

    router.push(`/campaigns/${campaignId}/imports/${payload.batch.id}`);
  }

  const latestHref =
    latestBatch?.status === "completed"
      ? `/campaigns/${campaignId}/imports/${latestBatch.id}/results`
      : latestBatch
        ? `/campaigns/${campaignId}/imports/${latestBatch.id}`
        : null;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            {m.importWorkbench.entryEyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {m.importWorkbench.entryTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {m.importWorkbench.entryDescription}
          </p>
        </div>

        <div className="min-w-[260px] rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {m.importWorkbench.latestBatchTitle}
          </p>
          {latestBatch ? (
            <>
              <p className="mt-3 text-sm font-medium text-slate-100">
                {new Date(latestBatch.createdAt).toLocaleString(
                  locale === "zh" ? "zh-CN" : "en-US",
                )}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {latestBatch.summary.ready
                  ? m.importWorkbench.latestBatchReady
                  : m.importWorkbench.latestBatchBlocked}
              </p>
              <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                <span>{m.importWorkbench.stagedFiles}: {latestBatch.summary.stagedFileCount}</span>
                <span>{m.importWorkbench.failedFiles}: {latestBatch.summary.failedFileCount}</span>
                <span>{m.importWorkbench.warnings}: {latestBatch.summary.warningCount}</span>
              </div>
              {latestHref ? (
                <Link
                  href={latestHref}
                  className="mt-4 inline-flex text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
                >
                  {latestBatch.status === "completed"
                    ? m.importWorkbench.openResults
                    : m.importWorkbench.openBatch}
                </Link>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {m.importWorkbench.latestBatchEmpty}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 max-w-sm">
        <label
          htmlFor="import-default-source-type"
          className="text-sm font-semibold text-slate-100"
        >
          {m.importWorkbench.defaultSourceTypeLabel}
        </label>
        <select
          id="import-default-source-type"
          value={defaultSourceType}
          onChange={(event) => setDefaultSourceType(event.target.value as SourceType)}
          className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        >
          {SOURCE_TYPES.map((sourceType) => (
            <option key={sourceType} value={sourceType}>
              {getSourceTypeLabel(locale, sourceType)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <ImportDropzone
          title={m.importWorkbench.dropzoneLabel}
          description={m.importWorkbench.dropzoneHelper}
          actionLabel={m.importWorkbench.createBatchButton}
          busyLabel={m.importWorkbench.createBatchLoading}
          actionTestId="create-import-batch"
          onSubmit={handleCreateBatch}
        />
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}
