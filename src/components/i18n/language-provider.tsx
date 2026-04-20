"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LOCALE,
  localeToLanguageTag,
  persistLocale,
  readStoredLocale,
  type Locale,
} from "@/lib/i18n/locales";
import { messages, type Messages } from "@/lib/i18n/messages";

type LanguageContextValue = {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

type LanguageProviderProps = {
  initialLocale: Locale;
  hasLocaleCookie: boolean;
  children: ReactNode;
};

export function LanguageProvider({
  initialLocale,
  hasLocaleCookie,
  children,
}: LanguageProviderProps) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = localeToLanguageTag(locale);
  }, [locale]);

  useEffect(() => {
    if (hasLocaleCookie) {
      return;
    }

    const storedLocale = readStoredLocale();
    if (storedLocale && storedLocale !== locale) {
      setLocaleState(storedLocale);
      persistLocale(storedLocale);
      router.refresh();
    }
  }, [hasLocaleCookie, locale, router]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      messages: messages[locale] ?? messages[DEFAULT_LOCALE],
      setLocale: (nextLocale) => {
        if (nextLocale === locale) {
          return;
        }

        setLocaleState(nextLocale);
        persistLocale(nextLocale);
        router.refresh();
      },
    }),
    [locale, router],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }

  return context;
}

export function useLocale() {
  return useLanguage().locale;
}

export function useMessages() {
  return useLanguage().messages;
}
