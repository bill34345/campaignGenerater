import type { FactCategory } from "@/lib/llm/fact-schema";
import type { FactExtractionChunk, ExtractedCampaignFact } from "@/lib/llm/extract-facts";

const CATEGORY_MAP: Record<string, FactCategory> = {
  town: "location",
  location: "location",
  城镇: "location",
  地点: "location",
  npc: "npc",
  npc角色: "npc",
  faction: "faction",
  阵营: "faction",
  hook: "clue",
  线索: "clue",
  提示: "clue",
  clue: "clue",
  override: "override",
  改写: "override",
  变更: "override",
  覆盖: "override",
  事件: "event",
};

function normalizeLine(value: string) {
  return value.trim();
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function inferTownName(text: string) {
  const townMatch = text.match(/(?:Town|城镇|地点):\s*([^\n\r]+)/i);
  if (townMatch?.[1]) {
    return townMatch[1].trim();
  }

  const inTownMatch = text.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  return inTownMatch?.[1]?.trim() ?? "Town Center";
}

function normalizeCategoryKey(value: string) {
  return value.trim().toLowerCase();
}

function isChineseCategoryKey(value: string) {
  return /[\u4e00-\u9fff]/.test(value);
}

function inferSubject(category: FactCategory, summary: string, townName: string) {
  if (category === "location") {
    if (/^town\b/i.test(summary) || summary === townName) {
      return townName;
    }

    return townName;
  }

  if (category === "npc") {
    if (/[\u4e00-\u9fff]/.test(summary)) {
      const chineseSubject = summary.match(
        /^([\u4e00-\u9fffA-Za-z0-9·]{2,12}?)(?=(仍然|正在|会|将|负责|维持|看守|提供|守护|保护|请求|保持|在|对|与|和|，|。|：|:))/,
      );
      if (chineseSubject?.[1]) {
        return chineseSubject[1].trim();
      }
    }

    const npcMatch = summary.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    return npcMatch?.[1]?.trim() ?? "Local Contact";
  }

  if (category === "faction") {
    if (/[\u4e00-\u9fff]/.test(summary)) {
      const chineseFaction = summary.match(
        /^([\u4e00-\u9fffA-Za-z0-9·]{2,16}?)(?=(阵营|组织|派系|正在|负责|在|与|和|，|。|：|:))/,
      );
      if (chineseFaction?.[1]) {
        return chineseFaction[1].trim();
      }
    }

    const factionMatch = summary.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    return factionMatch?.[1]?.trim() ?? `${townName} Faction`;
  }

  return `${townName} Hook`;
}

function toFactType(category: FactCategory) {
  switch (category) {
    case "location":
      return "town-landmark";
    case "npc":
      return "npc-role";
    case "faction":
      return "faction-agenda";
    case "override":
      return "override-note";
    case "clue":
    default:
      return "plot-hook";
  }
}

export function extractFallbackFactsFromChunks({
  campaignId,
  chunks,
}: {
  campaignId: string;
  chunks: FactExtractionChunk[];
}): ExtractedCampaignFact[] {
  const facts: ExtractedCampaignFact[] = [];

  for (const chunk of chunks) {
    const townName = inferTownName(chunk.text);
    const lines = chunk.text
      .split(/\r?\n+/)
      .map(normalizeLine)
      .filter(Boolean);

    for (const line of lines) {
      const match = line.match(/^([A-Za-z\u4e00-\u9fff]+):\s*(.+)$/);
      if (!match) {
        continue;
      }

      const rawCategory = normalizeCategoryKey(match[1]);
      const category = CATEGORY_MAP[rawCategory];
      if (!category) {
        continue;
      }

      const summary = match[2].trim();
      const subject =
        rawCategory === "town" || rawCategory === "城镇"
          ? isChineseCategoryKey(summary)
            ? summary
            : titleCase(summary)
          : inferSubject(category, summary, townName);
      const documentChunkId =
        chunk.documentChunkId ?? `${chunk.sourceDocumentId}-chunk-${chunk.chunkIndex}`;

      facts.push({
        campaignId,
        category,
        subject,
        summary,
        details: null,
        confidence: 0.65,
        sourceQuote: summary,
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
          sourceQuote: summary,
        },
        sourceReferences: [
          {
            sourceDocumentId: chunk.sourceDocumentId,
            documentChunkId,
            pageStart: chunk.pageStart,
            pageEnd: chunk.pageEnd,
            sourceQuote: summary,
          },
        ],
      });
    }

    if (facts.length === 0) {
      const documentChunkId =
        chunk.documentChunkId ?? `${chunk.sourceDocumentId}-chunk-${chunk.chunkIndex}`;

      facts.push({
        campaignId,
        category: "clue",
        subject: `${townName} Hook`,
        summary: chunk.text.trim(),
        details: null,
        confidence: 0.5,
        sourceQuote: chunk.text.trim(),
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
          sourceQuote: chunk.text.trim(),
        },
        sourceReferences: [
          {
            sourceDocumentId: chunk.sourceDocumentId,
            documentChunkId,
            pageStart: chunk.pageStart,
            pageEnd: chunk.pageEnd,
            sourceQuote: chunk.text.trim(),
          },
        ],
      });
    }
  }

  return facts;
}

export { toFactType };
