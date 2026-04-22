import OpenAI from "openai";
import { env } from "@/lib/env";

export type OpenAIClientOptions = {
  appKey?: string | null;
  byokKey?: string | null;
  organization?: string;
  project?: string;
  baseURL?: string;
};

function normalizeKey(key: string | null | undefined) {
  const trimmed = key?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveOpenAIKey(options: OpenAIClientOptions = {}) {
  const byokKey = normalizeKey(options.byokKey);
  const appKey = normalizeKey(options.appKey) ?? env.openAiApiKey;
  const apiKey = byokKey ?? appKey;

  if (!apiKey) {
    throw new Error(
      "Missing OpenAI API key. Provide appKey, BYOK key, or OPENAI_API_KEY.",
    );
  }

  return {
    apiKey,
    source: byokKey ? "byok" : "app",
  } as const;
}

export function createOpenAIClient(options: OpenAIClientOptions = {}) {
  const { apiKey } = resolveOpenAIKey(options);

  return new OpenAI({
    apiKey,
    organization: options.organization,
    project: options.project,
    baseURL: options.baseURL,
  });
}

export type OpenAIResponsesClient = {
  responses: {
    parse: InstanceType<typeof OpenAI>["responses"]["parse"];
    stream?: InstanceType<typeof OpenAI>["responses"]["stream"];
  };
};

export function createOpenAIResponsesClient(
  options: OpenAIClientOptions = {},
): OpenAIResponsesClient {
  return createOpenAIClient(options);
}
