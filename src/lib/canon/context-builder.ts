import type { CanonFact, TownProfile } from "@/types/domain";

export type TownQuestContextDelta = {
  id: string;
  campaignId: string;
  deltaType: string;
  summary: string;
  createdAt: Date;
  sourceFactId?: string | null;
  sourceFact?: Pick<CanonFact, "id" | "subject" | "factType" | "value"> | null;
};

export type BuildTownQuestContextInput = {
  campaignId: string;
  campaignTone: string;
  partyLevel: number;
  town: TownProfile;
  canonFacts: CanonFact[];
  deltas: TownQuestContextDelta[];
};

export type TownQuestContext = {
  campaignId: string;
  campaignTone: string;
  partyLevel: number;
  town: TownProfile;
  townFacts: CanonFact[];
  relevantNpcs: CanonFact[];
  relevantFactions: CanonFact[];
  recentDeltas: TownQuestContextDelta[];
  openHooks: string[];
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "before",
  "beneath",
  "between",
  "during",
  "every",
  "from",
  "into",
  "keep",
  "keeps",
  "local",
  "locals",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "under",
  "with",
]);

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function tokenizeAll(value: string | null | undefined) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function tokenizeKeywords(value: string | null | undefined) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

function buildTownKeywordSet(town: TownProfile) {
  return new Set([
    ...tokenizeKeywords(town.name),
    ...tokenizeKeywords(town.vibe),
    ...tokenizeKeywords(town.tension),
    ...tokenizeKeywords(town.notes),
    ...town.questHooks.flatMap((hook) => tokenizeKeywords(hook)),
  ]);
}

function factSearchTokens(fact: CanonFact) {
  return new Set(
    tokenizeAll(
      [
        fact.subject,
        fact.factType,
        fact.value,
        fact.evidence ?? "",
      ].join(" "),
    ),
  );
}

function deltaSearchTokens(delta: TownQuestContextDelta) {
  return new Set(
    tokenizeAll(
      [
        delta.summary,
        delta.sourceFact?.subject ?? "",
        delta.sourceFact?.factType ?? "",
        delta.sourceFact?.value ?? "",
      ].join(" "),
    ),
  );
}

function isNpcFact(fact: CanonFact) {
  return normalizeText(fact.factType).includes("npc");
}

function isFactionFact(fact: CanonFact) {
  return normalizeText(fact.factType).includes("faction");
}

function isHookFact(fact: CanonFact) {
  const factType = normalizeText(fact.factType);

  return (
    factType.includes("hook") ||
    factType.includes("thread") ||
    factType.includes("rumor")
  );
}

function isRelevantToTown(
  searchTokens: Set<string>,
  townNameTokens: string[],
  townKeywords: Set<string>,
) {
  if (
    townNameTokens.length > 0 &&
    townNameTokens.every((token) => searchTokens.has(token))
  ) {
    return true;
  }

  for (const keyword of townKeywords) {
    if (searchTokens.has(keyword)) {
      return true;
    }
  }

  return false;
}

function compareFacts(left: CanonFact, right: CanonFact) {
  return right.priority - left.priority || left.subject.localeCompare(right.subject);
}

export function buildTownQuestContext({
  campaignId,
  campaignTone,
  partyLevel,
  town,
  canonFacts,
  deltas,
}: BuildTownQuestContextInput): TownQuestContext {
  const townName = normalizeText(town.name);
  const townNameTokens = tokenizeAll(town.name);
  const townKeywords = buildTownKeywordSet(town);
  const activeFacts = canonFacts
    .filter((fact) => fact.campaignId === campaignId && fact.status === "active")
    .sort(compareFacts);

  const townFacts = activeFacts.filter((fact) => normalizeText(fact.subject) === townName);
  const relevantNpcs = activeFacts.filter(
    (fact) =>
      isNpcFact(fact) &&
      isRelevantToTown(factSearchTokens(fact), townNameTokens, townKeywords),
  );
  const relevantFactions = activeFacts.filter(
    (fact) =>
      isFactionFact(fact) &&
      isRelevantToTown(factSearchTokens(fact), townNameTokens, townKeywords),
  );
  const recentDeltas = deltas
    .filter(
      (delta) =>
        delta.campaignId === campaignId &&
        isRelevantToTown(deltaSearchTokens(delta), townNameTokens, townKeywords),
    )
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const openHooks = Array.from(
    new Set([
      ...town.questHooks.map((hook) => hook.trim()).filter(Boolean),
      ...activeFacts
        .filter(
          (fact) =>
            isHookFact(fact) &&
            isRelevantToTown(factSearchTokens(fact), townNameTokens, townKeywords),
        )
        .map((fact) => fact.value.trim())
        .filter(Boolean),
    ]),
  );

  return {
    campaignId,
    campaignTone,
    partyLevel,
    town,
    townFacts,
    relevantNpcs,
    relevantFactions,
    recentDeltas,
    openHooks,
  };
}
