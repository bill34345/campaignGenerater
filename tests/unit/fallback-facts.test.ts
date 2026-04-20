import { describe, expect, it } from "vitest";
import { extractFallbackFactsFromChunks } from "@/lib/llm/fallback-facts";

describe("extractFallbackFactsFromChunks", () => {
  it("extracts structured facts from Chinese source lines", () => {
    const facts = extractFallbackFactsFromChunks({
      campaignId: "camp_1",
      chunks: [
        {
          chunkIndex: 0,
          sourceDocumentId: "doc_1",
          pageStart: 1,
          pageEnd: 1,
          paragraphStartIndex: 0,
          paragraphEndIndex: 4,
          text: [
            "城镇: 瓦拉奇",
            "地点: 教堂与酒馆是当前最关键的公开区域。",
            "NPC: 卢西安神父仍然维持教堂秩序。",
            "改写: GM 已经把伊泽克设定为受伤但仍在场。",
          ].join("\n"),
        },
      ],
    });

    expect(facts).toHaveLength(4);
    expect(facts[0]).toMatchObject({
      category: "location",
      subject: "瓦拉奇",
      summary: "瓦拉奇",
    });
    expect(facts[1]).toMatchObject({
      category: "location",
      subject: "瓦拉奇",
    });
    expect(facts[2]).toMatchObject({
      category: "npc",
      subject: "卢西安神父",
    });
    expect(facts[3]).toMatchObject({
      category: "override",
      subject: "瓦拉奇 Hook",
    });
  });
});
