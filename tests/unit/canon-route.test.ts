import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  canonFactFindFirst: vi.fn(),
  canonFactFindMany: vi.fn(),
  canonFactUpdateMany: vi.fn(),
  canonFactUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    campaign: {
      findUnique: mocks.campaignFindUnique,
    },
    canonFact: {
      findFirst: mocks.canonFactFindFirst,
      findMany: mocks.canonFactFindMany,
      updateMany: mocks.canonFactUpdateMany,
      update: mocks.canonFactUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

import { PATCH } from "@/app/api/campaigns/[campaignId]/canon/route";

describe("canon route PATCH", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a 400 JSON error when the request body is malformed JSON", async () => {
    const request = {
      json: vi
        .fn()
        .mockRejectedValue(new SyntaxError("Unexpected end of JSON input")),
    } as unknown as Request;

    const response = await PATCH(request, {
      params: Promise.resolve({ campaignId: "camp_1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid request body.",
    });
    expect(mocks.canonFactFindFirst).not.toHaveBeenCalled();
  });

  it("returns a 400 JSON error when the request body fails schema validation", async () => {
    const request = {
      json: vi.fn().mockResolvedValue({
        factId: "fact_1",
        status: "invalid-status",
      }),
    } as unknown as Request;

    const response = await PATCH(request, {
      params: Promise.resolve({ campaignId: "camp_1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid request body.",
    });
    expect(mocks.canonFactFindFirst).not.toHaveBeenCalled();
  });
});
