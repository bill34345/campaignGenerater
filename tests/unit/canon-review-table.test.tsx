import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanonReviewTable } from "@/components/canon/canon-review-table";
import { LanguageProvider } from "@/components/i18n/language-provider";
import type { CanonEntityGroup } from "@/lib/canon/merge";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

const initialGroups: CanonEntityGroup[] = [
  {
    key: "Bell Tower",
    subject: "Bell Tower",
    conflict: true,
    factGroups: [
      {
        key: "Bell Tower::location-status",
        subject: "Bell Tower",
        factType: "location-status",
        conflict: true,
        activeFactId: "fact_1",
        activeFact: {
          id: "fact_1",
          campaignId: "camp_1",
          sourceDocumentId: "doc_1",
          documentChunkId: "chunk_1",
          subject: "Bell Tower",
          factType: "location-status",
          value: "Sealed at dusk",
          status: "active",
          priority: 5,
          confidence: 0.9,
          evidence: "Tower closes at dusk.",
        },
        candidateFactIds: ["fact_1", "fact_2"],
        overriddenFactIds: ["fact_2"],
        selectedFactIds: ["fact_1"],
        canonicalEntry: null,
        candidates: [
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
            confidence: 0.9,
            evidence: "Tower closes at dusk.",
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
            priority: 4,
            confidence: 0.6,
            evidence: "Locals disagree.",
          },
        ],
      },
    ],
  },
  {
    key: "Harbormaster",
    subject: "Harbormaster",
    conflict: false,
    factGroups: [
      {
        key: "Harbormaster::npc-trait",
        subject: "Harbormaster",
        factType: "npc-trait",
        conflict: false,
        activeFactId: "fact_3",
        activeFact: {
          id: "fact_3",
          campaignId: "camp_1",
          sourceDocumentId: "doc_3",
          documentChunkId: "chunk_3",
          subject: "Harbormaster",
          factType: "npc-trait",
          value: "Missing left hand",
          status: "active",
          priority: 3,
          confidence: 0.8,
          evidence: "He gestures with a hook.",
        },
        candidateFactIds: ["fact_3"],
        overriddenFactIds: [],
        selectedFactIds: ["fact_3"],
        canonicalEntry: null,
        candidates: [
          {
            id: "fact_3",
            campaignId: "camp_1",
            sourceDocumentId: "doc_3",
            documentChunkId: "chunk_3",
            subject: "Harbormaster",
            factType: "npc-trait",
            value: "Missing left hand",
            status: "active",
            priority: 3,
            confidence: 0.8,
            evidence: "He gestures with a hook.",
          },
        ],
      },
    ],
  },
];

describe("CanonReviewTable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    refreshMock.mockReset();
  });

  it("disables compose actions while a quick save is in flight", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <LanguageProvider initialLocale="en" hasLocaleCookie={true}>
        <CanonReviewTable campaignId="camp_1" initialGroups={initialGroups} />
      </LanguageProvider>,
    );

    const quickSaveButton = screen.getByRole("button", { name: /quick save/i });
    fireEvent.click(quickSaveButton);

    await waitFor(() => {
      expect(quickSaveButton).toBeDisabled();
      expect(
        screen
          .getAllByRole("button", { name: /compose canon/i })
          .every((button) => (button as HTMLButtonElement).disabled),
      ).toBe(true);
      expect(screen.getAllByRole("checkbox").every((checkbox) => checkbox.hasAttribute("disabled"))).toBe(true);
    });

    await act(async () => {
      resolveFetch?.(
        new Response(JSON.stringify({ entry: { id: "canon_1" } }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );
    });
  });
});
