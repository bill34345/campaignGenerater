"use client";

import { FormEvent, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import type { ApiErrorCode } from "@/lib/i18n/messages";

type DocumentUploadFormProps = {
  campaignId: string;
};

type UploadResponse = {
  errorCode?: ApiErrorCode;
  sourceDocument?: {
    id: string;
    originalName: string;
  };
  canonFacts?: Array<{
    id: string;
  }>;
  error?: string;
};

export function DocumentUploadForm({ campaignId }: DocumentUploadFormProps) {
  const { messages: m } = useLanguage();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError(m.documentUpload.noFile);
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/documents`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as UploadResponse;

      if (!response.ok || !payload.sourceDocument) {
        const errorCode = payload.errorCode;
        setError((errorCode && m.apiErrors[errorCode]) || payload.error || m.documentUpload.failed);
        return;
      }

      setSuccess(
        payload.canonFacts && payload.canonFacts.length > 0
          ? `${payload.sourceDocument.originalName} ${m.documentUpload.successReady}`
          : `${payload.sourceDocument.originalName} ${m.documentUpload.successPlain}`,
      );

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch {
      setError(m.documentUpload.failed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6"
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[260px] flex-1">
          <label
            htmlFor="campaign-upload"
            className="text-sm font-semibold text-slate-100"
          >
            {m.documentUpload.label}
          </label>
          <input
            ref={inputRef}
            id="campaign-upload"
            name="file"
            type="file"
            accept=".txt,.md,.docx,.pdf"
            className="mt-2 block w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-900 disabled:text-slate-300"
        >
          {isSubmitting ? m.documentUpload.loading : m.documentUpload.button}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </p>
      ) : null}
    </form>
  );
}
