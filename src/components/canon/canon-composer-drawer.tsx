"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import type { CanonFactGroup } from "@/lib/canon/merge";

type CanonComposerDrawerProps = {
  campaignId: string;
  group: CanonFactGroup | null;
  selectedFactIds: string[];
  onClose(): void;
  onSaved(): Promise<void>;
};

type ComposerResponse = {
  draft?: {
    canonicalValue: string;
    notes?: string | null;
    selectedFactIds: string[];
    evidence: ComposerEvidenceItem[];
  };
  composerMeta?: {
    providerConfigured: boolean;
    generationMode?: string;
  };
  error?: string;
};

type ComposerEvidenceItem = {
  factId: string;
  value: string;
  evidence?: string | null;
};

export function CanonComposerDrawer({
  campaignId,
  group,
  selectedFactIds,
  onClose,
  onSaved,
}: CanonComposerDrawerProps) {
  const [canonicalValue, setCanonicalValue] = useState("");
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState<ComposerEvidenceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectionFingerprint = useMemo(
    () => selectedFactIds.slice().sort().join(","),
    [selectedFactIds],
  );

  useEffect(() => {
    if (!group) {
      return;
    }

    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/canon/composer`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            subject: group.subject,
            factType: group.factType,
            selectedFactIds,
          }),
        });

        const payload = (await response.json()) as ComposerResponse;

        if (!response.ok || !payload.draft) {
          throw new Error(payload.error ?? "Unable to build a canon draft.");
        }

        setCanonicalValue(payload.draft.canonicalValue);
        setNotes(payload.draft.notes ?? "");
        setEvidence(payload.draft.evidence);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to build a canon draft.",
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [campaignId, group, selectionFingerprint, selectedFactIds]);

  if (!group) {
    return null;
  }

  async function handleSave() {
    if (!group) {
      return;
    }

    if (canonicalValue.trim().length === 0 || selectedFactIds.length === 0) {
      setError("Add a canonical summary and keep at least one candidate selected.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/canon/entries`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subject: group.subject,
          factType: group.factType,
          canonicalValue: canonicalValue.trim(),
          notes: notes.trim().length > 0 ? notes.trim() : null,
          sourceFactIds: selectedFactIds,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save canonical entry.");
      }

      await onSaved();
      onClose();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save canonical entry.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Compose Canon
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {group.subject}
            </h2>
            <p className="mt-2 text-sm text-slate-400">{group.factType}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            Close
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Selected evidence
          </p>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-400">Building canon draft...</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {evidence.map((item) => (
                <li
                  key={item.factId}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <p className="text-sm font-medium text-slate-100">{item.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {item.evidence ?? "No evidence snippet recorded."}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
          <label className="text-sm font-semibold text-slate-100" htmlFor="canonical-value">
            Canonical summary
          </label>
          <textarea
            id="canonical-value"
            rows={8}
            value={canonicalValue}
            onChange={(event) => setCanonicalValue(event.target.value)}
            className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
          />

          <label className="mt-4 block text-sm font-semibold text-slate-100" htmlFor="canonical-notes">
            Notes
          </label>
          <textarea
            id="canonical-notes"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
          />
        </div>

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="save-canonical-entry"
            disabled={isLoading || isSaving}
            onClick={() => void handleSave()}
            className="rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-900 disabled:text-slate-300"
          >
            {isSaving ? "Saving..." : "Save canonical entry"}
          </button>
        </div>
      </div>
    </div>
  );
}
