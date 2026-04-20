"use client";

import React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CanonComposerDrawer } from "@/components/canon/canon-composer-drawer";
import { useLanguage } from "@/components/i18n/language-provider";
import type { CanonEntityGroup, CanonFactGroup } from "@/lib/canon/merge";

type CanonReviewTableProps = {
  campaignId: string;
  initialGroups: CanonEntityGroup[];
  composerAvailable?: boolean;
};

type CanonRouteResponse = {
  groups?: CanonEntityGroup[];
  error?: string;
};

function buildSelectionState(groups: CanonEntityGroup[]) {
  return Object.fromEntries(
    groups.flatMap((entity) =>
      entity.factGroups.map((group) => [group.key, group.selectedFactIds]),
    ),
  ) as Record<string, string[]>;
}

function statusTone(status: string) {
  if (status === "active") {
    return "bg-emerald-400/10 text-emerald-200";
  }

  if (status === "overridden") {
    return "bg-slate-700 text-slate-200";
  }

  return "bg-amber-400/10 text-amber-200";
}

export function CanonReviewTable({
  campaignId,
  initialGroups,
  composerAvailable = true,
}: CanonReviewTableProps) {
  const router = useRouter();
  const { locale } = useLanguage();
  const [groups, setGroups] = useState(initialGroups);
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>(
    () => buildSelectionState(initialGroups),
  );
  const [activeGroup, setActiveGroup] = useState<CanonFactGroup | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isChinese = locale === "zh";

  const labels = useMemo(
    () =>
      isChinese
        ? {
            empty: "当前还没有可审核的 canon 候选事实。",
            entities: "实体",
            description: "按实体查看候选事实，选择证据并整理成最终 canonical entry。",
            factGroup: "事实组",
            candidate: "候选事实",
            evidence: "证据",
            status: "状态",
            conflict: "存在冲突",
            selected: "已选证据",
            currentCanon: "当前 canonical",
            noCanon: "尚未保存 canonical entry。",
            noEvidence: "暂无证据片段。",
            priority: "优先级",
            confidence: "置信度",
            compose: "整理 canon",
            quickSave: "快速保存",
            updating: "刷新中...",
          }
        : {
            empty: "No candidate canon facts are ready for review yet.",
            entities: "Entities",
            description:
              "Review candidate facts by entity, select evidence, and save a canonical entry for each fact group.",
            factGroup: "Fact group",
            candidate: "Candidate",
            evidence: "Evidence",
            status: "Status",
            conflict: "Conflict",
            selected: "Selected evidence",
            currentCanon: "Current canonical entry",
            noCanon: "No canonical entry saved yet.",
            noEvidence: "No evidence snippet available.",
            priority: "Priority",
            confidence: "confidence",
            compose: "Compose canon",
            quickSave: "Quick save",
            updating: "Refreshing...",
          },
    [isChinese],
  );

  async function refreshGroups() {
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/canon`);
      const payload = (await response.json()) as CanonRouteResponse;

      if (!response.ok || !payload.groups) {
        throw new Error(payload.error ?? "Unable to refresh canon review.");
      }

      setGroups(payload.groups);
      setSelectedByGroup(buildSelectionState(payload.groups));
      router.refresh();
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to refresh canon review.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  function toggleSelection(groupKey: string, factId: string, checked: boolean) {
    setSelectedByGroup((current) => {
      const existing = current[groupKey] ?? [];
      const nextSelection = checked
        ? Array.from(new Set([...existing, factId]))
        : existing.filter((value) => value !== factId);

      return {
        ...current,
        [groupKey]: nextSelection,
      };
    });
  }

  async function quickSave(group: CanonFactGroup) {
    const selectedFactIds = selectedByGroup[group.key] ?? [];
    const selectedCandidates = group.candidates.filter(
      (fact) => fact.id && selectedFactIds.includes(fact.id),
    );
    const canonicalValue = selectedCandidates[0]?.value ?? "";

    if (selectedFactIds.length !== 1 || canonicalValue.trim().length === 0) {
      setErrorMessage("Quick save requires exactly one selected candidate.");
      return;
    }

    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/canon/entries`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subject: group.subject,
          factType: group.factType,
          canonicalValue,
          notes: null,
          sourceFactIds: selectedFactIds,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save canonical entry.");
      }

      await refreshGroups();
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save canonical entry.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
        {labels.empty}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{labels.entities}</h2>
            <p className="mt-1 text-sm text-slate-400">{labels.description}</p>
          </div>
          {errorMessage ? (
            <p className="max-w-sm text-right text-sm text-red-300">{errorMessage}</p>
          ) : isRefreshing ? (
            <p className="text-sm text-cyan-300">{labels.updating}</p>
          ) : null}
        </div>

        <div className="space-y-6 p-6">
          {groups.map((entity) => (
            <section
              key={entity.key}
              className="overflow-hidden rounded-3xl border border-slate-800"
            >
              <div className="border-b border-slate-800 bg-slate-950/60 px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">{entity.subject}</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {entity.factGroups.length} {labels.factGroup}
                      {entity.factGroups.length === 1 || isChinese ? "" : "s"}
                    </p>
                  </div>
                  {entity.conflict ? (
                    <p className="inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-amber-200">
                      {labels.conflict}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4 p-5">
                {entity.factGroups.map((group) => {
                  const selectedFactIds = selectedByGroup[group.key] ?? [];
                  const selectedCount = selectedFactIds.length;

                  return (
                    <article
                      key={group.key}
                      className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            {labels.factGroup}
                          </p>
                          <h4 className="mt-2 text-lg font-semibold text-white">
                            {group.factType}
                          </h4>
                          <p className="mt-2 text-sm text-slate-400">
                            {labels.selected}: {selectedCount}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {group.candidates.length === 1 && selectedCount === 1 ? (
                            <button
                              type="button"
                              data-testid="quick-save-canon"
                              disabled={isRefreshing}
                              onClick={() => void quickSave(group)}
                              className="rounded-full border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                            >
                              {labels.quickSave}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            data-testid="compose-canon"
                            disabled={!composerAvailable || selectedCount === 0 || isRefreshing}
                            onClick={() => setActiveGroup(group)}
                            className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-900 disabled:text-slate-300"
                          >
                            {labels.compose}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          {labels.currentCanon}
                        </p>
                        {group.canonicalEntry ? (
                          <>
                            <p
                              data-testid="current-canonical-entry"
                              className="mt-3 text-sm leading-7 text-slate-100"
                            >
                              {group.canonicalEntry.canonicalValue}
                            </p>
                            {group.canonicalEntry.notes ? (
                              <p className="mt-2 text-sm text-slate-400">
                                {group.canonicalEntry.notes}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <p
                            data-testid="current-canonical-entry-empty"
                            className="mt-3 text-sm text-slate-400"
                          >
                            {labels.noCanon}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3">
                        {group.candidates.map((fact) => (
                          <label
                            key={fact.id ?? `${group.key}-${fact.value}`}
                            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={Boolean(fact.id && selectedFactIds.includes(fact.id))}
                                  disabled={isRefreshing || !fact.id}
                                  onChange={(event) =>
                                    fact.id &&
                                    toggleSelection(group.key, fact.id, event.target.checked)
                                  }
                                  className="mt-1 size-4 rounded border-slate-600 bg-slate-950 text-cyan-400"
                                />
                                <div>
                                  <p className="font-medium text-slate-100">{fact.value}</p>
                                  <p className="mt-2 text-xs text-slate-400">
                                    {labels.priority} {fact.priority}
                                    {typeof fact.confidence === "number"
                                      ? ` · ${Math.round(fact.confidence * 100)}% ${labels.confidence}`
                                      : ""}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${statusTone(
                                  fact.status,
                                )}`}
                              >
                                {fact.status}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-400">
                              <span className="font-semibold text-slate-300">
                                {labels.evidence}:{" "}
                              </span>
                              {fact.evidence ?? labels.noEvidence}
                            </p>
                          </label>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <CanonComposerDrawer
        campaignId={campaignId}
        group={activeGroup}
        selectedFactIds={activeGroup ? selectedByGroup[activeGroup.key] ?? [] : []}
        onClose={() => setActiveGroup(null)}
        onSaved={refreshGroups}
      />
    </>
  );
}
