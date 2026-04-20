import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { LanguageProvider } from "@/components/i18n/language-provider";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import {
  LOCALE_COOKIE_NAME,
  localeToLanguageTag,
  readLocaleCookieString,
} from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: "记忆优先 GM 工作台 / Memory-First GM Workbench",
  description:
    "导入战役笔记、提取 canon，并生成支线草稿。 / Import campaign notes, extract canon, and draft side quests.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const hasLocaleCookie = cookieStore.has(LOCALE_COOKIE_NAME);
  const initialLocale = readLocaleCookieString(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  );

  return (
    <html lang={localeToLanguageTag(initialLocale)}>
      <body>
        <LanguageProvider
          initialLocale={initialLocale}
          hasLocaleCookie={hasLocaleCookie}
        >
          <LanguageToggle />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
