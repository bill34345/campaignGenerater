import type { TownQuestContext } from "@/lib/canon/context-builder";
import type { QuestGenerationDraft } from "@/lib/quests/quest-schema";
import type { QuestRequest } from "@/types/domain";

type SupportedQuestType =
  | "combat"
  | "exploration"
  | "social"
  | "investigation"
  | "mixed";
type SupportedLength = "short" | "standard" | "long";
type SupportedRelation = "standalone" | "foreshadow" | "follow-up" | "reveal";
type Locale = QuestRequest["locale"];

type DraftText = {
  defaultNpc: (townName: string) => string;
  questTitle: (townName: string, suffix: string) => string;
  premise: (townName: string, pressure: string, angle: string) => string;
  hook: (npc: string, townName: string, prompt: string) => string;
  npcRole: (townName: string) => string;
  npcMotivation: (townName: string, focus: string) => string;
  npcSecret: (detail: string) => string;
  rewardTypes: Record<"information" | "ally" | "gear", string>;
  rewardValue: {
    information: (lead: string) => string;
    ally: (townName: string) => string;
    gear: (townName: string) => string;
  };
  encounterNotes: {
    combat: string;
    exploration: string;
    social: string;
    investigation: string;
    mixed: string;
  };
  returnPath: Record<
    SupportedRelation,
    (townName: string, lead: string, delta: string) => string
  >;
  gmSummary: (
    townName: string,
    questType: SupportedQuestType,
    desiredLength: SupportedLength,
    relation: SupportedRelation,
  ) => string;
};

type SceneSeed = {
  name: string;
  goal: string;
  summary: string;
  location: string;
  conflictType: QuestGenerationDraft["scenes"][number]["conflictType"];
  outcomeOptions: string[];
};

type EncounterSeed = {
  name: string;
  difficultyTarget: string;
  purpose: string;
  notes: string;
};

