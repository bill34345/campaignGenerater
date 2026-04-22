import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TownQuestContext } from "@/lib/canon/context-builder";
import type { QuestRequest, TownProfile } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  messagesCreate: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = {
      create: mocks.messagesCreate,
    };
  }

  return {
    default: MockAnthropic,
  };
});

import { anthropicAdapter } from "@/lib/llm/providers/anthropic";

function createTownProfile(): TownProfile {
  return {
    id: "town_1",
    campaignId: "camp_1",
    name: "Duskport",
    vibe: "Quiet and isolated",
    tension: "Goblins are raiding the forest edge.",
    notes: null,
    questHooks: ["The bell tower glows at dusk."],
  };
}

function createWorkingContext(): TownQuestContext {
  return {
    campaignId: "camp_1",
    campaignTone: "Time-loop mystery",
    partyLevel: 4,
    town: createTownProfile(),
    townFacts: [],
    relevantNpcs: [],
    relevantFactions: [],
    recentDeltas: [],
    openHooks: ["The town clock skips one hour every night."],
  };
}

function createQuickStartRequest(): QuestRequest {
  return {
    id: "req_1",
    campaignId: "camp_1",
    townProfileId: null,
    generationStatus: "queued",
    generationStage: "queued",
    townName: "Duskport",
    locale: "zh",
    townVibe: "悠远僻静、与世无争",
    localTension: "森林里的哥布林开始袭扰小镇。",
    questType: "mixed",
    mainPlotRelation: null,
    desiredLength: "2 sessions",
    extraContext: "不要 PVP，时间循环是核心。",
    requestMode: "quick_start",
  };
}

describe("anthropic provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes markdown quest output into a valid draft", async () => {
    mocks.messagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: [
            "# 暮港迷宫：永夜之钟",
            "",
            "暮港最近每到黄昏就会重复同一小时，镇民以为自己只是短暂失神。",
            "",
            "玩家会先在钟楼前接到求助，然后发现森林哥布林在替某个隐藏势力搜集能稳定时间裂缝的零件。",
            "",
            "最终真相会指向更大的时间悖论主线。",
          ].join("\n"),
        },
      ],
    });

    const draft = await anthropicAdapter.generateQuestDraft({
      config: {
        llmProvider: "anthropic",
        llmApiKey: "anthropic-test-key",
        llmModel: "minimax-m2.7",
        llmBaseUrl: "https://api.minimaxi.com/anthropic",
      },
      workingContext: createWorkingContext(),
      questRequest: createQuickStartRequest(),
    });

    expect(draft.title).toContain("暮港迷宫");
    expect(draft.scenes).toHaveLength(3);
    expect(draft.npcs).toHaveLength(2);
    expect(draft.encounters).toHaveLength(1);
    expect(draft.returnToMainPlot).toContain("主线");
    expect(draft.gmSummary.length).toBeGreaterThan(0);
    expect(draft.scenes.every((scene) => scene.location.includes("Duskport"))).toBe(true);
  });

  it("uses readable Chinese quick-start instructions for generation", async () => {
    mocks.messagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"title":"暮港之夜","premise":"暮港陷入时间回环。","hook":"镇长求助。","scenes":[{"name":"场景一","goal":"调查钟楼","summary":"队伍调查钟楼。","location":"Duskport","conflictType":"investigation","outcomeOptions":["发现线索"]},{"name":"场景二","goal":"进入森林","summary":"追踪哥布林。","location":"Duskport outskirts","conflictType":"exploration","outcomeOptions":["找到营地"]},{"name":"场景三","goal":"关闭裂缝","summary":"终结循环。","location":"Duskport ruins","conflictType":"mixed","outcomeOptions":["关闭裂缝"]}],"npcs":[{"name":"艾琳","role":"镇长","motivation":"救下小镇","secret":"她听见过未来的钟声"},{"name":"布林克","role":"哥布林斥候","motivation":"活命","secret":"他知道幕后买家"}],"encounters":[{"name":"钟楼伏击","difficultyTarget":"medium","purpose":"逼出线索","notes":"利用狭窄楼梯。"}],"rewards":[{"type":"information","value":"获得通往主线的时间坐标。"}],"returnToMainPlot":"时间坐标直接指向主线中的悖论源头。","gmSummary":"一个适合同晚开跑的暮港短模组。","locale":"zh"}',
        },
      ],
    });

    await anthropicAdapter.generateQuestDraft({
      config: {
        llmProvider: "anthropic",
        llmApiKey: "anthropic-test-key",
        llmModel: "minimax-m2.7",
        llmBaseUrl: "https://api.minimaxi.com/anthropic",
      },
      workingContext: createWorkingContext(),
      questRequest: createQuickStartRequest(),
    });

    expect(mocks.messagesCreate).toHaveBeenCalledTimes(1);
    expect(mocks.messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("结构化支线模组草稿"),
        messages: [
          {
            role: "user",
            content: expect.stringContaining("不要依赖已导入的 canon"),
          },
        ],
      }),
    );
  });
});
