import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/components/i18n/language-provider";
import { QuestRequestForm } from "@/components/quests/quest-request-form";
import type { TownQuestContext } from "@/lib/canon/context-builder";

const navigationMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/campaigns/camp_1/quests/new",
  useRouter: () => navigationMocks,
  useSearchParams: () => new URLSearchParams(),
}));

const workingContext: TownQuestContext = {
  campaignId: "camp_1",
  campaignTone: "grim harbor intrigue",
  partyLevel: 3,
  town: {
    id: "camp_1-blackwater",
    campaignId: "camp_1",
    name: "Blackwater",
    vibe: "Foggy and suspicious",
    tension: "Smugglers are using the crypts",
    notes: null,
    questHooks: ["The chapel bell tolls at low tide."],
  },
  townFacts: [],
  relevantNpcs: [],
  relevantFactions: [],
  recentDeltas: [],
  openHooks: ["The chapel bell tolls at low tide."],
};

class MockEventSource {
  static instances: MockEventSource[] = [];

  listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  onerror: (() => void) | null = null;

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  emit(type: string, data: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  close() {}
}

function createQueuedResponse() {
  return {
    id: "req_1",
    campaignId: "camp_1",
    townProfileId: "town_1",
    requestMode: "standard" as const,
    generationStatus: "queued" as const,
    generationStage: "queued" as const,
    generationProgressMessage: "Queued for generation.",
    generationPreviewText: null,
    generationStartedAt: null,
    generationCompletedAt: null,
    generationFailedAt: null,
    generationLastErrorCode: null,
    generationLastErrorMessage: null,
    townName: "Blackwater",
    locale: "en" as const,
    townVibe: "Foggy and suspicious",
    localTension: "Smugglers are using the crypts",
    questType: "investigation",
    mainPlotRelation: "foreshadow",
    desiredLength: "standard",
    extraContext: "Tie the payoff back to the cult.",
  };
}

function renderForm() {
  return render(
    <LanguageProvider initialLocale="en" hasLocaleCookie={true}>
      <QuestRequestForm
        campaignId="camp_1"
        townOptions={[{ id: "town_1", name: "Blackwater" }]}
        selectedTownId="town_1"
        initialValues={{
          townName: "Blackwater",
          townVibe: "Foggy and suspicious",
          localTension: "Smugglers are using the crypts",
          questType: "investigation",
          mainPlotRelation: "foreshadow",
          desiredLength: "standard",
          extraContext: "Tie the payoff back to the cult.",
          requestMode: "standard",
        }}
        workingContext={workingContext}
      />
    </LanguageProvider>,
  );
}

describe("QuestRequestForm generating state", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    navigationMocks.push.mockReset();
    navigationMocks.replace.mockReset();
    navigationMocks.refresh.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("transitions into generating state after async submission", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.includes("/status")) {
        return new Response(
          JSON.stringify({
            questRequest: createQueuedResponse(),
            draft: null,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          questRequest: createQueuedResponse(),
          draft: null,
        }),
        {
          status: 202,
          headers: { "content-type": "application/json" },
        },
      );
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);

    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /generate quest/i }));

    await waitFor(() => {
      expect(screen.getByTestId("quest-generation-status")).toBeVisible();
    });

    expect(screen.getByTestId("quest-generation-stage")).toHaveTextContent("Queued");
    expect(navigationMocks.replace).toHaveBeenCalled();
  });

  it("renders streamed preview text and redirects when generation completes", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.includes("/status")) {
        return new Response(
          JSON.stringify({
            questRequest: createQueuedResponse(),
            draft: null,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          questRequest: createQueuedResponse(),
          draft: null,
        }),
        {
          status: 202,
          headers: { "content-type": "application/json" },
        },
      );
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);

    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /generate quest/i }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    await act(async () => {
      MockEventSource.instances[0].emit("text_delta", {
        type: "text_delta",
        questRequestId: "req_1",
        generationStatus: "running",
        generationStage: "streaming",
        previewText: "Blackwater's chapel bell tolls twice.",
        delta: "Blackwater's chapel bell tolls twice.",
        message: "Streaming draft text...",
        occurredAt: new Date().toISOString(),
      });
      MockEventSource.instances[0].emit("completed", {
        type: "completed",
        questRequestId: "req_1",
        generationStatus: "completed",
        generationStage: "completed",
        previewText: "Blackwater's chapel bell tolls twice.",
        message: "Quest draft ready.",
        draftId: "draft_1",
        occurredAt: new Date().toISOString(),
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("quest-generation-preview")).toHaveTextContent(
        "Blackwater's chapel bell tolls twice.",
      );
      expect(navigationMocks.push).toHaveBeenCalledWith(
        "/campaigns/camp_1/quests/draft_1",
      );
    });
  });
});
