import type { RecoverableLlmErrorCode } from "@/lib/llm/provider-types";

export function mapRecoverableLlmError(error: unknown): RecoverableLlmErrorCode | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const record = error as {
    code?: string;
    status?: number;
    message?: string;
    error?: {
      type?: string;
      message?: string;
    };
  };

  if (record.code === "invalid_api_key") {
    return "invalid_api_key";
  }

  if (record.code === "authentication_error" || record.status === 401 || record.status === 403) {
    return "authentication_error";
  }

  if (record.code === "insufficient_quota" || record.status === 429) {
    return "insufficient_quota";
  }

  const message = [record.message, record.error?.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  if (/invalid api key/i.test(message)) {
    return "invalid_api_key";
  }

  if (/api key|authentication|unauthorized|forbidden/i.test(message)) {
    return "authentication_error";
  }

  if (/quota|rate limit|credit/i.test(message)) {
    return "insufficient_quota";
  }

  return null;
}

export function getLlmErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.trim() ? code : null;
}
