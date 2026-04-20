"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GmPacketPreview } from "@/components/quests/gm-packet-preview";
import { useLanguage } from "@/components/i18n/language-provider";
import { getLlmProviderLabel, getQuestGenerationCopy, getQuestGenerationStatusLabel } from "@/lib/i18n/llm-copy";
import type { ApiErrorCode } from "@/lib/i18n/messages";
import type { QuestDraft } from "@/types/domain";

type QuestEditorProps = {
  campaignId: string;
  questId: string;
  initialDraft: QuestDraft;
};

function getGenerationTone(mode: QuestDraft["generationMode"]) {
  if (mode === "openai" || mode === "provider") {
    return "border-cyan-400/40 bg-cyan-400/10 text-cyan-100";
  }

  if (mode === "fallback") {
    return "border-amber-400/40 bg-amber-400/10 text-amber-100";
  }

  return "border-slate-700 bg-slate-950/80 text-slate-200";
}

function updateItem<T>(items: T[], index: number, nextValue: T) {
  return items.map((item, itemIndex) => (itemIndex === index ? nextValue : item));
}

export function QuestEditor({
  campaignId,
  questId,
  initialDraft,
}: QuestEditorProps) {
  const router = useRouter();
  const { locale, messages: m } = useLanguage();
  const [draft, setDraft] = useState(initialDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const copy = getQuestGenerationCopy(locale);
  const isProviderDraft =
    draft.generationMode === "provider" || draft.generationMode === "openai";
  const generationStatusLabel = getQuestGenerationStatusLabel(draft, locale);
  const generationStatusTone = getGenerationTone(draft.generationMode);
  const generationSummary = isProviderDraft
    ? copy.providerSummary
    : draft.generationMode === "fallback"
      ? copy.fallbackSummary
      : copy.unknownSummary;
  const providerLabel = getLlmProviderLabel(
    draft.generationProvider ??
      (draft.generationMode === "openai" ? "openai_responses" : null),
    locale,
  );
  const fallbackNote =
    draft.generationMode === "fallback"
      ? copy.fallbackNotes[draft.fallbackReason ?? "openai_request_failed"]
      : null;

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/quests/${questId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: draft.title,
          premise: draft.premise,
          hook: draft.hook,
          scenes: draft.scenes,
          npcs: draft.npcs,
          rewards: draft.rewards,
          returnToMainPlot: draft.returnToMainPlot,
          gmSummary: draft.gmSummary,
        }),
      });

      const payload = (await response.json()) as
        | { draft: QuestDraft }
        | { errorCode?: ApiErrorCode; error?: string };

      if (!response.ok || !("draft" in payload)) {
        const errorCode = "errorCode" in payload ? payload.errorCode : undefined;
        setError(
          (errorCode && m.apiErrors[errorCode]) ||
            ("error" in payload ? payload.error ?? m.questEditor.error : m.questEditor.error),
        );
        return;
      }

      setDraft(payload.draft);
      setSavedMessage(m.questEditor.saved);
      router.refresh();
    } catch {
      setError(m.questEditor.error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              {m.questEditor.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{m.questEditor.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-400">
              {m.questEditor.description}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-900 disabled:text-slate-300"
          >
            {isSaving ? m.questEditor.saving : m.questEditor.save}
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {savedMessage ? (
          <p
            data-testid="quest-save-success"
            className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            {savedMessage}
          </p>
        ) : null}

        <div
          data-testid="quest-generation-meta"
          className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                {copy.eyebrow}
              </p>
              <p className="mt-2 text-sm text-slate-300">{generationSummary}</p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${generationStatusTone}`}
            >
              {generationStatusLabel}
            </span>
          </div>

          <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
            <div
              data-testid="quest-generation-source"
              className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {copy.sourceLabel}
              </p>
              <p className="mt-2 text-sm text-slate-100">{generationStatusLabel}</p>
            </div>
            <div
              data-testid="quest-generation-provider"
              className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {copy.providerLabel}
              </p>
              <p data-testid="quest-provider-value" className="mt-2 text-sm text-slate-100">
                {providerLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {copy.modelLabel}
              </p>
              <p className="mt-2 text-sm text-slate-100">
                {isProviderDraft && draft.generationModel
                  ? draft.generationModel
                  : getLlmProviderLabel(null, locale)}
              </p>
            </div>
          </div>

          {fallbackNote ? (
            <p
              data-testid="quest-fallback-note"
              className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
            >
              {fallbackNote}
            </p>
          ) : null}
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <label className="text-sm font-semibold text-slate-100" htmlFor="quest-title">
              {m.questEditor.sections.title}
            </label>
            <input
              id="quest-title"
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-100" htmlFor="quest-premise">
              {m.questEditor.sections.premise}
            </label>
            <textarea
              id="quest-premise"
              rows={4}
              value={draft.premise}
              onChange={(event) =>
                setDraft((current) => ({ ...current, premise: event.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-100" htmlFor="quest-hook">
              {m.questEditor.sections.hook}
            </label>
            <textarea
              id="quest-hook"
              rows={3}
              value={draft.hook}
              onChange={(event) =>
                setDraft((current) => ({ ...current, hook: event.target.value }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-slate-100">{m.questEditor.sections.scenes}</p>
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    scenes: [
                      ...current.scenes,
                      {
                        name: m.questEditor.defaults.newScene,
                        goal: m.questEditor.defaults.sceneGoal,
                        summary: m.questEditor.defaults.sceneSummary,
                        location: m.questEditor.defaults.sceneLocation,
                        conflictType: "investigation",
                        outcomeOptions: [m.questEditor.defaults.addOutcome],
                      },
                    ],
                  }))
                }
                className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-950"
              >
                {m.questEditor.sections.addScene}
              </button>
            </div>
            <div className="mt-3 space-y-4">
              {draft.scenes.map((scene, index) => (
                <div
                  key={`scene-${index}`}
                  className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      value={scene.name}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          scenes: updateItem(current.scenes, index, {
                            ...scene,
                            name: event.target.value,
                          }),
                        }))
                      }
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                    />
                    <input
                      value={scene.location}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          scenes: updateItem(current.scenes, index, {
                            ...scene,
                            location: event.target.value,
                          }),
                        }))
                      }
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={scene.goal}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        scenes: updateItem(current.scenes, index, {
                          ...scene,
                          goal: event.target.value,
                        }),
                      }))
                    }
                    className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  />
                  <textarea
                    rows={3}
                    value={scene.summary}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        scenes: updateItem(current.scenes, index, {
                          ...scene,
                          summary: event.target.value,
                        }),
                      }))
                    }
                    className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-slate-100">{m.questEditor.sections.npcs}</p>
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    npcs: [
                      ...current.npcs,
                      {
                        name: m.questEditor.defaults.newNpc,
                        role: m.questEditor.defaults.npcRole,
                        motivation: m.questEditor.defaults.npcMotivation,
                        secret: m.questEditor.defaults.npcSecret,
                      },
                    ],
                  }))
                }
                className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-950"
              >
                {m.questEditor.sections.addNpc}
              </button>
            </div>
            <div className="mt-3 space-y-4">
              {draft.npcs.map((npc, index) => (
                <div
                  key={`npc-${index}`}
                  className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      value={npc.name}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          npcs: updateItem(current.npcs, index, {
                            ...npc,
                            name: event.target.value,
                          }),
                        }))
                      }
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                    />
                    <input
                      value={npc.role}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          npcs: updateItem(current.npcs, index, {
                            ...npc,
                            role: event.target.value,
                          }),
                        }))
                      }
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={npc.motivation}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        npcs: updateItem(current.npcs, index, {
                          ...npc,
                          motivation: event.target.value,
                        }),
                      }))
                    }
                    className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  />
                  <textarea
                    rows={2}
                    value={npc.secret}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        npcs: updateItem(current.npcs, index, {
                          ...npc,
                          secret: event.target.value,
                        }),
                      }))
                    }
                    className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-slate-100">
                {m.questEditor.sections.rewards}
              </p>
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    rewards: [
                      ...current.rewards,
                      {
                        type: m.questEditor.defaults.newRewardType,
                        value: m.questEditor.defaults.newRewardValue,
                      },
                    ],
                  }))
                }
                className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-950"
              >
                {m.questEditor.sections.addReward}
              </button>
            </div>
            <div className="mt-3 space-y-4">
              {draft.rewards.map((reward, index) => (
                <div
                  key={`reward-${index}`}
                  className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[0.35fr_0.65fr]"
                >
                  <input
                    value={reward.type}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        rewards: updateItem(current.rewards, index, {
                          ...reward,
                          type: event.target.value,
                        }),
                      }))
                    }
                    className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  />
                  <input
                    value={reward.value}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        rewards: updateItem(current.rewards, index, {
                          ...reward,
                          value: event.target.value,
                        }),
                      }))
                    }
                    className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-100" htmlFor="quest-return">
              {m.questEditor.sections.returnPath}
            </label>
            <textarea
              id="quest-return"
              rows={4}
              value={draft.returnToMainPlot}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  returnToMainPlot: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-100" htmlFor="quest-summary">
              {m.questEditor.sections.summary}
            </label>
            <textarea
              id="quest-summary"
              rows={5}
              value={draft.gmSummary}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  gmSummary: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </div>
        </div>
      </div>

      <GmPacketPreview draft={draft} />
    </section>
  );
}
