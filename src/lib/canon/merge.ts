import { canonFactSchema, type CanonFact } from "@/types/domain";

export type CanonFactGroup = {
  key: string;
  subject: string;
  factType: string;
  activeFactId: string | null;
  activeFact: CanonFact | null;
  conflict: boolean;
  candidateFactIds: string[];
  overriddenFactIds: string[];
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
};

const factGroupKeyForFact = (fact: Pick<CanonFact, "subject" | "factType">) =>
  `${fact.subject}::${fact.factType}`;

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

const normalizeFactGroup = (key: string, facts: CanonFact[]): CanonFactGroup => {
  const candidates = [...facts].sort(prioritySort);
  let activeFactAssigned = false;

  const normalizedCandidates = candidates.map((fact) => {
    if (fact.status === "uncertain" || fact.status === "overridden") {
      return fact;
    }

    if (!activeFactAssigned) {
      activeFactAssigned = true;
      return {
        ...fact,
        status: "active" as const,
      };
    }

    return {
      ...fact,
      status: "overridden" as const,
    };
  });

  const activeFact =
    normalizedCandidates.find((fact) => fact.status === "active") ?? null;
  const distinctValues = new Set(
    normalizedCandidates.map((fact) => fact.value.trim().toLowerCase()),
  );

  return {
    key,
    subject: candidates[0]?.subject ?? "",
    factType: candidates[0]?.factType ?? "",
    activeFactId: activeFact?.id ?? null,
    activeFact,
    conflict: distinctValues.size > 1,
    candidateFactIds: normalizedCandidates
      .map((fact) => fact.id)
      .filter((id): id is string => Boolean(id)),
    overriddenFactIds: normalizedCandidates
      .filter((fact) => fact.status === "overridden")
      .map((fact) => fact.id)
      .filter((id): id is string => Boolean(id)),
    candidates: normalizedCandidates,
  };
};

export function mergeCanonFacts(inputFacts: readonly unknown[]): CanonMergeResult {
  const parsedFacts = inputFacts.map((fact) =>
    canonFactSchema.parse(sanitizeCanonFactInput(fact)),
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

  const factGroups = Array.from(groupedFacts.entries())
    .map(([key, facts]) => normalizeFactGroup(key, facts))
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
  };
}
