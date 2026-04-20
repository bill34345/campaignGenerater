"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import type { ApiErrorCode } from "@/lib/i18n/messages";
import type { QuestRequest } from "@/types/domain";
import type { TownQuestContext } from "@/lib/canon/context-builder";

type QuestRequestFormValues = Pick<
  QuestRequest,
  | "townName"
  | "townVibe"
  | "localTension"
  | "questType"
  | "mainPlotRelation"
  | "desiredLength"
  | "extraContext"
>;

type QuestRequestFormProps = {
  campaignId: string;
  townOptions: Array<{
    id: string;
    name: string;
  }>;
  selectedTownId?: string;
  initialValues: QuestRequestFormValues;
  workingContext: TownQuestContext;
};

type QuestResponse =
  | {
      draft: {
        id: string;
      };
    }
  | {
      errorCode?: ApiErrorCode;
      error?: string;
    };

function renderFactSummary(summary: string, fallback: string) {
  return summary.trim().length > 0 ? summary : fallback;
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function QuestRequestForm({
  campaignId,
  townOptions,
  selectedTownId,
  initialValues,
  workingContext,
}: QuestRequestFormProps) {
  const { locale, messages: m } = useLanguage();
  const [townName, setTownName] = useState(initialValues.townName);
  const [townVibe, setTownVibe] = useState(initialValues.townVibe ?? "");
  const [localTension, setLocalTension] = useState(
    initialValues.localTension ?? "",
  );
  const [questType, setQuestType] = useState(initialValues.questType ?? "");
  const [mainPlotRelation, setMainPlotRelation] = useState(
    initialValues.mainPlotRelation ?? "",
  );
  const [desiredLength, setDesiredLength] = useState(
    initialValues.desiredLength ?? "standard",
  );
  const [extraContext, setExtraContext] = useState(
    initialValues.extraContext ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);

  const deltaRows = useMemo(
    () =>
      workingContext.recentDeltas.map((delta) => ({
        ...delta,
        createdAt: new Date(delta.createdAt),
      })),
    [workingContext.recentDeltas],
  );
  const npcFallback = locale === "zh" ? "暂无 NPC 摘要。" : "No NPC summary recorded.";
  const factionFallback =
    locale === "zh" ? "暂无阵营摘要。" : "No faction summary recorded.";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setDraftId(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/quests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          townProfileId: selectedTownId ?? null,
          townName: townName.trim(),
          townVibe: normalizeOptionalText(townVibe),
          localTension: normalizeOptionalText(localTension),
          questType: normalizeOptionalText(questType),
          mainPlotRelation: normalizeOptionalText(mainPlotRelation),
          desiredLength: normalizeOptionalText(desiredLength),
          extraContext: normalizeOptionalText(extraContext),
          locale,
        }),
      });

      const payload = (await response.json()) as QuestResponse;

      if (!response.ok || !("draft" in payload)) {
        const errorCode = "errorCode" in payload ? payload.errorCode : undefined;
        const responseError = "error" in payload ? payload.error : undefined;
        setError(
          (errorCode && m.apiErrors[errorCode]) ||
            responseError ||
            m.questRequest.errors.generationFailed,
        );
        return;
      }

      setDraftId(payload.draft.id);
    } catch {
      setError(m.questRequest.errors.generationFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/20"
      >
        <div className="grid gap-6">
          {townOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {townOptions.map((town) => {
                const isActive = town.id === selectedTownId;

                return (
                  <Link
                    key={town.id}
                    href={`/campaigns/${campaignId}/quests/new?townId=${town.id}`}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                      isActive
                        ? "bg-cyan-400 text-slate-950"
                      : "border border-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-950"
                    }`}
                  >
                    {town.name}
                  </Link>
                );
              })}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="town-name"
              className="text-sm font-semibold text-slate-100"
            >
              {m.questRequest.labels.townName}
            </label>
            <input
              id="town-name"
              name="townName"
              value={townName}
              onChange={(event) => setTownName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </div>

          <div>
            <label
              htmlFor="town-vibe"
              className="text-sm font-semibold text-slate-100"
            >
              {m.questRequest.labels.townVibe}
            </label>
            <textarea
              id="town-vibe"
              name="townVibe"
              rows={3}
              value={townVibe}
              onChange={(event) => setTownVibe(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
              placeholder={m.questRequest.placeholders.townVibe}
            />
          </div>

          <div>
            <label
              htmlFor="local-tension"
              className="text-sm font-semibold text-slate-100"
            >
              {m.questRequest.labels.localTension}
            </label>
            <textarea
              id="local-tension"
              name="localTension"
              rows={3}
              value={localTension}
              onChange={(event) => setLocalTension(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
              placeholder={m.questRequest.placeholders.localTension}
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <label
                htmlFor="quest-type"
                className="text-sm font-semibold text-slate-100"
              >
                {m.questRequest.labels.questType}
              </label>
              <select
                id="quest-type"
                name="questType"
                value={questType}
                onChange={(event) => setQuestType(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              >
                <option value="">{m.questRequest.options.chooseFocus}</option>
                <option value="investigation">{m.questRequest.options.investigation}</option>
                <option value="social">{m.questRequest.options.social}</option>
                <option value="combat">{m.questRequest.options.combat}</option>
                <option value="exploration">{m.questRequest.options.exploration}</option>
                <option value="mixed">{m.questRequest.options.mixed}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="main-plot-relation"
                className="text-sm font-semibold text-slate-100"
              >
                {m.questRequest.labels.mainPlotRelation}
              </label>
              <select
                id="main-plot-relation"
                name="mainPlotRelation"
                value={mainPlotRelation}
                onChange={(event) => setMainPlotRelation(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              >
                <option value="">{m.questRequest.options.chooseConnection}</option>
                <option value="standalone">{m.questRequest.options.standalone}</option>
                <option value="foreshadow">{m.questRequest.options.foreshadow}</option>
                <option value="follow-up">{m.questRequest.options.followUp}</option>
                <option value="reveal">{m.questRequest.options.reveal}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="desired-length"
                className="text-sm font-semibold text-slate-100"
              >
                {m.questRequest.labels.desiredLength}
              </label>
              <select
                id="desired-length"
                name="desiredLength"
                value={desiredLength}
                onChange={(event) => setDesiredLength(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              >
                <option value="">{m.questRequest.options.chooseScope}</option>
                <option value="short">{m.questRequest.options.short}</option>
                <option value="standard">{m.questRequest.options.standard}</option>
                <option value="long">{m.questRequest.options.long}</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="extra-context"
              className="text-sm font-semibold text-slate-100"
            >
              {m.questRequest.labels.extraContext}
            </label>
            <textarea
              id="extra-context"
              name="extraContext"
              rows={10}
              value={extraContext}
              onChange={(event) => setExtraContext(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
              placeholder={m.questRequest.placeholders.extraContext}
            />
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {draftId ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <p>{m.questRequest.draftReady}</p>
            <Link
              href={`/campaigns/${campaignId}/quests/${draftId}`}
              className="mt-2 inline-flex text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
            >
              {m.questRequest.openDraft}
            </Link>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm leading-6 text-slate-400">
            {m.questRequest.helper}
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-900 disabled:text-slate-300"
          >
            {isSubmitting ? m.questRequest.loading : m.questRequest.button}
          </button>
        </div>
      </form>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            {m.questNew.sections.workingContext}
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            {m.questNew.sections.tone}: {workingContext.campaignTone}
          </p>
          <p className="text-sm leading-7 text-slate-300">
            {m.questNew.sections.partyLevel}: {workingContext.partyLevel}
          </p>
          <p className="text-sm leading-7 text-slate-300">
            {m.questNew.sections.openHooks}: {workingContext.openHooks.length}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
            {m.questNew.sections.relevantNpcs}
          </p>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            {workingContext.relevantNpcs.length > 0 ? (
              workingContext.relevantNpcs.map((fact) => (
                <li key={fact.id ?? `${fact.subject}-${fact.value}`}>
                  <p className="font-medium text-slate-100">{fact.subject}</p>
                  <p className="mt-1 text-slate-400">
                    {renderFactSummary(fact.value, npcFallback)}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-slate-400">{m.questNew.sections.noNpcs}</li>
            )}
          </ul>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
            {m.questNew.sections.relevantFactions}
          </p>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            {workingContext.relevantFactions.length > 0 ? (
              workingContext.relevantFactions.map((fact) => (
                <li key={fact.id ?? `${fact.subject}-${fact.value}`}>
                  <p className="font-medium text-slate-100">{fact.subject}</p>
                  <p className="mt-1 text-slate-400">
                    {renderFactSummary(fact.value, factionFallback)}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-slate-400">{m.questNew.sections.noFactions}</li>
            )}
          </ul>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
            {m.questNew.sections.recentDeltas}
          </p>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            {deltaRows.length > 0 ? (
              deltaRows.map((delta) => (
                <li key={delta.id}>
                  <p className="font-medium text-slate-100">{delta.summary}</p>
                  <p className="mt-1 text-slate-500">
                    {delta.createdAt.toLocaleDateString(
                      locale === "zh" ? "zh-CN" : "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-slate-400">{m.questNew.sections.noDeltas}</li>
            )}
          </ul>
        </div>
      </aside>
    </section>
  );
}