type ProfileSeed = {
  suffix: string;
  angle: string;
  hookPrompt: string;
  motivation: string;
  secret: string;
  rewardType: "information" | "ally" | "gear";
  sceneSeeds: SceneSeed[];
  extraLongScene?: SceneSeed;
  primaryEncounter: EncounterSeed;
  extraLongEncounter?: EncounterSeed;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function asQuestType(value: string | null | undefined): SupportedQuestType {
  switch (normalizeText(value).toLowerCase()) {
    case "combat":
    case "exploration":
    case "social":
    case "investigation":
    case "mixed":
      return normalizeText(value).toLowerCase() as SupportedQuestType;
    default:
      return "mixed";
  }
}

function asDesiredLength(value: string | null | undefined): SupportedLength {
  switch (normalizeText(value).toLowerCase()) {
    case "short":
    case "long":
      return normalizeText(value).toLowerCase() as SupportedLength;
    default:
      return "standard";
  }
}

function asMainPlotRelation(value: string | null | undefined): SupportedRelation {
  switch (normalizeText(value).toLowerCase()) {
    case "standalone":
    case "foreshadow":
    case "follow-up":
    case "reveal":
      return normalizeText(value).toLowerCase() as SupportedRelation;
    default:
      return "foreshadow";
  }
}

function pickFirst(values: Array<string | null | undefined>, fallback: string) {
  return values.map(normalizeText).find(Boolean) ?? fallback;
}

function getText(locale: Locale): DraftText {
  if (locale === "en") {
    return {
      defaultNpc: (townName) => `${townName} watch captain`,
      questTitle: (townName, suffix) => `${townName}: ${suffix}`,
      premise: (townName, pressure, angle) =>
        `${townName} is straining under ${pressure.toLowerCase()}, and the town's next problem is about ${angle}.`,
      hook: (npc, townName, prompt) =>
        `${npc} asks the party to step into ${townName}'s latest crisis before it spills into open panic: ${prompt}`,
      npcRole: (townName) => `trusted local fixer in ${townName}`,
      npcMotivation: (townName, focus) => `keep ${townName} stable while forcing progress on ${focus}`,
      npcSecret: (detail) => `They already know ${detail}.`,
      rewardTypes: {
        information: "information",
        ally: "ally",
        gear: "gear",
      },
      rewardValue: {
        information: (lead) => lead,
        ally: (townName) => `A dependable town contact in ${townName} owes the party a favor.`,
        gear: (townName) => `A reclaimed field kit from ${townName}'s old stores gives the party a practical edge.`,
      },
      encounterNotes: {
        combat: "Use terrain pressure, narrow approach lanes, and a visible timer to keep the fight moving.",
        exploration: "Use unstable paths, hidden chambers, and layered clues instead of repeated combat pressure.",
        social: "Escalate the scene with public pressure, divided loyalties, and a visible cost for failure.",
        investigation: "Make the encounter about seizing evidence before it is destroyed or smuggled away.",
        mixed: "Blend leverage, movement pressure, and one sharp moment of violence.",
      },
      returnPath: {
        standalone: (townName, lead) =>
          `The fallout in ${townName} stays local, but the party leaves with ${lead.toLowerCase()} as optional future leverage.`,
        foreshadow: (townName, lead) =>
          `${lead} hints that the pressure in ${townName} is only one edge of a larger campaign threat.`,
        "follow-up": (townName, _lead, delta) =>
          `The outcome in ${townName} directly follows up on ${delta.toLowerCase()}, making the town's crisis a consequence rather than a detour.`,
        reveal: (townName, lead) =>
          `${lead} gives the party a high-confidence revelation in ${townName} that can point them straight back to the main plot.`,
      },
      gmSummary: (townName, questType, desiredLength, relation) =>
        `A ${desiredLength} ${questType}-leaning fallback quest for ${townName} with a ${relation} return path to the main campaign.`,
    };
  }

  return {
    defaultNpc: (townName) => `${townName}的守夜队长`,
    questTitle: (townName, suffix) => `${townName}：${suffix}`,
    premise: (townName, pressure, angle) =>
      `${townName} 正被“${pressure}”逼到失衡边缘，而下一场麻烦会围绕${angle}展开。`,
    hook: (npc, townName, prompt) =>
      `${npc} 请求队伍在 ${townName} 的局势彻底失控前介入：${prompt}`,
    npcRole: (townName) => `${townName} 里值得信任的地方联络人`,
    npcMotivation: (townName, focus) => `稳住 ${townName}，同时逼近关于${focus}的真相`,
    npcSecret: (detail) => `此人其实早就知道${detail}。`,
    rewardTypes: {
      information: "情报",
      ally: "盟友",
      gear: "装备",
    },
    rewardValue: {
      information: (lead) => lead,
      ally: (townName) => `${townName} 的一位关键本地联系人欠下队伍一个人情。`,
      gear: (townName) => `队伍从 ${townName} 的旧储备里取回一套实用装备。`,
    },
    encounterNotes: {
      combat: "用狭窄通道、地形压迫和明确倒计时把战斗推向高潮。",
      exploration: "用不稳地形、隐藏夹层和逐步发现取代重复战斗压力。",
      social: "让场面被围观者、分裂立场和失败代价不断加压。",
      investigation: "让遭遇围绕“抢在证据被销毁前拿到手”展开。",
      mixed: "把谈判、移动压迫和一次尖锐的暴力时刻混在一起。",
    },
    returnPath: {
      standalone: (townName, lead) =>
        `${townName} 的风波会先停留在本地，但队伍仍能带走“${lead}”作为以后可选的筹码。`,
      foreshadow: (_townName, lead) =>
        `${lead} 暗示这里的压力只是更大战役威胁露出的一个边角。`,
      "follow-up": (townName, _lead, delta) =>
        `${townName} 的这次支线直接承接了“${delta}”的后果，让它成为主线余波，而不是独立插曲。`,
      reveal: (_townName, lead) =>
        `${lead} 会在支线末尾形成一个高置信度揭示，把队伍直接引回主线。`,
    },
    gmSummary: (townName, questType, desiredLength, relation) =>
      `一个适用于 ${townName} 的${desiredLength === "long" ? "长篇" : desiredLength === "short" ? "短篇" : "标准"} ${questType}倾向回退支线，带有 ${relation} 风格的回主线路径。`,
  };
}

function buildProfile(
  questType: SupportedQuestType,
  townName: string,
  text: DraftText,
): ProfileSeed {
  const profiles: Record<SupportedQuestType, ProfileSeed> = {
    combat: {
      suffix: localeAware(text, "铁钟之战", "The Bellhouse Assault"),
      angle: localeAware(text, "一场必须正面解决的冲突", "a threat that must be met head-on"),
      hookPrompt: localeAware(text, "有人准备在夜里强行接管钟楼与地窖", "someone is about to seize the bellhouse and cellar by force"),
      motivation: localeAware(text, "钟楼袭击者的来路", "who armed the bellhouse raiders"),
      secret: localeAware(text, "袭击者不是第一次得到镇内接应", "the raiders already have inside help"),
      rewardType: "gear",
      sceneSeeds: [
        {
          name: localeAware(text, "战前动员", "War Room Briefing"),
          goal: localeAware(text, "锁定敌人会从哪里发难", "pin down where the attackers will strike"),
          summary: localeAware(text, "队伍需要在广场上集结可用人手并划定防线。", "The party must rally useful hands in the square and mark a defensible line."),
          location: `${townName} ${localeAware(text, "集市广场", "market square")}`,
          conflictType: "combat",
          outcomeOptions: [
            localeAware(text, "争取到第一轮先手", "Claim the first strike"),
            localeAware(text, "暴露敌人的进攻路线", "Expose the assault route"),
          ],
        },
        {
          name: localeAware(text, "钟楼突入", "Bellhouse Breach"),
          goal: localeAware(text, "在对手站稳前突破封锁", "break the blockade before the enemy digs in"),
          summary: localeAware(text, "狭窄楼梯和摇晃平台让推进本身就是一场战斗。", "Narrow stairs and unstable platforms turn the approach itself into a fight."),
          location: `${townName} ${localeAware(text, "钟楼楼梯", "bell tower stairs")}`,
          conflictType: "combat",
          outcomeOptions: [
            localeAware(text, "救下被困守卫", "Rescue trapped guards"),
            localeAware(text, "抢下制高点", "Take the upper platform"),
          ],
        },
        {
          name: localeAware(text, "地窖压制", "Cellar Suppression"),
          goal: localeAware(text, "击溃主力并带走证据", "break the main force and seize proof"),
          summary: localeAware(text, "最后的冲突会在地窖货架与钟绳之间爆发。", "The final clash erupts between cellar racks and hanging bell ropes."),
          location: `${townName} ${localeAware(text, "地窖货道", "cellar storage lanes")}`,
          conflictType: "combat",
          outcomeOptions: [
            localeAware(text, "抓住领头人", "Capture the ringleader"),
            localeAware(text, "缴获作战名单", "Seize the attack roster"),
          ],
        },
      ],
      extraLongScene: {
        name: localeAware(text, "清剿余波", "Mop-Up Sweep"),
        goal: localeAware(text, "堵住残余敌人的撤退口", "cut off the surviving raiders' retreat"),
        summary: localeAware(text, "队伍要在天亮前清剿还想携赃脱逃的小队。", "Before dawn, the party must cut off a splinter crew still trying to flee with contraband."),
        location: `${townName} ${localeAware(text, "后巷与码头通道", "back alleys and dock lanes")}`,
        conflictType: "combat",
        outcomeOptions: [
          localeAware(text, "保住缴获物", "Hold the seized goods"),
          localeAware(text, "确定幕后金主", "Confirm the paymaster"),
        ],
      },
      primaryEncounter: {
        name: localeAware(text, "钟楼火并", "Bellhouse melee"),
        difficultyTarget: "hard",
        purpose: localeAware(text, "把支线推向正面战斗高潮", "drive the quest into a direct combat climax"),
        notes: text.encounterNotes.combat,
      },
      extraLongEncounter: {
        name: localeAware(text, "码头追击", "Dockside pursuit"),
        difficultyTarget: "medium",
        purpose: localeAware(text, "让长篇版本多一段追击与收口", "give the long version an extra chase-and-cleanup beat"),
        notes: text.encounterNotes.combat,
      },
    },
    exploration: {
      suffix: localeAware(text, "钟楼深探", "The Sealed Tower Descent"),
      angle: localeAware(text, "一条需要被亲自走完的发现路径", "a route that must be discovered in person"),
      hookPrompt: localeAware(text, "有人在封闭区域里藏起了能解释现状的路径", "someone has hidden the route that explains the town's pressure"),
      motivation: localeAware(text, "封闭区域里到底藏着什么地形与旧痕迹", "what terrain and old traces are hidden inside the sealed zone"),
      secret: localeAware(text, "最危险的那条路其实早被人标记过", "the most dangerous route was already marked by someone local"),
      rewardType: "information",
      sceneSeeds: [
        {
          name: localeAware(text, "入口测绘", "Entry Survey"),
          goal: localeAware(text, "确认哪条入口仍然安全可走", "work out which approach is still traversable"),
          summary: localeAware(text, "队伍先在镇内比对旧地图与最新目击，决定从哪里进入。", "The party compares old maps to fresh reports to decide where to enter."),
          location: `${townName} ${localeAware(text, "旧钟楼外墙", "old bellhouse exterior")}`,
          conflictType: "exploration",
          outcomeOptions: [
            localeAware(text, "找到隐蔽入口", "Find the hidden entry"),
            localeAware(text, "避开塌陷区", "Avoid the collapse zone"),
          ],
        },
        {
          name: localeAware(text, "夹层探路", "Gallery Traverse"),
          goal: localeAware(text, "穿过危险夹层并记录线索", "cross the unstable galleries and document clues"),
          summary: localeAware(text, "错层平台、潮湿梁柱和废弃机关要求队伍稳步推进。", "Shifted platforms, wet beams, and dead mechanisms force a careful advance."),
          location: `${townName} ${localeAware(text, "钟楼夹层", "bellhouse galleries")}`,
          conflictType: "exploration",
          outcomeOptions: [
            localeAware(text, "标记安全路线", "Map a safe route"),
            localeAware(text, "发现旧货运井", "Discover the old cargo shaft"),
          ],
        },
        {
          name: localeAware(text, "地下发现", "Undercroft Discovery"),
          goal: localeAware(text, "在最深处找到真正的问题源头", "reach the true source of the pressure"),
          summary: localeAware(text, "最深处不是战场，而是一个被故意藏起来的通路与证据室。", "The deepest layer is not a battlefield but a concealed route and evidence cache."),
          location: `${townName} ${localeAware(text, "地下暗室", "undercroft vault")}`,
          conflictType: "exploration",
          outcomeOptions: [
            localeAware(text, "找到通往主线的线索", "Recover a lead back to the main plot"),
            localeAware(text, "带回完整地图", "Bring back the full route map"),
          ],
        },
      ],
      extraLongScene: {
        name: localeAware(text, "余脉追踪", "Residual Route Trace"),
        goal: localeAware(text, "确认这条路线还延伸到哪里", "learn where the route extends next"),
        summary: localeAware(text, "长篇版本里，队伍还要跟着新发现的痕迹再往外追一段。", "In the long version, the party follows the newly found traces one step further."),
        location: `${townName} ${localeAware(text, "潮湿排水道", "flooded drainage run")}`,
        conflictType: "exploration",
        outcomeOptions: [
          localeAware(text, "确认外部出口", "Confirm the outer exit"),
          localeAware(text, "标出补给藏点", "Mark a hidden cache"),
        ],
      },
      primaryEncounter: {
        name: localeAware(text, "坍塌夹层险局", "Collapsed gallery hazard"),
        difficultyTarget: "medium",
        purpose: localeAware(text, "让探索压力来源于环境，而不是正面战斗", "make the pressure environmental instead of purely combative"),
        notes: text.encounterNotes.exploration,
      },
      extraLongEncounter: {
        name: localeAware(text, "排水井险关", "Floodshaft hazard"),
        difficultyTarget: "medium",
        purpose: localeAware(text, "扩展长篇探索的地形挑战", "extend the long-form exploration challenge"),
        notes: text.encounterNotes.exploration,
      },
    },
    social: {
      suffix: localeAware(text, "钟声与盟约", "The Bellhouse Accord"),
      angle: localeAware(text, "一场靠立场与让步解决的城镇危机", "a crisis that turns on pressure and concessions"),
      hookPrompt: localeAware(text, "几个互相猜疑的阵营正把城镇往失控边缘推", "several suspicious factions are pushing the town toward a public break"),
      motivation: localeAware(text, "谁愿意先在公众面前让步", "which side will blink in public first"),
      secret: localeAware(text, "钟楼封锁其实服务于某个本地交易", "the bellhouse lockdown protects a private local deal"),
      rewardType: "ally",
      sceneSeeds: [
        {
          name: localeAware(text, "广场交锋", "Square Confrontation"),
          goal: localeAware(text, "找出最危险的立场裂口", "identify the sharpest political fault line"),
          summary: localeAware(text, "队伍需要在广场上控场，避免一场失控的公开争执。", "The party must control the crowd before a public dispute erupts."),
          location: `${townName} ${localeAware(text, "集市广场", "market square")}`,
          conflictType: "social",
          outcomeOptions: [
            localeAware(text, "拉拢摇摆方", "Pull a wavering faction across"),
            localeAware(text, "让强硬派失去话语权", "Strip the hardliners of momentum"),
          ],
        },
        {
          name: localeAware(text, "私下施压", "Backroom Pressure"),
          goal: localeAware(text, "逼关键人物暴露真实底线", "force the key broker to reveal their actual line"),
          summary: localeAware(text, "谈判桌上的每个让步都会改变钟楼局势的走向。", "Every concession in the backroom changes how the bellhouse conflict will land."),
          location: `${townName} ${localeAware(text, "议事室", "meeting chamber")}`,
          conflictType: "social",
          outcomeOptions: [
            localeAware(text, "拿到交换条件", "Secure a bargaining chip"),
            localeAware(text, "拆穿虚张声势", "Expose a bluff"),
          ],
        },
        {
          name: localeAware(text, "公开定局", "Public Settlement"),
          goal: localeAware(text, "在众目睽睽下敲定结果", "lock in the outcome under public scrutiny"),
          summary: localeAware(text, "最后的结果取决于队伍能否让几方在不失脸面的前提下让步。", "The final outcome depends on making each side yield without open humiliation."),
          location: `${townName} ${localeAware(text, "钟楼前台阶", "bellhouse steps")}`,
          conflictType: "social",
          outcomeOptions: [
            localeAware(text, "保住脆弱停火", "Secure a fragile truce"),
            localeAware(text, "逼出幕后安排", "Force out the hidden arrangement"),
          ],
        },
      ],
      extraLongScene: {
        name: localeAware(text, "善后安抚", "Aftermath Mediation"),
        goal: localeAware(text, "把谈判结果落实成可执行安排", "turn the deal into an enforceable settlement"),
        summary: localeAware(text, "长篇版本里，队伍要继续压住谈判后的反扑。", "In the long version, the party still has to manage the backlash that follows the deal."),
        location: `${townName} ${localeAware(text, "税务厅后室", "revenue office annex")}`,
        conflictType: "social",
        outcomeOptions: [
          localeAware(text, "争取公众支持", "Win public support"),
          localeAware(text, "稳住新盟友", "Stabilize a new ally"),
        ],
      },
      primaryEncounter: {
        name: localeAware(text, "公开争执", "Public pressure scene"),
        difficultyTarget: "medium",
        purpose: localeAware(text, "让社交型支线在关系和立场上形成高潮", "create a social climax built on reputation and leverage"),
        notes: text.encounterNotes.social,
      },
      extraLongEncounter: {
        name: localeAware(text, "谈判反扑", "Negotiation backlash"),
        difficultyTarget: "medium",
        purpose: localeAware(text, "让长篇社交版本多一轮后果处理", "add a second round of consequence management to the long social version"),
        notes: text.encounterNotes.social,
      },
    },
    investigation: {
      suffix: localeAware(text, "钟楼疑案", "The Bellhouse Ledger"),
      angle: localeAware(text, "一串需要被拼起来的线索链", "a clue chain that has to be assembled"),
      hookPrompt: localeAware(text, "有人正在赶在天亮前清理掉关键证据", "someone is clearing the key evidence before dawn"),
      motivation: localeAware(text, "谁在赶着清掉钟楼与地窖的证据", "who is racing to scrub the bellhouse and cellar clean"),
      secret: localeAware(text, "被毁掉的那部分记录才是最关键的", "the destroyed part of the record matters most"),
      rewardType: "information",
      sceneSeeds: [
        {
          name: localeAware(text, "目击者拼图", "Witness Grid"),
          goal: localeAware(text, "从彼此矛盾的口供中拼出时间线", "assemble a timeline from conflicting witness accounts"),
          summary: localeAware(text, "队伍需要判断谁说的是真话，谁只是想撇清自己。", "The party has to separate truthful fear from deliberate misdirection."),
          location: `${townName} ${localeAware(text, "集市广场", "market square")}`,
          conflictType: "investigation",
          outcomeOptions: [
            localeAware(text, "锁定嫌疑窗口", "Narrow the suspect window"),
            localeAware(text, "排除伪线索", "Eliminate a false lead"),
          ],
        },
        {
          name: localeAware(text, "封锁区取证", "Evidence Sweep"),
          goal: localeAware(text, "在证据消失前完成取证", "collect proof before it disappears"),
          summary: localeAware(text, "钟楼与地窖之间留下的痕迹会决定队伍接下来追谁。", "The traces between the bellhouse and cellar determine who the party chases next."),
          location: `${townName} ${localeAware(text, "钟楼与地窖间的封锁区", "sealed corridor between bellhouse and cellar")}`,
          conflictType: "investigation",
          outcomeOptions: [
            localeAware(text, "抢下账册碎页", "Secure torn ledger pages"),
            localeAware(text, "找到转运痕迹", "Find the transfer mark"),
          ],
        },
        {
          name: localeAware(text, "账册揭面", "Ledger Reveal"),
          goal: localeAware(text, "逼幕后操盘者露出名字或手法", "force the hidden operator into the open"),
          summary: localeAware(text, "最后不是打一仗，而是让零散证据汇成一个足够重的结论。", "The climax turns on making the clues cohere into one undeniable conclusion."),
          location: `${townName} ${localeAware(text, "地下账册间", "undercroft record room")}`,
          conflictType: "investigation",
          outcomeOptions: [
            localeAware(text, "确认主线关联人", "Confirm the main-plot contact"),
            localeAware(text, "保住关键证物", "Preserve the critical exhibit"),
          ],
        },
      ],
      extraLongScene: {
        name: localeAware(text, "外线核验", "Outer Lead Verification"),
        goal: localeAware(text, "验证这条证据链还能延伸到谁", "verify how far the evidence chain extends"),
        summary: localeAware(text, "长篇版本里，队伍会多花一幕去确认账册中的外部联系。", "In the long version, the party spends an extra beat verifying an outside connection in the ledger."),
        location: `${townName} ${localeAware(text, "旧税单库房", "old tax archive")}`,
        conflictType: "investigation",
        outcomeOptions: [
          localeAware(text, "锁定下一位联系人", "Identify the next contact"),
          localeAware(text, "确认交易模式", "Confirm the trade pattern"),
        ],
      },
      primaryEncounter: {
        name: localeAware(text, "抢证对抗", "Evidence seizure"),
        difficultyTarget: "medium",
        purpose: localeAware(text, "把调查推到必须马上行动的节点", "push the investigation into an urgent seize-the-proof moment"),
        notes: text.encounterNotes.investigation,
      },
      extraLongEncounter: {
        name: localeAware(text, "档案室追索", "Archive pursuit"),
        difficultyTarget: "medium",
        purpose: localeAware(text, "给长篇调查版增加第二轮证据争夺", "add a second evidence struggle to the long investigation version"),
        notes: text.encounterNotes.investigation,
      },
    },
    mixed: {
      suffix: localeAware(text, "钟楼余震", "After the Bell"),
      angle: localeAware(text, "一场必须同时处理人、路和冲突的复合危机", "a layered crisis that mixes people, movement, and one sharp clash"),
      hookPrompt: localeAware(text, "局势既需要谈也需要查，最后还可能要动手", "the situation needs negotiation, discovery, and maybe one hard strike"),
      motivation: localeAware(text, "是谁把几条线同时拧在了一起", "who tied several lines of pressure together"),
      secret: localeAware(text, "有人故意让几方误以为对方先动了手", "someone engineered the misunderstanding between the factions"),
      rewardType: "information",
      sceneSeeds: [
        {
          name: localeAware(text, "广场稳场", "Square Stabilization"),
          goal: localeAware(text, "先压住局面，再判断真正压力来自哪里", "stabilize the public scene before tracing the real pressure"),
          summary: localeAware(text, "队伍要同时安抚群众、问出消息，并防止局势提前爆炸。", "The party has to calm the crowd, gather facts, and prevent an early blowup."),
          location: `${townName} ${localeAware(text, "集市广场", "market square")}`,
          conflictType: "social",
          outcomeOptions: [
            localeAware(text, "换来短暂秩序", "Buy a moment of order"),
            localeAware(text, "听见关键名字", "Hear a key name"),
          ],
        },
        {
          name: localeAware(text, "钟楼搜索", "Tower Search"),
          goal: localeAware(text, "沿着线索找到真正的藏点", "follow the evidence to the actual cache"),
          summary: localeAware(text, "这一步既要移动，也要判断哪些痕迹是被故意留下来的。", "This beat mixes traversal with deciding which traces were planted on purpose."),
          location: `${townName} ${localeAware(text, "钟楼夹层", "bellhouse galleries")}`,
          conflictType: "exploration",
          outcomeOptions: [
            localeAware(text, "找到隐藏入口", "Find the hidden entry"),
            localeAware(text, "看穿诱饵痕迹", "See through the planted trail"),
          ],
        },
        {
          name: localeAware(text, "地下对峙", "Undercroft Reckoning"),
          goal: localeAware(text, "把谈判、证据和冲突一并收束", "collapse the negotiation, proof, and violence into one climax"),
          summary: localeAware(text, "最后一幕会逼队伍决定：先谈、先抢证据，还是先动手。", "The last beat forces the party to decide whether to talk, seize proof, or strike first."),
          location: `${townName} ${localeAware(text, "地下暗室", "undercroft chamber")}`,
          conflictType: "mixed",
          outcomeOptions: [
            localeAware(text, "保住证据", "Hold the evidence"),
            localeAware(text, "逼出幕后人", "Force out the hidden operator"),
          ],
        },
      ],
      extraLongScene: {
        name: localeAware(text, "事后追线", "Aftershock Follow-Through"),
        goal: localeAware(text, "确认余波会落到谁身上", "confirm who the fallout lands on next"),
        summary: localeAware(text, "长篇版本会多一幕处理余波，把支线结果更明确地接回主线。", "The long version spends one extra beat clarifying how the fallout reconnects to the main plot."),
        location: `${townName} ${localeAware(text, "码头后巷", "dockside alleys")}`,
        conflictType: "investigation",
        outcomeOptions: [
          localeAware(text, "留下可追踪尾巴", "Leave a traceable lead"),
          localeAware(text, "锁定下一步地点", "Lock in the next location"),
        ],
      },
      primaryEncounter: {
        name: localeAware(text, "钟楼混战", "Bellhouse pressure cooker"),
        difficultyTarget: "medium",
        purpose: localeAware(text, "让混合型支线在不同手段之间做选择", "force tradeoffs between social pressure, discovery, and force"),
        notes: text.encounterNotes.mixed,
      },
      extraLongEncounter: {
        name: localeAware(text, "余波追索", "Aftershock pursuit"),
        difficultyTarget: "medium",
        purpose: localeAware(text, "让长篇混合版多一次收束余波的动作", "add one more fallout-closing action beat to the long mixed version"),
        notes: text.encounterNotes.mixed,
      },
    },
  };

  return profiles[questType];
}

function localeAware(text: DraftText, zh: string, en: string) {
  return text.rewardTypes.information === "information" ? en : zh;
}

function buildScenes(
  profile: ProfileSeed,
  desiredLength: SupportedLength,
): SceneSeed[] {
  if (desiredLength === "long" && profile.extraLongScene) {
    return [...profile.sceneSeeds, profile.extraLongScene];
  }

  return profile.sceneSeeds;
}

function buildEncounters(
  text: DraftText,
  profile: ProfileSeed,
  questType: SupportedQuestType,
  desiredLength: SupportedLength,
): EncounterSeed[] {
  const first = {
    ...profile.primaryEncounter,
    notes: profile.primaryEncounter.notes || text.encounterNotes[questType],
  };

  if (desiredLength === "long" && profile.extraLongEncounter) {
    return [first, profile.extraLongEncounter];
  }

  return [first];
}

function buildReturnPath(
  text: DraftText,
  relation: SupportedRelation,
  townName: string,
  lead: string,
  delta: string,
  desiredLength: SupportedLength,
) {
  const base = text.returnPath[relation](townName, lead, delta);

  if (desiredLength === "long") {
    return `${base} ${
      text.rewardTypes.information === "information"
        ? "It leaves enough connective tissue for a full next-session handoff."
        : "它还会留下足够清晰的余波，方便下一次开团直接接回主线。"
    }`;
  }

  if (desiredLength === "short") {
    return `${base} ${
      text.rewardTypes.information === "information"
        ? "Use a single strong clue to hand the party back to the campaign."
        : "用一条最强线索把队伍迅速送回主线。"
    }`;
  }

  return base;
}

type QuickStartLength = "90m" | "3h" | "2 sessions";

function asQuickStartLength(value: string | null | undefined): QuickStartLength {
  switch (normalizeText(value).toLowerCase()) {
    case "90m":
    case "2 sessions":
      return normalizeText(value).toLowerCase() as QuickStartLength;
    default:
      return "3h";
  }
}

function mapQuickStartLengthToSupportedLength(
  desiredLength: QuickStartLength,
): SupportedLength {
  if (desiredLength === "90m") {
    return "short";
  }

  if (desiredLength === "2 sessions") {
    return "long";
  }

  return "standard";
}

function buildQuickStartScenes(input: {
  locale: Locale;
  townName: string;
  pressure: string;
  baseScenes: SceneSeed[];
  desiredLength: QuickStartLength;
}): SceneSeed[] {
  const bridgeScene: SceneSeed =
    input.locale === "zh"
      ? {
          name: "压力升级",
          goal: "把线索和城镇危机拧到一起",
          summary: `新的证词显示 ${input.townName} 的危机比表面更近，必须马上行动。`,
          location: `${input.townName} 的关键街区`,
          conflictType: "social",
          outcomeOptions: ["稳住局势", "锁定真正威胁"],
        }
      : {
          name: "Pressure spike",
          goal: "Bind the clue trail to the town crisis",
          summary: `Fresh testimony shows ${input.townName}'s problem is more immediate than it first appeared.`,
          location: `${input.townName}'s pressure point`,
          conflictType: "social",
          outcomeOptions: ["Stabilize the crowd", "Identify the real threat"],
        };

  const finaleScene: SceneSeed =
    input.locale === "zh"
      ? {
          name: "收束与余波",
          goal: "给今晚的冒险一个可执行结尾",
          summary: `处理 ${input.pressure} 带来的余波，并把后续线索交回主线。`,
          location: `${input.townName} 的善后现场`,
          conflictType: "mixed",
          outcomeOptions: ["留下清晰线索", "稳住本地秩序"],
        }
      : {
          name: "Resolution and fallout",
          goal: "Give the module a playable closing beat",
          summary: `Deal with the fallout of ${input.pressure.toLowerCase()} and hand one clear lead back to the campaign.`,
          location: `${input.townName}'s aftermath scene`,
          conflictType: "mixed",
          outcomeOptions: ["Leave a clear lead", "Stabilize the town"],
        };

  if (input.desiredLength === "90m") {
    return input.baseScenes.slice(0, 3);
  }

  if (input.desiredLength === "2 sessions") {
    return [...input.baseScenes.slice(0, 3), bridgeScene, finaleScene];
  }

  return [...input.baseScenes.slice(0, 3), bridgeScene];
}

function buildQuickStartEncounters(input: {
  locale: Locale;
  baseEncounters: EncounterSeed[];
  townName: string;
  desiredLength: QuickStartLength;
}): EncounterSeed[] {
  const wrapEncounter: EncounterSeed =
    input.locale === "zh"
      ? {
          name: "余波阻击",
          difficultyTarget: "medium",
          purpose: `在 ${input.townName} 的结尾阶段制造最后压力`,
          notes: "把时间压力、地形和目标保护结合起来。",
        }
      : {
          name: "Aftershock interception",
          difficultyTarget: "medium",
          purpose: `Add one final pressure beat to ${input.townName}'s closing stretch`,
          notes: "Combine time pressure, awkward terrain, and something worth protecting.",
        };

  if (input.desiredLength === "2 sessions") {
    return [...input.baseEncounters, wrapEncounter];
  }

  return input.baseEncounters;
}

export function buildFallbackQuestDraft({
  workingContext,
  questRequest,
}: {
  workingContext: TownQuestContext;
  questRequest: QuestRequest;
}): QuestGenerationDraft {
  const locale = questRequest.locale ?? "zh";
  const isQuickStart = questRequest.requestMode === "quick_start";
  const text = getText(locale);
  const townName = normalizeText(questRequest.townName) || workingContext.town.name;
  const questType = asQuestType(questRequest.questType);
  const desiredLength = isQuickStart
    ? mapQuickStartLengthToSupportedLength(
        asQuickStartLength(questRequest.desiredLength),
      )
    : asDesiredLength(questRequest.desiredLength);
  const relation = asMainPlotRelation(questRequest.mainPlotRelation);
  const pressure = pickFirst(
    [questRequest.localTension, workingContext.town.tension],
    locale === "zh" ? "城里的某些事情正在失去控制。" : "something in town is slipping out of control.",
  );
  const lead = pickFirst(
    [workingContext.relevantFactions[0]?.value, questRequest.extraContext],
    locale === "zh"
      ? "一条能回指更大战役威胁的明确线索。"
      : "a concrete lead that points back to the wider campaign threat.",
  );
  const mainNpc = pickFirst(
    [workingContext.relevantNpcs[0]?.subject],
    text.defaultNpc(townName),
  );
  const delta = pickFirst(
    [workingContext.recentDeltas[0]?.summary],
    locale === "zh" ? "最近的城镇变化仍未被解释。" : "the town's recent change still has no clear explanation.",
  );
  const hookPrompt = pickFirst(
    [workingContext.openHooks[0], questRequest.extraContext],
    locale === "zh" ? "局势已经拖到不能再拖。" : "the town cannot afford to wait any longer.",
  );
  const profile = buildProfile(questType, townName, text);

  const scenes = buildScenes(profile, desiredLength);
  const encounters = buildEncounters(text, profile, questType, desiredLength);

  if (isQuickStart) {
    const quickStartLength = asQuickStartLength(questRequest.desiredLength);
    const quickStartScenes = buildQuickStartScenes({
      locale,
      townName,
      pressure,
      baseScenes: scenes,
      desiredLength: quickStartLength,
    });
    const quickStartEncounters = buildQuickStartEncounters({
      locale,
      baseEncounters: encounters,
      townName,
      desiredLength: quickStartLength,
    });
    const supportNpc =
      locale === "zh"
        ? `质疑一切的 ${townName} 守夜人`
        : `The skeptical watchkeeper of ${townName}`;

    return {
      locale,
      title: text.questTitle(townName, profile.suffix),
      premise: text.premise(townName, pressure, profile.angle),
      hook: text.hook(mainNpc, townName, hookPrompt),
      scenes: quickStartScenes,
      npcs: [
        {
          name: mainNpc,
          role: text.npcRole(townName),
          motivation: text.npcMotivation(townName, profile.motivation),
          secret: text.npcSecret(profile.secret),
        },
        {
          name: supportNpc,
          role:
            locale === "zh"
              ? "提供阻力，也提供错误判断"
              : "adds friction and a useful bad assumption",
          motivation:
            locale === "zh"
              ? "先保住秩序，再考虑真相"
              : "preserve order before truth",
          secret:
            locale === "zh"
              ? "他隐瞒了自己错过的一条关键线索"
              : "they are hiding the clue they missed",
        },
      ],
      encounters: quickStartEncounters,
      rewards: [
        {
          type: text.rewardTypes[profile.rewardType],
          value: text.rewardValue[profile.rewardType](
            profile.rewardType === "information" ? lead : townName,
          ),
        },
      ],
      returnToMainPlot: buildReturnPath(
        text,
        relation,
        townName,
        lead,
        delta,
        desiredLength,
      ),
      gmSummary:
        locale === "zh"
          ? `一个适合 ${quickStartLength} 的 Quick Start 短模组，强调同晚可跑与清晰收束。`
          : `A Quick Start short module tuned for ${quickStartLength} and ready for same-night play.`,
    };
  }

  return {
    locale,
    title: text.questTitle(townName, profile.suffix),
    premise: text.premise(townName, pressure, profile.angle),
    hook: text.hook(mainNpc, townName, hookPrompt),
    scenes,
    npcs: [
      {
        name: mainNpc,
        role: text.npcRole(townName),
        motivation: text.npcMotivation(townName, profile.motivation),
        secret: text.npcSecret(profile.secret),
      },
    ],
    encounters,
    rewards: [
      {
        type: text.rewardTypes[profile.rewardType],
        value: text.rewardValue[profile.rewardType](
          profile.rewardType === "information" ? lead : townName,
        ),
      },
    ],
    returnToMainPlot: buildReturnPath(
      text,
      relation,
      townName,
      lead,
      delta,
      desiredLength,
    ),
    gmSummary: text.gmSummary(townName, questType, desiredLength, relation),
  };
}
