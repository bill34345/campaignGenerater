import { describe, expect, it } from "vitest";
import { buildTownQuestContext } from "@/lib/canon/context-builder";
import type { CanonFact, TownProfile } from "@/types/domain";

describe("buildTownQuestContext", () => {
  it("collects town context and excludes unrelated canon", () => {
    const town: TownProfile = {
      id: "town_1",
      campaignId: "camp_1",
      name: "Duskport",
      vibe: "Salt-stained paranoia",
      tension: "Dock workers keep disappearing at the tide bell.",
      notes: "Smugglers and exhausted fishers trade rumors after dark.",
      questHooks: [
        "Find out who is taking the dock workers",
        "Learn why the tide bell rings before dawn",
      ],
    };

    const facts: CanonFact[] = [
      {
        id: "fact_town",
        campaignId: "camp_1",
        sourceDocumentId: null,
        documentChunkId: null,
        subject: "Duskport",
        factType: "town-landmark",
        value: "The tide bell tower overlooks the harbor.",
        status: "active",
        priority: 8,
        confidence: 0.92,
        evidence: "Duskport's tide bell tower shadows every late ship.",
      },
      {
        id: "fact_npc",
        campaignId: "camp_1",
        sourceDocumentId: null,
        documentChunkId: null,
        subject: "Captain Mirel",
        factType: "npc-role",
        value: "Harbor warden in Duskport",
        status: "active",
        priority: 7,
        confidence: 0.81,
        evidence: "Captain Mirel keeps the harbor watch in Duskport.",
      },
      {
        id: "fact_faction",
        campaignId: "camp_1",
        sourceDocumentId: null,
        documentChunkId: null,
        subject: "Undertide Compact",
        factType: "faction-agenda",
        value: "Controls smuggling routes beneath Duskport",
        status: "active",
        priority: 6,
        confidence: 0.76,
        evidence: "The Undertide Compact profits from Duskport's hidden tunnels.",
      },
      {
        id: "fact_hook",
        campaignId: "camp_1",
        sourceDocumentId: null,
        documentChunkId: null,
        subject: "Tide Bell",
        factType: "plot-hook",
        value: "It rings before dawn when something comes in from the bay.",
        status: "active",
        priority: 5,
        confidence: 0.73,
        evidence: "Dock hands fear the tide bell's early warning.",
      },
      {
        id: "fact_far",
        campaignId: "camp_1",
        sourceDocumentId: null,
        documentChunkId: null,
        subject: "Sunfall Keep",
        factType: "npc-role",
        value: "A knight commands the inland garrison.",
        status: "active",
        priority: 9,
        confidence: 0.88,
        evidence: "Sunfall Keep lies two valleys away from the coast.",
      },
      {
        id: "fact_overridden",
        campaignId: "camp_1",
        sourceDocumentId: null,
        documentChunkId: null,
        subject: "Captain Mirel",
        factType: "npc-role",
        value: "Retired ferry captain",
        status: "overridden",
        priority: 10,
        confidence: 0.6,
        evidence: "An old ledger lists Captain Mirel as retired.",
      },
    ];

    const context = buildTownQuestContext({
      campaignId: "camp_1",
      campaignTone: "Bleak coastal intrigue",
      partyLevel: 4,
      town,
      canonFacts: facts,
      deltas: [
        {
          id: "delta_1",
          campaignId: "camp_1",
          deltaType: "session-change",
          summary: "After the riot in Duskport, the harbor now closes at moonrise.",
          createdAt: new Date("2026-04-09T10:00:00.000Z"),
          sourceFactId: "fact_town",
          sourceFact: {
            id: "fact_town",
            subject: "Duskport",
            factType: "town-landmark",
            value: "The tide bell tower overlooks the harbor.",
          },
        },
        {
          id: "delta_2",
          campaignId: "camp_1",
          deltaType: "session-change",
          summary: "Sunfall Keep replaced its quartermaster.",
          createdAt: new Date("2026-04-08T10:00:00.000Z"),
          sourceFactId: "fact_far",
          sourceFact: {
            id: "fact_far",
            subject: "Sunfall Keep",
            factType: "npc-role",
            value: "A knight commands the inland garrison.",
          },
        },
      ],
    });

    expect(context).toMatchObject({
      campaignId: "camp_1",
      campaignTone: "Bleak coastal intrigue",
      partyLevel: 4,
      town: {
        id: "town_1",
        name: "Duskport",
      },
    });
    expect(context.townFacts.map((fact) => fact.id)).toEqual(["fact_town"]);
    expect(context.relevantNpcs.map((fact) => fact.id)).toEqual(["fact_npc"]);
    expect(context.relevantFactions.map((fact) => fact.id)).toEqual([
      "fact_faction",
    ]);
    expect(context.recentDeltas.map((delta) => delta.id)).toEqual(["delta_1"]);
    expect(context.openHooks).toEqual([
      "Find out who is taking the dock workers",
      "Learn why the tide bell rings before dawn",
      "It rings before dawn when something comes in from the bay.",
    ]);
    expect(
      [
        ...context.townFacts,
        ...context.relevantNpcs,
        ...context.relevantFactions,
      ].some((fact) => fact.id === "fact_far" || fact.id === "fact_overridden"),
    ).toBe(false);
  });

  it("does not treat substring overlaps as town relevance", () => {
    const town: TownProfile = {
      id: "town_2",
      campaignId: "camp_1",
      name: "Port Ember",
      vibe: "Bell-wracked harbor district",
      tension: "Harbor priests claim the old bell warns of incoming storms.",
      notes: null,
      questHooks: [],
    };

    const context = buildTownQuestContext({
      campaignId: "camp_1",
      campaignTone: "Maritime noir",
      partyLevel: 5,
      town,
      canonFacts: [
        {
          id: "fact_good_npc",
          campaignId: "camp_1",
          sourceDocumentId: null,
          documentChunkId: null,
          subject: "Warden Sel",
          factType: "npc-role",
          value: "Customs marshal in Port Ember",
          status: "active",
          priority: 5,
          confidence: 0.8,
          evidence: "Warden Sel patrols the piers of Port Ember.",
        },
        {
          id: "fact_bad_port",
          campaignId: "camp_1",
          sourceDocumentId: null,
          documentChunkId: null,
          subject: "Mage Courier",
          factType: "npc-role",
          value: "Maintains the teleport circle network",
          status: "active",
          priority: 9,
          confidence: 0.9,
          evidence: "The courier monitors every teleport arrival inland.",
        },
        {
          id: "fact_bad_bell",
          campaignId: "camp_1",
          sourceDocumentId: null,
          documentChunkId: null,
          subject: "Ashen League",
          factType: "faction-agenda",
          value: "Exploits local rebellion to weaken the crown",
          status: "active",
          priority: 8,
          confidence: 0.77,
          evidence: "Agents fund rebellion across the interior duchies.",
        },
      ],
      deltas: [
        {
          id: "delta_good",
          campaignId: "camp_1",
          deltaType: "session-change",
          summary: "Port Ember sealed the north pier after a storm omen.",
          createdAt: new Date("2026-04-10T08:00:00.000Z"),
        },
        {
          id: "delta_bad",
          campaignId: "camp_1",
          deltaType: "session-change",
          summary: "Rebellion in the interior disrupted a teleport relay.",
          createdAt: new Date("2026-04-09T08:00:00.000Z"),
        },
      ],
    });

    expect(context.relevantNpcs.map((fact) => fact.id)).toEqual(["fact_good_npc"]);
    expect(context.relevantFactions).toEqual([]);
    expect(context.recentDeltas.map((delta) => delta.id)).toEqual(["delta_good"]);
  });

  it("matches explicit mentions for short town names without allowing substring false positives", () => {
    const town: TownProfile = {
      id: "town_3",
      campaignId: "camp_1",
      name: "Nox",
      vibe: null,
      tension: null,
      notes: null,
      questHooks: [],
    };

    const context = buildTownQuestContext({
      campaignId: "camp_1",
      campaignTone: "Dark frontier",
      partyLevel: 3,
      town,
      canonFacts: [
        {
          id: "fact_nox_npc",
          campaignId: "camp_1",
          sourceDocumentId: null,
          documentChunkId: null,
          subject: "Brother Cal",
          factType: "npc-role",
          value: "Caretaker in Nox",
          status: "active",
          priority: 6,
          confidence: 0.84,
          evidence: "Brother Cal serves in Nox.",
        },
        {
          id: "fact_nox_faction",
          campaignId: "camp_1",
          sourceDocumentId: null,
          documentChunkId: null,
          subject: "Black Oar",
          factType: "faction-agenda",
          value: "Collects tolls in Nox",
          status: "active",
          priority: 5,
          confidence: 0.74,
          evidence: "The Black Oar operates in Nox.",
        },
        {
          id: "fact_bad_substring",
          campaignId: "camp_1",
          sourceDocumentId: null,
          documentChunkId: null,
          subject: "Archivist Pell",
          factType: "npc-role",
          value: "Studies equinox rituals in the capital",
          status: "active",
          priority: 9,
          confidence: 0.91,
          evidence: "Pell publishes a treatise on equinox observances.",
        },
      ],
      deltas: [
        {
          id: "delta_nox",
          campaignId: "camp_1",
          deltaType: "session-change",
          summary: "Nox closed the eastern ferry after shrine lights appeared.",
          createdAt: new Date("2026-04-10T09:00:00.000Z"),
        },
        {
          id: "delta_bad_substring",
          campaignId: "camp_1",
          deltaType: "session-change",
          summary: "The equinox festival drew nobles to the capital.",
          createdAt: new Date("2026-04-09T09:00:00.000Z"),
        },
      ],
    });

    expect(context.relevantNpcs.map((fact) => fact.id)).toEqual(["fact_nox_npc"]);
    expect(context.relevantFactions.map((fact) => fact.id)).toEqual([
      "fact_nox_faction",
    ]);
    expect(context.recentDeltas.map((delta) => delta.id)).toEqual(["delta_nox"]);
  });
});
