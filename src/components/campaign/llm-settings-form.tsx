"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/language-provider";
import { getLlmProviderLabel, getLlmSettingsCopy } from "@/lib/i18n/llm-copy";
import type { CampaignLlmSettings, LlmProvider } from "@/types/domain";

type LlmSettingsFormProps = {
  campaignId: string;
  initialSettings: CampaignLlmSettings;
};

type SettingsResponse = {
  settings?: CampaignLlmSettings;
  error?: string;
};

type TestResponse = {
  ok?: boolean;
  result?: {
    provider: LlmProvider;
    model: string;
  };
  error?: string;
};

export function LlmSettingsForm({
  campaignId,
  initialSettings,
}: LlmSettingsFormProps) {
  const router = useRouter();
  const { locale } = useLanguage();
  const [settings, setSettings] = useState<CampaignLlmSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const copy = getLlmSettingsCopy(locale);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/llm-settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = (await response.json()) as SettingsResponse;
      if (!response.ok || !payload.settings) {
        setError(payload.error ?? copy.failed);
        return;
      }

      setSettings(payload.settings);
      setSuccess(copy.saved);
      router.refresh();
    } catch {
      setError(copy.failed);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    setIsTesting(true);
    setError(null);
    setTestStatus(null);

    try {
      const saveResponse = await fetch(`/api/campaigns/${campaignId}/llm-settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const savePayload = (await saveResponse.json()) as SettingsResponse;
      if (!saveResponse.ok || !savePayload.settings) {
        setError(savePayload.error ?? copy.failed);
        return;
      }

      setSettings(savePayload.settings);

      const response = await fetch(`/api/campaigns/${campaignId}/llm-settings/test`, {
        method: "POST",
      });
      const payload = (await response.json()) as TestResponse;
      if (!response.ok || !payload.ok || !payload.result) {
        setError(payload.error ?? copy.testFailed);
        return;
      }

      setTestStatus(
        copy.testSuccess
          .replace("{provider}", getLlmProviderLabel(payload.result.provider, locale))
          .replace("{model}", payload.result.model),
      );
    } catch {
      setError(copy.testFailed);
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          {copy.title}
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-300">{copy.description}</p>
      </div>

      <div className="mt-6 grid gap-6">
        <div>
          <label className="text-sm font-semibold text-slate-100" htmlFor="llm-provider">
            {copy.provider}
          </label>
          <select
            id="llm-provider"
            value={settings.llmProvider}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                llmProvider: event.target.value as LlmProvider,
              }))
            }
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
          >
            {(["openai_responses", "openai_chat", "anthropic"] as const).map((provider) => (
              <option key={provider} value={provider}>
                {getLlmProviderLabel(provider, locale)}
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-slate-400">{copy.hints[settings.llmProvider]}</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-100" htmlFor="llm-api-key">
            {copy.apiKey}
          </label>
          <input
            id="llm-api-key"
            type="password"
            value={settings.llmApiKey ?? ""}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                llmApiKey: event.target.value,
              }))
            }
            placeholder={copy.apiKeyPlaceholder}
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-100" htmlFor="llm-model">
              {copy.model}
            </label>
            <input
              id="llm-model"
              value={settings.llmModel ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  llmModel: event.target.value,
                }))
              }
              placeholder={copy.modelPlaceholder}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-100" htmlFor="llm-base-url">
              {copy.baseUrl}
            </label>
            <input
              id="llm-base-url"
              value={settings.llmBaseUrl ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  llmBaseUrl: event.target.value,
                }))
              }
              placeholder={copy.baseUrlPlaceholder}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </div>
        </div>
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
      {testStatus ? (
        <p className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
          {testStatus}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-900 disabled:text-slate-300"
        >
          {isSaving ? copy.saving : copy.save}
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={isTesting || isSaving}
          className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-950 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
        >
          {isTesting ? copy.testing : copy.test}
        </button>
      </div>
    </section>
  );
}
