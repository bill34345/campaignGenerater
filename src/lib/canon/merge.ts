import {
  canonicalEntrySchema,
  canonFactSchema,
  type CanonFact,
  type CanonicalEntry,
} from "@/types/domain";

export type CanonFactGroup = {
  key: string;
  subject: string;
  factType: string;
  activeFactId: string | null;
  activeFact: CanonFact | null;
  conflict: boolean;
  candidateFactIds: string[];
  overriddenFactIds: string[];
  selectedFactIds: string[];
  canonicalEntry: CanonicalEntry | null;
  candidates: CanonFact[];
};

export type CanonEntityGroup = {
  key: string;
  subject: string;
  conflict: boolean;
  factGroups: CanonFactGroup[];
};

export type CanonMergeResult = {
  allFacts: CanonFact[];
  groups: CanonEntityGroup[];
  conflictGroups: CanonEntityGroup[];
  canonicalEntries: CanonicalEntry[];
};

const factGroupKeyForFact = (fact: Pick<CanonFact, "subject" | "factType">) =>
  `${fact.subject}::${fact.factType}`;

const factGroupKeyForEntry = (
  entry: Pick<CanonicalEntry, "subject" | "factType">,
) => `${entry.subject}::${entry.factType}`;

const prioritySort = (left: CanonFact, right: CanonFact) =>
  right.priority - left.priority ||
  Number(right.confidence ?? -1) - Number(left.confidence ?? -1) ||
  left.value.localeCompare(right.value) ||
  (left.id ?? "").localeCompare(right.id ?? "");

function sanitizeCanonFactInput(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    return input;
  }

  const fact = input as Record<string, unknown>;

  return {
    id: fact.id,
    campaignId: fact.campaignId,
    sourceDocumentId: fact.sourceDocumentId,
    documentChunkId: fact.documentChunkId,
    subject: fact.subject,
    factType: fact.factType,
    value: fact.value,
    status: fact.status,
    priority: fact.priority,
    confidence: fact.confidence,
    evidence: fact.evidence,
  };
}

function sanitizeCanonicalEntryInput(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    return input;
  }

  const entry = input as Record<string, unknown>;
  const sourceFacts = Array.isArray(entry.sourceFacts) ? entry.sourceFacts : [];
  const sourceFactIds =
    Array.isArray(entry.sourceFactIds) && entry.sourceFactIds.every((id) => typeof id === "string")
      ? (entry.sourceFactIds as string[])
      : sourceFacts
          .map((sourceFact) => {
            if (typeof sourceFact !== "object" || sourceFact === null) {
              return null;
            }

            const relation = sourceFact as Record<string, unknown>;

            return typeof relation.canonFactId === "string" ? relation.canonFactId : null;
          })
          .filter((id): id is string => Boolean(id));

  return {
    id: entry.id,
    campaignId: entry.campaignId,
    subject: entry.subject,
    factType: entry.factType,
    canonicalValue: entry.canonicalValue,
    notes: entry.notes,
    sourceFactIds,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

const normalizeFactGroup = (
  key: string,
  facts: CanonFact[],
  canonicalEntry: CanonicalEntry | null,
): CanonFactGroup => {
  const candidates = [...facts].sort(prioritySort);
  const activeFact = candidates.find((fact) => fact.status === "active") ?? null;
  const distinctValues = new Set(
    candidates.map((fact) => fact.value.trim().toLowerCase()),
  );
  const selectedFactIds =
    canonicalEntry?.sourceFactIds.length
      ? canonicalEntry.sourceFactIds
      : activeFact?.id
        ? [activeFact.id]
        : [];

  return {
    key,
    subject: candidates[0]?.subject ?? canonicalEntry?.subject ?? "",
    factType: candidates[0]?.factType ?? canonicalEntry?.factType ?? "",
    activeFactId: activeFact?.id ?? null,
    activeFact,
    conflict: distinctValues.size > 1,
    candidateFactIds: candidates
      .map((fact) => fact.id)
      .filter((id): id is string => Boolean(id)),
    overriddenFactIds: candidates
      .filter((fact) => fact.status === "overridden")
      .map((fact) => fact.id)
      .filter((id): id is string => Boolean(id)),
    selectedFactIds,
    canonicalEntry,
    candidates,
  };
};

export function mergeCanonFacts(
  inputFacts: readonly unknown[],
  inputCanonicalEntries: readonly unknown[] = [],
): CanonMergeResult {
  const parsedFacts = inputFacts.map((fact) =>
    canonFactSchema.parse(sanitizeCanonFactInput(fact)),
  );
  const parsedCanonicalEntries = inputCanonicalEntries.map((entry) =>
    canonicalEntrySchema.parse(sanitizeCanonicalEntryInput(entry)),
  );

  const groupedFacts = new Map<string, CanonFact[]>();
  for (const fact of parsedFacts) {
    const key = factGroupKeyForFact(fact);
    const existing = groupedFacts.get(key);

    if (existing) {
      existing.push(fact);
      continue;
    }

    groupedFacts.set(key, [fact]);
  }

  const canonicalEntryByGroupKey = new Map(
    parsedCanonicalEntries.map((entry) => [factGroupKeyForEntry(entry), entry]),
  );
  const allGroupKeys = new Set([
    ...groupedFacts.keys(),
    ...canonicalEntryByGroupKey.keys(),
  ]);

  const factGroups = Array.from(allGroupKeys)
    .map((key) =>
      normalizeFactGroup(
        key,
        groupedFacts.get(key) ?? [],
        canonicalEntryByGroupKey.get(key) ?? null,
      ),
    )
    .sort(
      (left, right) =>
        left.subject.localeCompare(right.subject) ||
        left.factType.localeCompare(right.factType),
    );

  const groupedEntities = new Map<string, CanonFactGroup[]>();
  for (const group of factGroups) {
    const existing = groupedEntities.get(group.subject);

    if (existing) {
      existing.push(group);
      continue;
    }

    groupedEntities.set(group.subject, [group]);
  }

  const groups = Array.from(groupedEntities.entries())
    .map(([subject, entityFactGroups]) => ({
      key: subject,
      subject,
      conflict: entityFactGroups.some((group) => group.conflict),
      factGroups: [...entityFactGroups].sort((left, right) =>
        left.factType.localeCompare(right.factType),
      ),
    }))
    .sort((left, right) => left.subject.localeCompare(right.subject));

  return {
    allFacts: factGroups.flatMap((group) => group.candidates),
    groups,
    conflictGroups: groups.filter((group) => group.conflict),
    canonicalEntries: parsedCanonicalEntries,
  };
}
