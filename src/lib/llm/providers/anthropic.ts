import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  buildMockExtractedFacts,
  buildMockQuestDraft,
  shouldUseMockLlmProvider,
  throwMockProviderFailure,
} from "@/lib/llm/mock-provider";
import type { LlmProviderAdapter } from "@/lib/llm/provider-types";
import {
  extractedFactSchema,
  factExtractionResponseSchema,
  type ExtractedFact,
} from "@/lib/llm/fact-schema";
import type {
  ExtractedCampaignFact,
  FactExtractionChunk,
} from "@/lib/llm/extract-facts";
import { questGenerationSchema } from "@/lib/quests/quest-schema";
import type { QuestRequest } from "@/types/domain";
import type { TownQuestContext } from "@/lib/canon/context-builder";

const DEFAULT_MODEL = "claude-3-5-sonnet-latest";
const connectionSchema = z.object({ status: z.literal("ok") }).strict();
const groupedFactCategories = [
  "location",
  "npc",
  "faction",
  "event",
  "clue",
  "override",
] as const;
type GroupedFactCategory = (typeof groupedFactCategories)[number];
const factCategoryAliases = new Map<string, GroupedFactCategory>([
  ["location", "location"],
  ["locations", "location"],
  ["location_fact", "location"],
  ["place", "location"],
  ["npc", "npc"],
  ["npcs", "npc"],
  ["character", "npc"],
  ["characters", "npc"],
  ["faction", "faction"],
  ["factions", "faction"],
  ["organization", "faction"],
  ["organizations", "faction"],
  ["event", "event"],
  ["events", "event"],
  ["clue", "clue"],
  ["clues", "clue"],
  ["hook", "clue"],
  ["hooks", "clue"],
  ["override", "override"],
  ["overrides", "override"],
]);

function createAnthropicClient(apiKey: string, baseURL?: string | null) {
  return new Anthropic({
    apiKey,
    baseURL: baseURL ?? undefined,
  });
}

