import type { QuestDraft, QuestRequest } from "@/types/domain";
import { questGenerationSchema } from "@/lib/quests/quest-schema";

export type QuestValidationResult = {
  valid: boolean;
  errors: string[];
};

function toSchemaDraft(draft: Partial<QuestDraft>) {
  return {
    title: draft.title,
    premise: draft.premise,
    hook: draft.hook,
    scenes: draft.scenes,
    npcs: draft.npcs,
    encounters: draft.encounters,
    rewards: draft.rewards,
    returnToMainPlot: draft.returnToMainPlot,
    gmSummary: draft.gmSummary,
  };
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function hasText(value: string | null | undefined) {
  return normalizeText(value).length > 0;
}

function formatIssuePath(path: PropertyKey[]) {
  return path.map((segment) => segment.toString()).join(".");
}

function includesTownAnchor(draft: Partial<QuestDraft>, townName: string) {
  const normalizedTownName = normalizeText(townName);

  if (!normalizedTownName) {
    return true;
  }

  const textCorpus = [
    draft.title,
    draft.premise,
    draft.hook,
    draft.returnToMainPlot,
    draft.gmSummary,
    ...(draft.scenes ?? []).flatMap((scene) => [
      scene.name,
      scene.summary,
      scene.location,
    ]),
    ...(draft.npcs ?? []).flatMap((npc) => [npc.name, npc.role, npc.motivation]),
    ...(draft.encounters ?? []).flatMap((encounter) => [
      encounter.name,
      encounter.purpose,
      encounter.notes,
    ]),
    ...(draft.rewards ?? []).map((reward) => reward.value),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return textCorpus.some((value) => value.includes(normalizedTownName));
}

function questTypeMatches(
  draft: Partial<QuestDraft>,
  requestedQuestType: string | null | undefined,
) {
  const normalizedQuestType = normalizeText(requestedQuestType);
  const sceneTypes = (draft.scenes ?? []).map((scene) =>
    normalizeText(scene.conflictType),
  );

  if (!normalizedQuestType || sceneTypes.length === 0) {
    return true;
  }

  if (normalizedQuestType === "mixed") {
    return (
      sceneTypes.includes("mixed") ||
      new Set(sceneTypes.filter(Boolean)).size >= 2
    );
  }

  return sceneTypes.includes(normalizedQuestType);
}

export function validateQuestDraft(
  draft: Partial<QuestDraft>,
  request?: Pick<QuestRequest, "questType" | "townName" | "requestMode">,
): QuestValidationResult {
  const errors: string[] = [];

  if (!hasText(draft.title)) {
    errors.push("title is required.");
  }

  if (!hasText(draft.premise)) {
    errors.push("premise is required.");
  }

  if (!hasText(draft.hook)) {
    errors.push("hook is required.");
  }

  if (!hasText(draft.returnToMainPlot)) {
    errors.push("returnToMainPlot is required.");
  }

  if (!hasText(draft.gmSummary)) {
    errors.push("gmSummary is required.");
  }

  const sceneCount = draft.scenes?.length ?? 0;
  if (sceneCount < 3 || sceneCount > 5) {
    errors.push("Quest drafts must contain between 3 and 5 scenes.");
  }

  if ((draft.npcs?.length ?? 0) < 1) {
    errors.push("At least one NPC is required.");
  }

  if ((draft.encounters?.length ?? 0) < 1) {
    errors.push("At least one encounter is required.");
  }

  if ((draft.rewards?.length ?? 0) < 1) {
    errors.push("At least one reward is required.");
  }

  if (request?.requestMode === "quick_start") {
    if ((draft.scenes?.length ?? 0) < 3) {
      errors.push("Quick Start drafts must include at least 3 scenes.");
    }

    if ((draft.npcs?.length ?? 0) < 2) {
      errors.push("Quick Start drafts must include at least 2 NPCs.");
    }

    if ((draft.encounters?.length ?? 0) < 1) {
      errors.push("Quick Start drafts must include at least 1 encounter.");
    }
  }

  const schemaResult = questGenerationSchema.safeParse(toSchemaDraft(draft));
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      const topLevelField = issue.path[0];
      const issuePath =
        issue.path.length > 0 && typeof topLevelField === "string"
          ? formatIssuePath(issue.path)
          : "quest";

      const message = `${issuePath}: ${issue.message}`;
      if (!errors.includes(message)) {
        errors.push(message);
      }
    }
  }

  if (!questTypeMatches(draft, request?.questType)) {
    errors.push(
      `Quest scenes must include the requested quest type: ${request?.questType?.trim()}.`,
    );
  }

  if (request?.townName && !includesTownAnchor(draft, request.townName)) {
    errors.push(
      `Quest draft must stay anchored to the requested town: "${request.townName.trim()}".`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
