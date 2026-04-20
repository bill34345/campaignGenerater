import { describe, expect, it } from "vitest";
import {
  canonicalEntrySchema,
  canonComposerDraftSchema,
  canonComposerRequestSchema,
} from "@/types/domain";

describe("canon composer schemas", () => {
  it("parses a canonical entry with linked source facts", () => {
    const parsed = canonicalEntrySchema.safeParse({
      id: "canon_1",
      campaignId: "cmp_1",
      subject: "Father Lucian",
      factType: "npc_state",
      canonicalValue: "Alive, hiding relic evidence in the church cellar.",
      notes: "Merged from module text and session notes.",
      sourceFactIds: ["fact_a", "fact_b"],
      createdAt: new Date("2026-04-20T00:00:00.000Z"),
      updatedAt: new Date("2026-04-20T00:00:00.000Z"),
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw parsed.error;
    }

    expect(parsed.data.sourceFactIds).toEqual(["fact_a", "fact_b"]);
  });

  it("parses a canon composer request for selected candidate facts", () => {
    const parsed = canonComposerRequestSchema.safeParse({
      campaignId: "cmp_1",
      subject: "Father Lucian",
      factType: "npc_state",
      selectedFactIds: ["fact_a", "fact_b"],
    });

    expect(parsed.success).toBe(true);
  });

  it("parses a canon composer draft with evidence blocks", () => {
    const parsed = canonComposerDraftSchema.safeParse({
      campaignId: "cmp_1",
      subject: "Father Lucian",
      factType: "npc_state",
      canonicalValue: "Alive, hiding relic evidence in the church cellar.",
      notes: null,
      selectedFactIds: ["fact_a", "fact_b"],
      evidence: [
        {
          factId: "fact_a",
          subject: "Father Lucian",
          factType: "npc_state",
          value: "Alive and sheltering townsfolk below the church.",
          evidence: "Session notes after the feast.",
        },
        {
          factId: "fact_b",
          subject: "Father Lucian",
          factType: "npc_state",
          value: "Suspicious and hiding relic evidence in the cellar.",
          evidence: "Module chapter 4 marginalia.",
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a composer draft with an empty canonical summary", () => {
    const parsed = canonComposerDraftSchema.safeParse({
      campaignId: "cmp_1",
      subject: "Father Lucian",
      factType: "npc_state",
      canonicalValue: "   ",
      notes: null,
      selectedFactIds: ["fact_a"],
      evidence: [
        {
          factId: "fact_a",
          subject: "Father Lucian",
          factType: "npc_state",
          value: "Alive and sheltering townsfolk below the church.",
          evidence: "Session notes after the feast.",
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate fact ids in canonical entry payloads", () => {
    const parsed = canonicalEntrySchema.safeParse({
      campaignId: "cmp_1",
      subject: "Father Lucian",
      factType: "npc_state",
      canonicalValue: "Alive, hiding relic evidence in the church cellar.",
      sourceFactIds: ["fact_a", "fact_a"],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate fact ids in composer requests", () => {
    const parsed = canonComposerRequestSchema.safeParse({
      campaignId: "cmp_1",
      subject: "Father Lucian",
      factType: "npc_state",
      selectedFactIds: ["fact_a", "fact_a"],
    });

    expect(parsed.success).toBe(false);
  });
});
