type EnvValue = string | undefined;

function readEnv(key: string): EnvValue {
  const value = process.env[key];

  if (value === undefined || !value.trim()) {
    return undefined;
  }

  return value;
}

function requireEnv(key: string): string {
  const value = readEnv(key);

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  openAiApiKey: readEnv("OPENAI_API_KEY"),
  llmMockEnabled: process.env.CODEX_TEST_LLM_MOCK === "1",
};

export { readEnv, requireEnv };
