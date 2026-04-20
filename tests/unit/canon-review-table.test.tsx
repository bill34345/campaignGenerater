import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanonReviewTable } from "@/components/canon/canon-review-table";
import { LanguageProvider } from "@/components/i18n/language-provider";
import type { CanonEntityGroup } from "@/lib/canon/merge";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
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
  });

  it("disables all canon actions while an update is in flight", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(
      <LanguageProvider initialLocale="zh" hasLocaleCookie={true}>
        <CanonReviewTable campaignId="camp_1" initialGroups={initialGroups} />
      </LanguageProvider>,
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(buttons.every((button) => (button as HTMLButtonElement).disabled)).toBe(
        true,
      );
    });

    resolveFetch?.(
      new Response(JSON.stringify({ groups: initialGroups }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await waitFor(() => {
      expect(buttons.some((button) => (button as HTMLButtonElement).disabled)).toBe(
        false,
      );
    });
  });
});
