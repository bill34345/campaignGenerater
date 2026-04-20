import { zodTextFormat } from "openai/helpers/zod";
import type { TownQuestContext } from "@/lib/canon/context-builder";
import {
  createOpenAIResponsesClient,
  type OpenAIClientOptions,
  type OpenAIResponsesClient,
} from "@/lib/openai/client";
import { questGenerationSchema, type QuestGenerationDraft } from "@/lib/quests/quest-schema";
import type { QuestRequest } from "@/types/domain";

export type GenerateQuestDraftInput = {
  workingContext: TownQuestContext;
  questRequest: QuestRequest;
  client?: OpenAIResponsesClient;
  model?: string;
  openAI?: OpenAIClientOptions;
};

function buildPrompt(
  workingContext: TownQuestContext,
  questRequest: QuestRequest,
) {
  const locale = questRequest.locale ?? "zh";
  const isChinese = locale === "zh";
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
      }
    : {
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
      };

  return [
    isChinese
      ? "为一个正在进行中的 5e 战役生成一份可游玩的城镇支线模组草稿。"
      : "Generate a playable town side-quest draft for an ongoing 5e campaign.",
    isChinese
      ? "只返回结构化 JSON，不要输出 schema 之外的散文。"
      : "Return structured JSON only. Do not return prose outside the schema.",
    isChinese
      ? "确保支线锚定在指定城镇，并留出清晰的回主线路径。"
      : "Anchor the quest in the requested town and leave a concrete return path to the main plot.",
    "",
    `${labels.campaignTone}: ${workingContext.campaignTone}`,
    `${labels.partyLevel}: ${workingContext.partyLevel}`,
    `${labels.town}: ${workingContext.town.name}`,
    `${labels.townVibe}: ${questRequest.townVibe ?? workingContext.town.vibe ?? (isChinese ? "未说明" : "unspecified")}`,
    `${labels.localTension}: ${questRequest.localTension ?? workingContext.town.tension ?? (isChinese ? "未说明" : "unspecified")}`,
    `${labels.questType}: ${questRequest.questType ?? "mixed"}`,
    `${labels.mainPlotRelation}: ${questRequest.mainPlotRelation ?? (isChinese ? "未说明" : "unspecified")}`,
    `${labels.desiredLength}: ${questRequest.desiredLength ?? "standard"}`,
    `${labels.extraContext}: ${questRequest.extraContext ?? (isChinese ? "无" : "none")}`,
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
  ].join("\n");
}

export async function generateQuestDraft({
  workingContext,
  questRequest,
  client,
  model = "gpt-4.1-mini",
  openAI,
}: GenerateQuestDraftInput): Promise<QuestGenerationDraft> {
  const resolvedClient = client ?? createOpenAIResponsesClient(openAI);
  const locale = questRequest.locale ?? "zh";
  const response = await resolvedClient.responses.parse({
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              locale === "zh"
                ? "你要为跑团战役生成结构化支线模组草稿，并且必须严格使用请求的语言输出。"
                : "You generate structured side-quest drafts for tabletop campaigns, and you must strictly output in the requested language.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildPrompt(workingContext, questRequest),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(questGenerationSchema, "quest_draft"),
    },
  });

  return questGenerationSchema.parse(response.output_parsed);
}
