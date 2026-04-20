import { db } from "@/lib/db";

export type ImportBatchResultSummary = {
  successCount: number;
  failureCount: number;
  candidateFactCount: number;
  conflictCount: number;
  conflictSubjects: string[];
};

function summarizeConflictFacts(facts: Array<{ subject: string; factType: string }>) {
  const grouped = new Map<string, { subject: string; count: number }>();

  for (const fact of facts) {
    const key = `${fact.subject}::${fact.factType}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    grouped.set(key, {
      subject: fact.subject,
      count: 1,
    });
  }

  const conflictSubjects = Array.from(grouped.values())
    .filter((entry) => entry.count > 1)
    .map((entry) => entry.subject);

  return {
    conflictCount: conflictSubjects.length,
    conflictSubjects,
  };
}

export async function loadImportBatchResultSummary(campaignId: string, batchId: string) {
  const [batch, facts] = await Promise.all([
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
        sourceDocument: {
          importBatchId: batchId,
        },
      },
      select: {
        subject: true,
        factType: true,
      },
    }),
  ]);

  if (!batch) {
    return null;
  }

  const successCount = batch.files.filter((file) => file.status === "completed").length;
  const failureCount = batch.files.filter((file) => file.status === "failed").length;
  const conflictSummary = summarizeConflictFacts(facts);

  return {
    batch,
    summary: {
      successCount,
      failureCount,
      candidateFactCount: facts.length,
      ...conflictSummary,
    } satisfies ImportBatchResultSummary,
  };
}
