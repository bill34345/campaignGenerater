"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/language-provider";
import type { ApiErrorCode } from "@/lib/i18n/messages";

type CampaignResponse = {
  campaign: {
    id: string;
  };
};

type CampaignErrorResponse = {
  errorCode?: ApiErrorCode;
  error?: string;
};

export function CampaignForm() {
  const router = useRouter();
  const { messages: m } = useLanguage();
  const [name, setName] = useState("");
  const [tone, setTone] = useState("");
  const [partyLevel, setPartyLevel] = useState("1");
  const [contentConstraints, setContentConstraints] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name,
          system: "5e",
          tone,
          partyLevel: Number(partyLevel),
          contentConstraints,
        }),
      });

      const payload = (await response.json()) as
        | CampaignResponse
        | CampaignErrorResponse;

      if (!response.ok || !("campaign" in payload)) {
        const errorCode = "errorCode" in payload ? payload.errorCode : undefined;
        const responseError = "error" in payload ? payload.error : undefined;
        setError(
          (errorCode && m.apiErrors[errorCode]) ||
            responseError ||
            m.campaignForm.errors.failed,
        );
        return;
      }

      router.push(`/campaigns/${payload.campaign.id}`);
      router.refresh();
    } catch {
      setError(m.campaignForm.errors.failed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/20"
    >
      <div className="grid gap-6">
        <div>
          <label
            htmlFor="campaign-name"
            className="text-sm font-semibold text-slate-100"
          >
            {m.campaignForm.labels.campaignName}
          </label>
          <input
            id="campaign-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={m.campaignForm.placeholders.campaignName}
            required
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor="campaign-system"
              className="text-sm font-semibold text-slate-100"
            >
              {m.campaignForm.labels.system}
            </label>
            <input
              id="campaign-system"
              name="system"
              value="5e"
              disabled
              readOnly
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-medium text-cyan-200"
            />
          </div>
          <div>
            <label
              htmlFor="campaign-party-level"
              className="text-sm font-semibold text-slate-100"
            >
              {m.campaignForm.labels.partyLevel}
            </label>
            <input
              id="campaign-party-level"
              name="partyLevel"
              type="number"
              min={1}
              max={20}
              value={partyLevel}
              onChange={(event) => setPartyLevel(event.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="campaign-tone"
            className="text-sm font-semibold text-slate-100"
          >
            {m.campaignForm.labels.tone}
          </label>
          <input
            id="campaign-tone"
            name="tone"
            value={tone}
            onChange={(event) => setTone(event.target.value)}
            placeholder={m.campaignForm.placeholders.tone}
            required
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
          />
        </div>

        <div>
          <label
            htmlFor="campaign-constraints"
            className="text-sm font-semibold text-slate-100"
          >
            {m.campaignForm.labels.contentConstraints}
          </label>
          <textarea
            id="campaign-constraints"
            name="contentConstraints"
            value={contentConstraints}
            onChange={(event) => setContentConstraints(event.target.value)}
            placeholder={m.campaignForm.placeholders.contentConstraints}
            rows={4}
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
          />
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm leading-6 text-slate-400">
          {m.campaignForm.helper}
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-900 disabled:text-slate-300"
        >
          {isSubmitting ? m.campaignForm.saving : m.campaignForm.button}
        </button>
      </div>
    </form>
  );
}
