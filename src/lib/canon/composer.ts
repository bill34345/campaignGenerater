import {
  canonComposerDraftSchema,
  canonicalEntrySchema,
  canonFactSchema,
  type CanonComposerDraft,
  type CanonFact,
  type CanonicalEntry,
} from "@/types/domain";

type BuildCanonComposerDraftInput = {
  campaignId: string;
  subject: string;
  factType: string;
  selectedFacts: CanonFact[];
  existingEntry?: CanonicalEntry | null;
};

function sortFacts(left: CanonFact, right: CanonFact) {
  return (
    right.priority - left.priority ||
    Number(right.confidence ?? -1) - Number(left.confidence ?? -1) ||
    left.value.localeCompare(right.value) ||
    (left.id ?? "").localeCompare(right.id ?? "")
  );
}

export function deriveCanonicalSummary(selectedFacts: readonly CanonFact[]) {
  const orderedFacts = [...selectedFacts].sort(sortFacts);
  const uniqueValues = Array.from(
    new Set(orderedFacts.map((fact) => fact.value.trim()).filter(Boolean)),
  );

  if (uniqueValues.length === 0) {
    return "";
  }

  if (uniqueValues.length === 1) {
    return uniqueValues[0];
  }

  return `${uniqueValues[0]} Supporting evidence also describes: ${uniqueValues
    .slice(1)
    .join("; ")}.`;
}

export function validateCanonicalEntryDraft(input: unknown) {
  return canonComposerDraftSchema.parse(input);
}

export function buildCanonComposerDraft({
  campaignId,
  subject,
  factType,
  selectedFacts,
  existingEntry = null,
}: BuildCanonComposerDraftInput): CanonComposerDraft {
  const parsedFacts = selectedFacts
    .map((fact) => canonFactSchema.parse(fact))
    .sort(sortFacts);

  if (parsedFacts.length === 0) {
    throw new Error("Select at least one candidate fact to compose canon.");
  }

  const summary =
    existingEntry?.canonicalValue?.trim() || deriveCanonicalSummary(parsedFacts);

  return validateCanonicalEntryDraft({
    campaignId,
    subject,
    factType,
    canonicalValue: summary,
    notes: existingEntry?.notes ?? null,
    selectedFactIds: parsedFacts
      .map((fact) => fact.id)
      .filter((id): id is string => Boolean(id)),
    evidence: parsedFacts.map((fact) => ({
      factId: fact.id,
      subject: fact.subject,
      factType: fact.factType,
      value: fact.value,
      evidence: fact.evidence ?? null,
    })),
  });
}

export function toCanonicalEntryPayload(input: unknown) {
  return canonicalEntrySchema.parse(input);
}
