import {
  canonFactSchema,
  type CanonFact,
  type CanonicalEntry,
} from "@/types/domain";

export type CanonicalEntryWithEvidence = CanonicalEntry & {
  sourceFacts: Array<{
    canonFact: unknown;
  }>;
};

function contextKey(value: Pick<CanonFact, "subject" | "factType">) {
  return `${value.subject}::${value.factType}`;
}

export function projectCanonicalEntriesToCanonFacts(
  entries: readonly CanonicalEntryWithEvidence[],
): CanonFact[] {
  return entries.map((entry) => {
    const linkedFacts = entry.sourceFacts.map((sourceFact) =>
      canonFactSchema.parse(sourceFact.canonFact),
    );
    const strongestLinkedFact =
      linkedFacts
        .slice()
        .sort((left, right) => right.priority - left.priority)[0] ?? null;
    const evidence = linkedFacts
      .map((fact) => fact.evidence?.trim())
      .filter((value): value is string => Boolean(value))
      .join("\n\n");

    return {
      id: `canonical:${entry.id}`,
      campaignId: entry.campaignId,
      sourceDocumentId: strongestLinkedFact?.sourceDocumentId ?? null,
      documentChunkId: strongestLinkedFact?.documentChunkId ?? null,
      subject: entry.subject,
      factType: entry.factType,
      value: entry.canonicalValue,
      status: "active",
      priority: Math.max(...linkedFacts.map((fact) => fact.priority), 0),
      confidence: strongestLinkedFact?.confidence ?? null,
      evidence: evidence || entry.notes || null,
    };
  });
}

export function mergeCanonicalAndLegacyFacts(
  canonicalFacts: readonly CanonFact[],
  legacyFacts: readonly CanonFact[],
) {
  const canonicalKeys = new Set(canonicalFacts.map((fact) => contextKey(fact)));

  return [
    ...canonicalFacts,
    ...legacyFacts.filter((fact) => !canonicalKeys.has(contextKey(fact))),
  ];
}
