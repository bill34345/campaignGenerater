import { describe, expect, it } from "vitest";
import { summarizeConflictFacts } from "@/lib/imports/result-summary";

describe("summarizeConflictFacts", () => {
  it("counts conflicts when a batch fact disagrees with pre-existing campaign facts", () => {
    const result = summarizeConflictFacts([
      {
        subject: "Father Lucian",
        factType: "npc_state",
        value: "Alive",
        source: "current_batch",
      },
      {
        subject: "Father Lucian",
        factType: "npc_state",
        value: "Dead",
        source: "campaign_history",
      },
    ]);

    expect(result.conflictCount).toBe(1);
    expect(result.conflictSubjects).toEqual(["Father Lucian"]);
  });

  it("ignores matching campaign history when the imported value agrees", () => {
    const result = summarizeConflictFacts([
      {
        subject: "Father Lucian",
        factType: "npc_state",
        value: "Alive",
        source: "current_batch",
      },
      {
        subject: "Father Lucian",
        factType: "npc_state",
        value: "alive",
        source: "campaign_history",
      },
    ]);

    expect(result.conflictCount).toBe(0);
    expect(result.conflictSubjects).toEqual([]);
  });
});
