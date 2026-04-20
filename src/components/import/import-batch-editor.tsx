"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ImportDropzone } from "@/components/import/import-dropzone";
import { useLanguage } from "@/components/i18n/language-provider";
import type { ImportBatch } from "@/types/domain";
import type { DuplicateStagedFileGroup } from "@/lib/imports/staging";
import {
  SOURCE_TYPES,
  getSourceTypeLabel,
  type SourceType,
} from "@/lib/imports/source-type";

type EditableImportBatchFile = ImportBatch["files"][number] & {
  warnings?: Array<{
    code: "duplicate_checksum";
    checksum: string;
    fileNames: string[];
  }>;
};

type ImportBatchSummary = {
  ready: boolean;
  stagedFileCount: number;
  failedFileCount: number;
  warningCount: number;
  duplicateChecksums: DuplicateStagedFileGroup[];
};

type ImportBatchEditorProps = {
  campaignId: string;
  batchId: string;
  initialBatch: Omit<ImportBatch, "files"> & {
    files: EditableImportBatchFile[];
  };
  initialSummary: ImportBatchSummary;
};

type BatchResponse = {
  batch: Omit<ImportBatch, "files"> & {
    files: EditableImportBatchFile[];
  };
  summary: ImportBatchSummary;
  error?: string;
};

function statusTone(status: string) {
  switch (status) {
    case "completed":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "failed":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    case "processing":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "ready":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
    default:
      return "border-slate-700 bg-slate-900/70 text-slate-300";
  }
}

export function ImportBatchEditor({
  campaignId,
  batchId,
  initialBatch,
  initialSummary,
}: ImportBatchEditorProps) {
  const router = useRouter();
  const { locale, messages: m } = useLanguage();
  const [batch, setBatch] = useState(initialBatch);
  const [summary, setSummary] = useState(initialSummary);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const sortedFiles = useMemo(
    () => [...batch.files].sort((left, right) => left.originalName.localeCompare(right.originalName)),
    [batch.files],
  );

  async function applyResponse(response: Response, fallbackError: string) {
    const payload = (await response.json()) as BatchResponse & {
      resultsUrl?: string;
    };

    if (!response.ok || !payload.batch || !payload.summary) {
      setError(payload.error ?? fallbackError);
      return null;
    }

    setBatch(payload.batch);
    setSummary(payload.summary);
    setError(null);
    return payload;
  }

  async function sendJsonUpdate(body: Record<string, unknown>) {
    setIsBusy(true);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/imports/${batchId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      await applyResponse(response, m.importWorkbench.errors.updateFailed);
    } finally {
      setIsBusy(false);
    }
  }

  async function appendFiles(files: File[]) {
    setIsBusy(true);
    try {
      const formData = new FormData();
      formData.set("defaultSourceType", batch.defaultSourceType);
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch(
        `/api/campaigns/${campaignId}/imports/${batchId}`,
        {
          method: "PATCH",
          body: formData,
        },
      );

      await applyResponse(response, m.importWorkbench.errors.updateFailed);
    } finally {
      setIsBusy(false);
    }
  }

  async function startExtraction() {
    setIsBusy(true);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/imports/${batchId}/process`,
        {
          method: "POST",
        },
      );

      const payload = await applyResponse(
        response,
        m.importWorkbench.errors.processFailed,
      );

      if (payload?.resultsUrl) {
        router.push(payload.resultsUrl);
      }
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              {m.importWorkbench.batchEditorTitle}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {m.importWorkbench.batchEditorDescription}
            </p>
          </div>
          <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(batch.status)}`}>
            {m.importWorkbench.status[batch.status as keyof typeof m.importWorkbench.status] ?? batch.status}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {m.importWorkbench.stagedFiles}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.stagedFileCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {m.importWorkbench.failedFiles}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.failedFileCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {m.importWorkbench.warnings}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.warningCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {m.importWorkbench.defaultSourceTypeLabel}
            </label>
            <select
              value={batch.defaultSourceType}
              disabled={isBusy || batch.status === "completed"}
              onChange={(event) =>
                void sendJsonUpdate({
                  defaultSourceType: event.target.value,
                })
              }
              className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              {SOURCE_TYPES.map((sourceType) => (
                <option key={sourceType} value={sourceType}>
                  {getSourceTypeLabel(locale, sourceType)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <ImportDropzone
        title={m.importWorkbench.appendFilesTitle}
        description={m.importWorkbench.dropzoneHelper}
        actionLabel={m.importWorkbench.appendFilesButton}
        busyLabel={m.importWorkbench.appendFilesLoading}
        actionTestId="append-import-files"
        disabled={batch.status === "completed" || isBusy}
        onSubmit={appendFiles}
      />

      <div className="grid gap-4">
        {sortedFiles.map((file) => (
          <article
            key={file.id}
            className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white">{file.originalName}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(file.status)}`}>
                    {m.importWorkbench.status[file.status as keyof typeof m.importWorkbench.status] ?? file.status}
                  </span>
                  {file.warnings?.length ? (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                      {m.importWorkbench.warnings}: {file.warnings.length}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={file.sourceType}
                  disabled={isBusy || batch.status === "completed"}
                  onChange={(event) =>
                    void sendJsonUpdate({
                      fileSourceTypes: [
                        {
                          fileId: file.id,
                          sourceType: event.target.value as SourceType,
                        },
                      ],
                    })
                  }
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  {SOURCE_TYPES.map((sourceType) => (
                    <option key={sourceType} value={sourceType}>
                      {getSourceTypeLabel(locale, sourceType)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isBusy || batch.status === "completed"}
                  onClick={() =>
                    void sendJsonUpdate({
                      removeFileIds: [file.id],
                    })
                  }
                  className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                >
                  {m.importWorkbench.removeFile}
                </button>
              </div>
            </div>

            {file.errorMessage ? (
              <p className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {file.errorMessage}
              </p>
            ) : null}

            {file.warnings?.length ? (
              <ul className="mt-4 space-y-2 text-sm text-amber-200">
                {file.warnings.map((warning) => (
                  <li
                    key={`${file.id}-${warning.checksum}`}
                    className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
                  >
                    {warning.fileNames.join(", ")}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="max-w-2xl text-sm leading-7 text-slate-300">
          {summary.ready ? m.importWorkbench.latestBatchReady : m.importWorkbench.latestBatchBlocked}
        </div>
        <div className="flex flex-wrap gap-3">
          {batch.status === "completed" ? (
            <Link
              href={`/campaigns/${campaignId}/imports/${batchId}/results`}
              className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              {m.importWorkbench.openResults}
            </Link>
          ) : (
            <button
              type="button"
              data-testid="start-extraction"
              disabled={!summary.ready || isBusy}
              onClick={() => void startExtraction()}
              className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-900 disabled:text-slate-300"
            >
              {isBusy ? m.importWorkbench.processing : m.importWorkbench.startExtraction}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
