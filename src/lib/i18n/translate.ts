import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  coerceLocale,
  type Locale,
} from "@/lib/i18n/locales";
import { messages, type Messages } from "@/lib/i18n/messages";

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return coerceLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value ?? DEFAULT_LOCALE);
}

export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages[DEFAULT_LOCALE];
}

export function getApiErrorMessage(locale: Locale, errorCode?: string | null) {
  if (!errorCode) {
    return null;
  }

  return getMessages(locale).apiErrors[
    errorCode as keyof Messages["apiErrors"]
  ] ?? null;
}

export function formatDateForLocale(locale: Locale, value: Date) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}
