export const SUPPORTED_LOCALES = ["zh", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALE_COOKIE_NAME = "gmw-locale";
export const LOCALE_STORAGE_KEY = "gmw-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return value === "zh" || value === "en";
}

export function normalizeLocale(value: unknown): Locale | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return isLocale(normalized) ? normalized : null;
}

export function coerceLocale(value: unknown): Locale {
  return normalizeLocale(value) ?? DEFAULT_LOCALE;
}

export function localeToLanguageTag(locale: Locale) {
  return locale === "zh" ? "zh-CN" : "en-US";
}

export function persistLocale(locale: Locale) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = [
    `${LOCALE_COOKIE_NAME}=${locale}`,
    "path=/",
    `max-age=${LOCALE_COOKIE_MAX_AGE}`,
    "samesite=lax",
  ].join("; ");

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function readStoredLocale() {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
}

export function readLocaleCookieString(cookieValue: string | undefined) {
  return coerceLocale(cookieValue);
}
