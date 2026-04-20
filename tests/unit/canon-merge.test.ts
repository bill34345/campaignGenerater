import { describe, expect, it } from "vitest";
import { mergeCanonFacts } from "@/lib/canon/merge";
import type { CanonFact } from "@/types/domain";

describe("mergeCanonFacts", () => {
  it("groups canon facts by entity with nested fact groups and tracks conflicts", () => {
    const facts: CanonFact[] = [
      {
        id: "fact_1",
        campaignId: "camp_1",
        sourceDocumentId: "doc_1",
        documentChunkId: "chunk_1",
        subject: "Bell Tower",
        factType: "location-status",
        value: "Sealed at dusk",
        status: "active",
        priority: 5,
        confidence: 0.91,
        evidence: "The old bell tower is sealed at dusk.",
      },
      {
        id: "fact_2",
        campaignId: "camp_1",
        sourceDocumentId: "doc_2",
        documentChunkId: "chunk_2",
        subject: "Bell Tower",
        factType: "location-status",
        value: "Open all night",
        status: "active",
        priority: 9,
        confidence: 0.73,
        evidence: "Locals insist the bell tower stays open through the night.",
      },
      {
        id: "fact_3",
        campaignId: "camp_1",
        sourceDocumentId: "doc_3",
        documentChunkId: "chunk_3",
        subject: "Bell Tower",
        factType: "location-status",
        value: "Open all night",
        status: "uncertain",
        priority: 4,
        confidence: 0.44,
        evidence: "An old diary claims the tower never closes.",
      },
      {
        id: "fact_4",
        campaignId: "camp_1",
        sourceDocumentId: "doc_4",
        documentChunkId: "chunk_4",
        subject: "Harbormaster",
        factType: "npc-trait",
        value: "Missing left hand",
        status: "active",
        priority: 3,
        confidence: 0.82,
        evidence: "The harbormaster gestures with a metal hook.",
      },
    ];

    const merged = mergeCanonFacts(facts);

    expect(merged.groups).toHaveLength(2);

    const bellTowerEntity = merged.groups.find(
      (group) => group.subject === "Bell Tower",
    );
    const bellTowerGroup = bellTowerEntity?.factGroups.find(
      (group) => group.factType === "location-status",
    );

    expect(bellTowerEntity).toMatchObject({
      key: "Bell Tower",
      subject: "Bell Tower",
      conflict: true,
    });
    expect(bellTowerGroup).toMatchObject({
      key: "Bell Tower::location-status",
      factType: "location-status",
      activeFactId: "fact_2",
      conflict: true,
      candidateFactIds: ["fact_2", "fact_1", "fact_3"],
      overriddenFactIds: [],
      selectedFactIds: ["fact_2"],
      canonicalEntry: null,
    });
    expect(bellTowerGroup?.activeFact?.value).toBe("Open all night");
    expect(bellTowerGroup?.candidates.map((fact) => fact.id)).toEqual([
      "fact_2",
      "fact_1",
      "fact_3",
    ]);
    expect(bellTowerGroup?.candidates.map((fact) => fact.status)).toEqual([
      "active",
      "active",
      "uncertain",
    ]);

    expect(merged.conflictGroups).toEqual([
      expect.objectContaining({
        key: "Bell Tower",
        subject: "Bell Tower",
      }),
    ]);

    const harbormasterEntity = merged.groups.find(
      (group) => group.subject === "Harbormaster",
    );
    const harbormasterGroup = harbormasterEntity?.factGroups.find(
      (group) => group.factType === "npc-trait",
    );

    expect(harbormasterEntity).toMatchObject({
      key: "Harbormaster",
      subject: "Harbormaster",
      conflict: false,
    });
    expect(harbormasterGroup).toMatchObject({
      key: "Harbormaster::npc-trait",
      activeFactId: "fact_4",
      conflict: false,
      candidateFactIds: ["fact_4"],
      overriddenFactIds: [],
      selectedFactIds: ["fact_4"],
      canonicalEntry: null,
    });
    expect(merged.allFacts.map((fact) => [fact.id, fact.status])).toEqual([
      ["fact_2", "active"],
      ["fact_1", "active"],
      ["fact_3", "uncertain"],
      ["fact_4", "active"],
    ]);
  });

  it("respects an explicit overridden status for the highest-priority fact", () => {
    const facts: CanonFact[] = [
      {
        id: "fact_1",
        campaignId: "camp_1",
        sourceDocumentId: "doc_1",
        documentChunkId: "chunk_1",
        subject: "Bell Tower",
        factType: "location-status",
        value: "Sealed at dusk",
        status: "active",
        priority: 5,
        confidence: 0.91,
        evidence: "The old bell tower is sealed at dusk.",
      },
      {
        id: "fact_2",
        campaignId: "camp_1",
        sourceDocumentId: "doc_2",
        documentChunkId: "chunk_2",
        subject: "Bell Tower",
        factType: "location-status",
        value: "Open all night",
        status: "overridden",
        priority: 9,
        confidence: 0.73,
        evidence: "Locals insist the bell tower stays open through the night.",
      },
    ];

    const merged = mergeCanonFacts(facts);
    const bellTowerEntity = merged.groups.find(
      (group) => group.subject === "Bell Tower",
    );
    const bellTowerGroup = bellTowerEntity?.factGroups.find(
      (group) => group.factType === "location-status",
    );

    expect(bellTowerGroup?.activeFactId).toBe("fact_1");
    expect(bellTowerGroup?.candidates.map((fact) => [fact.id, fact.status])).toEqual(
      [
        ["fact_2", "overridden"],
        ["fact_1", "active"],
      ],
    );
    expect(merged.allFacts.map((fact) => [fact.id, fact.status])).toEqual([
      ["fact_2", "overridden"],
      ["fact_1", "active"],
    ]);
  });

  it("attaches canonical entries and selected evidence without rewriting candidate statuses", () => {
    const merged = mergeCanonFacts(
      [
        {
          id: "fact_1",
          campaignId: "camp_1",
          sourceDocumentId: "doc_1",
          documentChunkId: "chunk_1",
          subject: "Father Lucian",
          factType: "npc_state",
          value: "Alive and hiding relic evidence in the church cellar.",
          status: "uncertain",
          priority: 6,
          confidence: 0.82,
          evidence: "Session notes after the feast.",
        },
        {
          id: "fact_2",
          campaignId: "camp_1",
          sourceDocumentId: "doc_2",
          documentChunkId: "chunk_2",
          subject: "Father Lucian",
          factType: "npc_state",
          value: "Alive, but publicly denying the relic exists.",
          status: "uncertain",
          priority: 5,
          confidence: 0.71,
          evidence: "Module chapter four marginalia.",
        },
      ],
      [
        {
          id: "canon_1",
          campaignId: "camp_1",
          subject: "Father Lucian",
          factType: "npc_state",
          canonicalValue:
            "Father Lucian is alive and hiding relic evidence in the church cellar.",
          notes: null,
          sourceFactIds: ["fact_1", "fact_2"],
        },
      ],
    );

    expect(merged.canonicalEntries).toHaveLength(1);
    expect(merged.groups[0]?.factGroups[0]).toMatchObject({
      canonicalEntry: expect.objectContaining({
        id: "canon_1",
        canonicalValue:
          "Father Lucian is alive and hiding relic evidence in the church cellar.",
      }),
      selectedFactIds: ["fact_1", "fact_2"],
    });
    expect(merged.groups[0]?.factGroups[0]?.candidates.map((fact) => fact.status)).toEqual([
      "uncertain",
      "uncertain",
    ]);
  });

  it("ignores extra Prisma timestamp fields when merging persisted facts", () => {
    const now = new Date("2026-04-11T09:00:00.000Z");

    const merged = mergeCanonFacts([
      {
        id: "fact_1",
        campaignId: "camp_1",
        sourceDocumentId: "doc_1",
        documentChunkId: "chunk_1",
        subject: "Duskport",
        factType: "location-status",
        value: "Fog-choked harbor",
        status: "active",
        priority: 6,
        confidence: 0.81,
        evidence: "Duskport disappears into harbor fog every dusk.",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    expect(merged.groups).toHaveLength(1);
    expect(merged.groups[0]?.subject).toBe("Duskport");
    expect(merged.groups[0]?.factGroups[0]?.activeFact?.value).toBe("Fog-choked harbor");
  });
});
