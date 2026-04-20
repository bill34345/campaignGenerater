"use client";

import React from "react";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import type { CanonEntityGroup } from "@/lib/canon/merge";

type CanonReviewTableProps = {
  campaignId: string;
  initialGroups: CanonEntityGroup[];
};

type UpdateStatus = "active" | "overridden" | "uncertain";

export function CanonReviewTable({
  campaignId,
  initialGroups,
}: CanonReviewTableProps) {
  const { locale } = useLanguage();
  const [groups, setGroups] = useState(initialGroups);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isChinese = locale === "zh";
  const labels = isChinese
    ? {
        empty: "当前 campaign 还没有抽出 canon facts。",
        entities: "实体",
        description: "按实体审查 canon，再逐个处理下面的事实组。",
        factGroup: "事实组",
        candidate: "候选项",
        sourceSnippet: "来源片段",
        status: "状态",
        actions: "操作",
        conflict: "冲突待审",
        conflictingValues: "候选值冲突",
        noEvidence: "暂无来源片段。",
        priority: "优先级",
        confidence: "置信度",
        override: "设为 active",
        uncertain: "标为 uncertain",
        overrideOff: "设为 overridden",
        updating: "更新中...",
      }
    : {
        empty: "No canon facts have been extracted for this campaign yet.",
        entities: "Entities",
        description: "Review canon by entity, then resolve each fact group underneath it.",
        factGroup: "Fact group",
        candidate: "Candidate",
        sourceSnippet: "Source snippet",
        status: "Status",
        actions: "Actions",
        conflict: "Review conflict",
        conflictingValues: "Conflicting candidate values",
        noEvidence: "No evidence snippet available.",
        priority: "Priority",
        confidence: "confidence",
        override: "Override",
        uncertain: "Mark uncertain",
        overrideOff: "Override off",
        updating: "Updating...",
      };

  const updateStatus = (factId: string, status: UpdateStatus) => {
    if (isUpdating) {
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/canon`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            factId,
            status,
          }),
        });

        const payload = (await response.json()) as
          | { groups?: CanonEntityGroup[]; error?: string }
          | undefined;

        if (!response.ok || !payload?.groups) {
          throw new Error(payload?.error ?? "Unable to update canon fact");
        }

        setGroups(payload.groups);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to update canon fact",
        );
      } finally {
        setIsUpdating(false);
      }
    })();
  };

  if (groups.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
        {labels.empty}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{labels.entities}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {labels.description}
          </p>
        </div>
        {errorMessage ? (
          <p className="text-sm text-red-300">{errorMessage}</p>
        ) : isUpdating ? (
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
                    <h3 className="text-base font-semibold text-white">
                      {entity.subject}
                    </h3>
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

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                  <thead className="bg-slate-950/40 text-slate-300">
                  <tr>
                    <th className="px-6 py-3 font-medium">{labels.factGroup}</th>
                    <th className="px-6 py-3 font-medium">{labels.candidate}</th>
                    <th className="px-6 py-3 font-medium">{labels.sourceSnippet}</th>
                    <th className="px-6 py-3 font-medium">{labels.status}</th>
                    <th className="px-6 py-3 font-medium">{labels.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {entity.factGroups.map((group) =>
                    group.candidates.map((fact, index) => {
                      return (
                        <tr
                          key={fact.id ?? `${group.key}-${index}`}
                          className={group.conflict ? "bg-amber-500/5" : undefined}
                        >
                          <td className="px-6 py-4 align-top">
                            {index === 0 ? (
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                  {group.factType}
                                </p>
                                {group.conflict ? (
                                  <p className="mt-2 text-xs text-amber-200">
                                    {labels.conflictingValues}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-6 py-4 align-top">
                            <p className="font-medium text-slate-100">
                              {fact.value}
                            </p>
                            <p className="mt-2 text-xs text-slate-400">
                              {labels.priority} {fact.priority}
                              {typeof fact.confidence === "number"
                                ? ` - ${Math.round(fact.confidence * 100)}% ${labels.confidence}`
                                : ""}
                            </p>
                          </td>
                          <td className="px-6 py-4 align-top text-slate-300">
                            {fact.evidence ?? labels.noEvidence}
                          </td>
                          <td className="px-6 py-4 align-top">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${
                                fact.status === "active"
                                  ? "bg-emerald-400/10 text-emerald-200"
                                  : fact.status === "overridden"
                                    ? "bg-slate-700 text-slate-200"
                                    : "bg-amber-400/10 text-amber-200"
                              }`}
                              >
                              {isChinese
                                ? fact.status === "active"
                                  ? "激活"
                                  : fact.status === "overridden"
                                    ? "已覆盖"
                                    : "待确认"
                                : fact.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-full bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() =>
                                  fact.id && updateStatus(fact.id, "active")
                                }
                                disabled={isUpdating || !fact.id}
                              >
                                {labels.override}
                              </button>
                              <button
                                type="button"
                                className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() =>
                                  fact.id && updateStatus(fact.id, "uncertain")
                                }
                                disabled={isUpdating || !fact.id}
                              >
                                {labels.uncertain}
                              </button>
                              <button
                                type="button"
                                className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() =>
                                  fact.id && updateStatus(fact.id, "overridden")
                                }
                                disabled={isUpdating || !fact.id}
                              >
                                {labels.overrideOff}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
