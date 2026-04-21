import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/components/i18n/language-provider";
import { QuestRequestForm } from "@/components/quests/quest-request-form";
import type { TownQuestContext } from "@/lib/canon/context-builder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const workingContext: TownQuestContext = {
  campaignId: "camp_1",
  campaignTone: "grim harbor intrigue",
  partyLevel: 3,
  town: {
    id: "camp_1-fog-harbor",
    campaignId: "camp_1",
    name: "Fog Harbor",
    vibe: "Wet docks and tolling bells.",
    tension: "Dock crews vanish after dusk.",
    notes: null,
    questHooks: ["A watch bell rings where no watch remains."],
  },
  townFacts: [],
  relevantNpcs: [],
  relevantFactions: [],
  recentDeltas: [],
  openHooks: ["A watch bell rings where no watch remains."],
};

function renderQuickStartForm() {
  return render(
    <LanguageProvider initialLocale="en" hasLocaleCookie={true}>
      <QuestRequestForm
        campaignId="camp_1"
        mode="quick_start"
        townOptions={[]}
        selectedTownId="town_1"
        initialValues={{
          townName: "Fog Harbor",
          townVibe: "",
          localTension: "",
          questType: "investigation",
          mainPlotRelation: "follow-up",
          desiredLength: "3h",
          extraContext: "",
          requestMode: "quick_start",
        }}
        workingContext={workingContext}
      />
    </LanguageProvider>,
  );
}

describe("QuestRequestForm quick start mode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the compact quick start field set", () => {
    renderQuickStartForm();

    expect(screen.getByLabelText(/adventure premise/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location seed/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/main plot relation/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /90 minutes/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /3 hours/i })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /2 sessions/i }),
    ).toBeInTheDocument();
  });

  it("submits quick start payloads with requestMode and no townProfileId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ draft: { id: "quest_1" } }), {
        status: 201,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderQuickStartForm();

    fireEvent.change(screen.getByLabelText(/location seed/i), {
      target: { value: "Fog Harbor" },
    });
    fireEvent.change(screen.getByLabelText(/immediate pressure/i), {
      target: { value: "Dock crews vanish after dusk." },
    });
    fireEvent.change(screen.getByLabelText(/adventure premise/i), {
      target: {
        value: "Find the missing dockworkers before the tide carries them under.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate quest/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [
      string,
      { body: string; method: string },
    ];
    const body = JSON.parse(requestInit.body);

    expect(body).toMatchObject({
      townProfileId: null,
      townName: "Fog Harbor",
      localTension: "Dock crews vanish after dusk.",
      extraContext:
        "Find the missing dockworkers before the tide carries them under.",
      requestMode: "quick_start",
      mainPlotRelation: null,
    });

    expect(await screen.findByRole("link", { name: /open generated quest/i })).toBeVisible();
  });
});
