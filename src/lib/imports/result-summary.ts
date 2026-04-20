import { db } from "@/lib/db";

export type ImportBatchResultSummary = {
  successCount: number;
  failureCount: number;
  candidateFactCount: number;
  conflictCount: number;
  conflictSubjects: string[];
};

export type ConflictFact = {
  subject: string;
  factType: string;
  value: string;
  source: "current_batch" | "campaign_history" | "canonical_entry";
};

function normalizeConflictValue(value: string) {
  return value.trim().toLowerCase();
}

export function summarizeConflictFacts(facts: ConflictFact[]) {
  const grouped = new Map<
    string,
    {
      subject: string;
      values: Set<string>;
      hasCurrentBatchFact: boolean;
    }
  >();

  for (const fact of facts) {
    const key = `${fact.subject}::${fact.factType}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.values.add(normalizeConflictValue(fact.value));
      existing.hasCurrentBatchFact ||= fact.source === "current_batch";
      continue;
    }

    grouped.set(key, {
      subject: fact.subject,
      values: new Set([normalizeConflictValue(fact.value)]),
      hasCurrentBatchFact: fact.source === "current_batch",
    });
  }

  const conflictSubjects = Array.from(
    new Set(
      Array.from(grouped.values())
        .filter((entry) => entry.hasCurrentBatchFact && entry.values.size > 1)
        .map((entry) => entry.subject),
    ),
  );

  return {
    conflictCount: conflictSubjects.length,
    conflictSubjects,
  };
}

export async function loadImportBatchResultSummary(campaignId: string, batchId: string) {
  const [batch, facts, canonicalEntries] = await Promise.all([
    db.importBatch.findFirst({
      where: {
        id: batchId,
        campaignId,
      },
      include: {
        files: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    }),
    db.canonFact.findMany({
      where: {
        campaignId,
      },
      select: {
        subject: true,
        factType: true,
        value: true,
        sourceDocument: {
          select: {
            importBatchId: true,
          },
        },
      },
    }),
    db.canonicalEntry.findMany({
      where: {
        campaignId,
      },
      select: {
        subject: true,
        factType: true,
        canonicalValue: true,
      },
    }),
  ]);

  if (!batch) {
    return null;
  }

  const successCount = batch.files.filter((file) => file.status === "completed").length;
  const failureCount = batch.files.filter((file) => file.status === "failed").length;
  const currentBatchFacts = facts.filter(
    (fact) => fact.sourceDocument?.importBatchId === batchId,
  );
  const campaignHistoryFacts = facts.filter(
    (fact) => fact.sourceDocument?.importBatchId !== batchId,
  );
  const conflictSummary = summarizeConflictFacts([
    ...currentBatchFacts.map((fact) => ({
      subject: fact.subject,
      factType: fact.factType,
      value: fact.value,
      source: "current_batch" as const,
    })),
    ...campaignHistoryFacts.map((fact) => ({
      subject: fact.subject,
      factType: fact.factType,
      value: fact.value,
      source: "campaign_history" as const,
    })),
    ...canonicalEntries.map((entry) => ({
      subject: entry.subject,
      factType: entry.factType,
      value: entry.canonicalValue,
      source: "canonical_entry" as const,
    })),
  ]);

  return {
    batch,
    summary: {
      successCount,
      failureCount,
      candidateFactCount: currentBatchFacts.length,
      ...conflictSummary,
    } satisfies ImportBatchResultSummary,
  };
}