function extractTextContent(
  content: Anthropic.Messages.Message["content"],
) {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function normalizeJsonCandidate(text: string) {
  const withoutCodeFences = text.replace(/```(?:json)?/gi, "").trim();
  const withoutThinkBlocks = withoutCodeFences.replace(
    /<think\b[^>]*>[\s\S]*?<\/think>/gi,
    "",
  );
  const trimmed = withoutThinkBlocks.trim();

  const objectStart = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const firstStart =
    objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);

  if (firstStart === -1) {
    return trimmed;
  }

  const openingChar = trimmed[firstStart];
  const closingChar = openingChar === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstStart; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openingChar) {
      depth += 1;
      continue;
    }

    if (char === closingChar) {
      depth -= 1;

      if (depth === 0) {
        return trimmed.slice(firstStart, index + 1);
      }
    }
  }

  return trimmed;
}

function parseStructuredJson<T>(schema: z.ZodType<T>, content: string) {
  return schema.parse(JSON.parse(normalizeJsonCandidate(content)));
}

function parseRawJson(content: string) {
  return JSON.parse(normalizeJsonCandidate(content)) as unknown;
}

function normalizeFactCategory(
  value: unknown,
  fallbackCategory?: GroupedFactCategory,
): GroupedFactCategory {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const alias = factCategoryAliases.get(normalized);

    if (alias) {
      return alias;
    }
  }

  return fallbackCategory ?? "clue";
}

function deriveFactSubject(value: unknown, fallbackCategory: GroupedFactCategory) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallbackCategory;
  }

  const trimmed = value.trim();
  const sentence = trimmed.split(/[.!?。！？]/)[0]?.trim() ?? trimmed;
  const shortened = sentence.slice(0, 80).trim();

  return shortened.length > 0 ? shortened : fallbackCategory;
}

function normalizeExtractedFact(
  entry: unknown,
  fallbackCategory?: GroupedFactCategory,
) {
  if (typeof entry === "object" && entry) {
    const record = entry as Record<string, unknown>;
    const category = normalizeFactCategory(
      record.category ?? record.fact_type,
      fallbackCategory,
    );
    const summary =
      typeof record.summary === "string"
        ? record.summary
        : typeof record.fact === "string"
          ? record.fact
          : typeof record.value === "string"
            ? record.value
            : typeof record.details === "string"
              ? record.details
              : null;
    const subject =
      typeof record.subject === "string"
        ? record.subject
        : deriveFactSubject(summary, category);

    return extractedFactSchema.parse({
      category,
      subject,
      summary: summary ?? subject,
      details:
        typeof record.details === "string" && record.details.trim().length > 0
          ? record.details
          : null,
      confidence:
        typeof record.confidence === "number" ? record.confidence : null,
      sourceQuote:
        typeof record.sourceQuote === "string" ? record.sourceQuote : null,
      sourceReferences: Array.isArray(record.sourceReferences)
        ? record.sourceReferences
        : [],
    });
  }

  const category = fallbackCategory ?? "clue";
  const subject = deriveFactSubject(entry, category);

  return extractedFactSchema.parse({
    category,
    subject,
    summary: subject,
    confidence: null,
    sourceQuote: null,
    sourceReferences: [],
  });
}

function parseFactExtractionContent(content: string) {
  const parsed = parseRawJson(content);

  if (Array.isArray(parsed)) {
    return factExtractionResponseSchema.parse({
      facts: parsed.map((fact) => normalizeExtractedFact(fact)),
    });
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    groupedFactCategories.some((category) => category in parsed)
  ) {
    const groupedFacts = groupedFactCategories.flatMap((category) => {
      const entries = (parsed as Record<string, unknown>)[category];

      if (!Array.isArray(entries)) {
        return [];
      }

      return entries.map((entry) => normalizeExtractedFact(entry, category));
    });

    return factExtractionResponseSchema.parse({ facts: groupedFacts });
  }

  return factExtractionResponseSchema.parse(parsed);
}

function normalizeQuestConflictType(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (
      normalized === "social" ||
      normalized === "investigation" ||
      normalized === "combat" ||
      normalized === "exploration" ||
      normalized === "mixed"
    ) {
      return normalized;
    }
  }

  return "mixed" as const;
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function coerceQuestRewardList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      if (typeof entry === "object" && entry) {
        const record = entry as Record<string, unknown>;
        const type =
          typeof record.type === "string"
            ? record.type
            : typeof record.name === "string"
              ? record.name
              : `reward-${index + 1}`;
        const rewardValue =
          typeof record.value === "string"
            ? record.value
            : typeof record.summary === "string"
              ? record.summary
              : typeof record.description === "string"
                ? record.description
                : JSON.stringify(record);

        return { type, value: rewardValue };
      }

      return {
        type: `reward-${index + 1}`,
        value: typeof entry === "string" ? entry : String(entry),
      };
    });
  }

  if (typeof value === "object" && value) {
    return Object.entries(value as Record<string, unknown>).map(([type, rewardValue]) => ({
      type,
      value: typeof rewardValue === "string" ? rewardValue : JSON.stringify(rewardValue),
    }));
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [{ type: "reward", value: value.trim() }];
  }

  return [];
}

function normalizeQuestDraftContent(
  content: string,
  workingContext: TownQuestContext,
  questRequest: QuestRequest,
) {
  const parsed = parseRawJson(content);

  try {
    return questGenerationSchema.parse(parsed);
  } catch {
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Quest draft response was not a JSON object.");
    }

    const outerRecord = parsed as Record<string, unknown>;
    const record =
      outerRecord.quest && typeof outerRecord.quest === "object"
        ? (outerRecord.quest as Record<string, unknown>)
        : outerRecord;
    const locale = questRequest.locale ?? "zh";
    const townName = questRequest.townName || workingContext.town.name;
    const defaultConflict = normalizeQuestConflictType(questRequest.questType);
    const objectives = asStringList(record.objectives);
    const locations = [
      ...asStringList(record.locations),
      ...asStringList(record.keyLocations),
    ];
    const rawSteps = Array.isArray(record.steps) ? record.steps : [];
    const steps =
      rawSteps.length > 0
        ? rawSteps
        : objectives.length > 0
          ? objectives.map((goal, index) => ({ goal, title: `Step ${index + 1}` }))
          : [{ title: locale === "zh" ? "推进局势" : "Advance the situation" }];
    const scenes = steps.slice(0, 5).map((step, index) => {
      const stepRecord =
        typeof step === "object" && step ? (step as Record<string, unknown>) : null;
      const name =
        typeof stepRecord?.title === "string"
          ? stepRecord.title
          : typeof stepRecord?.name === "string"
            ? stepRecord.name
            : locale === "zh"
              ? `场景 ${index + 1}`
              : `Scene ${index + 1}`;
      const goal =
        typeof stepRecord?.goal === "string"
          ? stepRecord.goal
          : typeof step === "string"
            ? step
            : objectives[index] ??
              (locale === "zh" ? "推动支线局势前进" : "Push the side quest forward");
      const summary =
        typeof stepRecord?.summary === "string"
          ? stepRecord.summary
          : typeof stepRecord?.description === "string"
            ? stepRecord.description
            : goal;
      const location =
        typeof stepRecord?.location === "string"
          ? stepRecord.location
          : locations[index] ?? townName;
      const outcomeOptions = [
        ...asStringList(stepRecord?.outcomes),
        ...asStringList(stepRecord?.choices),
      ];

      return {
        name,
        goal,
        summary,
        location,
        conflictType: normalizeQuestConflictType(stepRecord?.conflictType ?? defaultConflict),
        outcomeOptions:
          outcomeOptions.length > 0
            ? outcomeOptions
            : [locale === "zh" ? "取得新的线索或主动权" : "Gain a new lead or the initiative"],
      };
    });
    while (scenes.length < 3) {
      scenes.push({
        name: locale === "zh" ? `补充场景 ${scenes.length + 1}` : `Added scene ${scenes.length + 1}`,
        goal:
          locale === "zh"
            ? "让支线继续向高潮推进"
            : "Keep the side quest moving toward its climax",
        summary:
          locale === "zh"
            ? "这是为兼容 provider 输出而补齐的过渡场景。"
            : "This is a compatibility filler scene for the provider output.",
        location: locations[scenes.length] ?? townName,
        conflictType: defaultConflict,
        outcomeOptions: [
          locale === "zh" ? "拿到新的线索或优势" : "Gain a new lead or advantage",
        ],
      });
    }

    const rawNpcs = Array.isArray(record.NPCs)
      ? record.NPCs
      : Array.isArray(record.npcs)
        ? record.npcs
        : Array.isArray(record.factions)
          ? record.factions
          : [];
    const npcs =
      rawNpcs.length > 0
        ? rawNpcs.map((entry, index) => {
            const npc =
              typeof entry === "object" && entry ? (entry as Record<string, unknown>) : null;
            return {
              name:
                typeof npc?.name === "string"
                  ? npc.name
                  : typeof npc?.subject === "string"
                    ? npc.subject
                    : `NPC ${index + 1}`,
              role:
                typeof npc?.role === "string"
                  ? npc.role
                  : typeof npc?.summary === "string"
                    ? npc.summary
                    : locale === "zh"
                      ? "城镇相关人物"
                      : "Town contact",
              motivation:
                typeof npc?.motivation === "string"
                  ? npc.motivation
                  : typeof npc?.goal === "string"
                    ? npc.goal
                    : locale === "zh"
                      ? "推动当前城镇局势"
                      : "Push the town situation forward",
              secret:
                typeof npc?.secret === "string"
                  ? npc.secret
                  : locale === "zh"
                    ? "他知道一些没说出口的东西。"
                    : "They know more than they are saying.",
            };
          })
        : [
            {
              name:
                workingContext.relevantNpcs[0]?.subject ??
                (locale === "zh" ? `${townName} 联络人` : `${townName} contact`),
              role: locale === "zh" ? "城镇联络人" : "Town contact",
              motivation:
                locale === "zh"
                  ? "稳定当前城镇压力"
                  : "Stabilize the current town pressure",
              secret:
                locale === "zh"
                  ? "他知道一些没说出口的东西。"
                  : "They know more than they are saying.",
            },
          ];

    const encounterGroups = [
      ...(Array.isArray(record.combat_encounters) ? record.combat_encounters : []),
      ...(Array.isArray(record.social_encounters) ? record.social_encounters : []),
      ...(Array.isArray(record.skill_challenges) ? record.skill_challenges : []),
      ...(Array.isArray(record.encounters) ? record.encounters : []),
      ...(Array.isArray(record.possibleEncounters) ? record.possibleEncounters : []),
    ];
    const encounters =
      encounterGroups.length > 0
        ? encounterGroups.slice(0, 3).map((entry, index) => {
            const encounter =
              typeof entry === "object" && entry ? (entry as Record<string, unknown>) : null;
            return {
              name:
                typeof encounter?.name === "string"
                  ? encounter.name
                  : typeof entry === "string"
                    ? entry
                    : locale === "zh"
                      ? `遭遇 ${index + 1}`
                      : `Encounter ${index + 1}`,
              difficultyTarget:
                typeof encounter?.difficultyTarget === "string"
                  ? encounter.difficultyTarget
                  : typeof encounter?.difficulty === "string"
                    ? encounter.difficulty
                    : "medium",
              purpose:
                typeof encounter?.purpose === "string"
                  ? encounter.purpose
                  : typeof encounter?.summary === "string"
                    ? encounter.summary
                    : locale === "zh"
                      ? "推动支线升级"
                      : "Escalate the side quest",
              notes:
                typeof encounter?.notes === "string"
                  ? encounter.notes
                  : typeof encounter?.description === "string"
                    ? encounter.description
                    : locale === "zh"
                      ? "根据当前 town context 调整细节。"
                      : "Tune details against the current town context.",
            };
          })
        : [
            {
              name: locale === "zh" ? "关键遭遇" : "Key encounter",
              difficultyTarget: "medium",
              purpose:
                locale === "zh"
                  ? "把支线推向高潮"
                  : "Push the side quest toward its climax",
              notes:
                locale === "zh"
                  ? "根据当前 town context 调整细节。"
                  : "Tune details against the current town context.",
            },
          ];

    const rewards = coerceQuestRewardList(record.rewards);

    return questGenerationSchema.parse({
      locale,
      title:
        typeof record.title === "string"
          ? record.title
          : typeof record.quest_title === "string"
            ? record.quest_title
            : locale === "zh"
              ? `${townName} 支线草稿`
              : `${townName} side quest draft`,
      premise:
        typeof record.premise === "string"
          ? record.premise
          : typeof record.summary === "string"
            ? record.summary
            : typeof record.background === "string"
              ? record.background
              : locale === "zh"
                ? "一条围绕当前城镇压力展开的支线。"
                : "A side quest built around the town's current pressure.",
      hook:
        typeof record.hook === "string"
          ? record.hook
          : typeof record.background === "string"
            ? record.background
            : typeof record.summary === "string"
              ? record.summary
              : locale === "zh"
                ? "城镇里的最新异常把队伍卷了进来。"
                : "The town's latest disturbance pulls the party in.",
      scenes,
      npcs,
      encounters,
      rewards:
        rewards.length > 0
          ? rewards
          : [
              {
                type: locale === "zh" ? "情报" : "information",
                value:
                  typeof record.follow_up === "string"
                    ? record.follow_up
                    : locale === "zh"
                      ? "获得一条回接主线的新线索。"
                      : "Gain a new lead that reconnects to the main plot.",
              },
            ],
      returnToMainPlot:
        typeof record.returnToMainPlot === "string"
          ? record.returnToMainPlot
          : typeof record.tieInToMainQuest === "string"
            ? record.tieInToMainQuest
            : typeof record.follow_up === "string"
              ? record.follow_up
              : typeof record.resolution === "string"
                ? record.resolution
                : locale === "zh"
                  ? "支线结尾留下了可以回接主线的明确线索。"
                  : "The ending leaves a clear route back to the main plot.",
      gmSummary:
        typeof record.gmSummary === "string"
          ? record.gmSummary
          : typeof record.dmNotes === "string"
            ? record.dmNotes
            : typeof record.dm_notes === "string"
              ? record.dm_notes
              : typeof record.summary === "string"
                ? record.summary
                : locale === "zh"
                  ? "这是一个经过 provider 兼容归一化后的支线草稿。"
                  : "This is a normalized side quest draft from the provider response.",
    });
  }
}

function buildFactPrompt(chunk: FactExtractionChunk) {
  return [
    "Extract canon facts from the campaign source chunk below.",
    "Return a single JSON object matching the requested schema.",
    "Use the categories location, npc, faction, event, clue, and override.",
    "Prefer concise subject names and summaries.",
    "",
    `Source document: ${chunk.sourceDocumentId}`,
    `Chunk index: ${chunk.chunkIndex}`,
    `Paragraph range: ${chunk.paragraphStartIndex}-${chunk.paragraphEndIndex}`,
    "",
    chunk.text,
  ].join("\n");
}

function normalizeSourceQuote(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toFactRecord(
  campaignId: string,
  chunk: FactExtractionChunk,
  fact: ExtractedFact,
): ExtractedCampaignFact {
  const documentChunkId =
    chunk.documentChunkId ?? `${chunk.sourceDocumentId}-chunk-${chunk.chunkIndex}`;

  return {
    ...fact,
    campaignId,
    sourceDocumentId: chunk.sourceDocumentId,
    documentChunkId,
    chunkIndex: chunk.chunkIndex,
    provenance: {
      sourceDocumentId: chunk.sourceDocumentId,
      documentChunkId,
      chunkIndex: chunk.chunkIndex,
      paragraphStartIndex: chunk.paragraphStartIndex,
      paragraphEndIndex: chunk.paragraphEndIndex,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      sourceQuote: normalizeSourceQuote(fact.sourceQuote),
    },
    sourceReferences: fact.sourceReferences.map((reference) => ({
      ...reference,
      sourceDocumentId: reference.sourceDocumentId ?? chunk.sourceDocumentId,
      documentChunkId: reference.documentChunkId ?? documentChunkId,
      sourceQuote: normalizeSourceQuote(reference.sourceQuote),
    })),
  };
}

function buildQuestPrompt(workingContext: TownQuestContext, questRequest: QuestRequest) {
  const locale = questRequest.locale ?? "zh";
  const isChinese = locale === "zh";
  const useQuickStart = questRequest.requestMode === "quick_start";
  const npcLines = workingContext.relevantNpcs
    .slice(0, 5)
    .map((fact) => `- ${fact.subject}: ${fact.value}`);
  const factionLines = workingContext.relevantFactions
    .slice(0, 5)
    .map((fact) => `- ${fact.subject}: ${fact.value}`);
  const deltaLines = workingContext.recentDeltas
    .slice(0, 5)
    .map((delta) => `- ${delta.summary}`);
  const hookLines = workingContext.openHooks.slice(0, 5).map((hook) => `- ${hook}`);

  const labels = isChinese
    ? {
        intro: "为一个正在进行中的 5e 战役生成一份可游玩的城镇支线模组草稿。",
        onlyJson: "只返回单个 JSON 对象，不要输出 JSON 之外的文字。",
        anchor: "确保支线锚定在指定城镇，并留出清晰的回主线路径。",
        campaignTone: "战役气质",
        partyLevel: "队伍等级",
        town: "城镇",
        townVibe: "城镇气质",
        localTension: "本地张力",
        questType: "支线类型",
        mainPlotRelation: "与主线关系",
        desiredLength: "期望长度",
        extraContext: "额外上下文",
        openHooks: "开放线索",
        relevantNpcs: "相关 NPC",
        relevantFactions: "相关阵营",
        recentDeltas: "最近的战役变化",
        noneRecorded: "暂无记录",
        unspecified: "未说明",
        none: "无",
        system:
          "你要为跑团战役生成结构化支线模组草稿，并且必须严格使用请求的语言输出。",
      }
    : {
        intro: "Generate a playable town side-quest draft for an ongoing 5e campaign.",
        onlyJson: "Return a single JSON object only. Do not output text outside the JSON.",
        anchor: "Anchor the quest in the requested town and leave a concrete return path to the main plot.",
        campaignTone: "Campaign tone",
        partyLevel: "Party level",
        town: "Town",
        townVibe: "Town vibe",
        localTension: "Local tension",
        questType: "Quest type",
        mainPlotRelation: "Main plot relation",
        desiredLength: "Desired length",
        extraContext: "Extra context",
        openHooks: "Open hooks",
        relevantNpcs: "Relevant NPCs",
        relevantFactions: "Relevant factions",
        recentDeltas: "Recent campaign deltas",
        noneRecorded: "None recorded",
        unspecified: "unspecified",
        none: "none",
        system:
          "You generate structured side-quest drafts for tabletop campaigns, and you must strictly output in the requested language.",
      };

  if (useQuickStart) {
    return {
      system: labels.system,
      user: [
        isChinese
          ? "你正在生成一个 GM 今晚就能开跑的短模组。"
          : "You are generating a self-contained short module a GM can run tonight.",
        isChinese
          ? "不要依赖已导入 canon；把这次输出写成自包含内容。"
          : "Do not rely on imported canon. Make the output self-contained.",
        isChinese
          ? "结果必须包含：强钩子、3 到 5 个场景、至少 2 个关键 NPC、至少 1 个遭遇、奖励和清晰结尾。"
          : "The result must include: a strong hook, 3 to 5 scenes, at least 2 key NPCs, at least 1 encounter, rewards, and a clear ending.",
        isChinese
          ? "按用户要求的时长控制节奏，优先保证同晚可跑。"
          : "Use the requested session length to control pacing and optimize for same-night playability.",
        "",
        `${labels.campaignTone}: ${workingContext.campaignTone}`,
        `${labels.partyLevel}: ${workingContext.partyLevel}`,
        `${labels.town}: ${questRequest.townName || workingContext.town.name}`,
        `${labels.townVibe}: ${questRequest.townVibe ?? workingContext.town.vibe ?? labels.unspecified}`,
        `${labels.localTension}: ${questRequest.localTension ?? workingContext.town.tension ?? labels.unspecified}`,
        `${labels.questType}: ${questRequest.questType ?? "mixed"}`,
        `${labels.desiredLength}: ${questRequest.desiredLength ?? "3h"}`,
        `${labels.extraContext}: ${questRequest.extraContext ?? labels.none}`,
      ].join("\n"),
    };
  }

  return {
    system: labels.system,
    user: [
      labels.intro,
      labels.onlyJson,
      labels.anchor,
      "",
      `${labels.campaignTone}: ${workingContext.campaignTone}`,
      `${labels.partyLevel}: ${workingContext.partyLevel}`,
      `${labels.town}: ${workingContext.town.name}`,
      `${labels.townVibe}: ${questRequest.townVibe ?? workingContext.town.vibe ?? labels.unspecified}`,
      `${labels.localTension}: ${questRequest.localTension ?? workingContext.town.tension ?? labels.unspecified}`,
      `${labels.questType}: ${questRequest.questType ?? "mixed"}`,
      `${labels.mainPlotRelation}: ${questRequest.mainPlotRelation ?? labels.unspecified}`,
      `${labels.desiredLength}: ${questRequest.desiredLength ?? "standard"}`,
      `${labels.extraContext}: ${questRequest.extraContext ?? labels.none}`,
      "",
      `${labels.openHooks}:`,
      ...(hookLines.length > 0 ? hookLines : [`- ${labels.noneRecorded}`]),
      "",
      `${labels.relevantNpcs}:`,
      ...(npcLines.length > 0 ? npcLines : [`- ${labels.noneRecorded}`]),
      "",
      `${labels.relevantFactions}:`,
      ...(factionLines.length > 0 ? factionLines : [`- ${labels.noneRecorded}`]),
      "",
      `${labels.recentDeltas}:`,
      ...(deltaLines.length > 0 ? deltaLines : [`- ${labels.noneRecorded}`]),
    ].join("\n"),
  };
}

export const anthropicAdapter: LlmProviderAdapter = {
  provider: "anthropic",
  defaultQuestModel: DEFAULT_MODEL,
  defaultFactModel: DEFAULT_MODEL,
  async generateQuestDraft({ config, workingContext, questRequest }) {
    if (shouldUseMockLlmProvider()) {
      throwMockProviderFailure(config);
      return buildMockQuestDraft({
        provider: "anthropic",
        workingContext,
        questRequest,
      });
    }

    if (!config.llmApiKey) {
      throw Object.assign(new Error("Missing Anthropic API key."), {
        code: "invalid_api_key",
        status: 401,
      });
    }

    const client = createAnthropicClient(config.llmApiKey, config.llmBaseUrl);
    const model = config.llmModel ?? DEFAULT_MODEL;
    const prompt = buildQuestPrompt(workingContext, questRequest);
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });

    return normalizeQuestDraftContent(
      extractTextContent(response.content),
      workingContext,
      questRequest,
    );
  },
  async extractFactsFromChunks({ config, campaignId, chunks }) {
    if (shouldUseMockLlmProvider()) {
      throwMockProviderFailure(config);
      return buildMockExtractedFacts({
        campaignId,
        chunks,
      });
    }

    if (!config.llmApiKey) {
      throw Object.assign(new Error("Missing Anthropic API key."), {
        code: "invalid_api_key",
        status: 401,
      });
    }

    const client = createAnthropicClient(config.llmApiKey, config.llmBaseUrl);
    const model = config.llmModel ?? DEFAULT_MODEL;
    const facts: ExtractedCampaignFact[] = [];

    for (const chunk of chunks) {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: "You extract campaign canon facts and return only structured JSON.",
        messages: [{ role: "user", content: buildFactPrompt(chunk) }],
      });

      const parsed = parseFactExtractionContent(extractTextContent(response.content));

      for (const fact of parsed.facts) {
        facts.push(toFactRecord(campaignId, chunk, fact));
      }
    }

    return facts;
  },
  async testConnection({ config }) {
    if (shouldUseMockLlmProvider()) {
      throwMockProviderFailure(config);
      return {
        provider: "anthropic",
        model: config.llmModel ?? DEFAULT_MODEL,
      };
    }

    if (!config.llmApiKey) {
      throw Object.assign(new Error("Missing Anthropic API key."), {
        code: "invalid_api_key",
        status: 401,
      });
    }

    const client = createAnthropicClient(config.llmApiKey, config.llmBaseUrl);
    const model = config.llmModel ?? DEFAULT_MODEL;
    const response = await client.messages.create({
      model,
      max_tokens: 128,
      messages: [
        {
          role: "user",
          content: 'Return exactly {"status":"ok"} and nothing else.',
        },
      ],
    });

    parseStructuredJson(connectionSchema, extractTextContent(response.content));
    return {
      provider: "anthropic",
      model,
    };
  },
};
