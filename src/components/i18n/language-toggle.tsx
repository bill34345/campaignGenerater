"use client";

import { useLanguage } from "@/components/i18n/language-provider";

export function LanguageToggle() {
  const { locale, messages, setLocale } = useLanguage();

  return (
    <div className="fixed right-6 top-6 z-50 rounded-full border border-slate-700 bg-slate-950/90 p-1 shadow-xl shadow-slate-950/40 backdrop-blur">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setLocale("zh")}
          aria-pressed={locale === "zh"}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            locale === "zh"
              ? "bg-cyan-400 text-slate-950"
              : "text-slate-200 hover:bg-slate-900"
          }`}
        >
          {messages.languageToggle.zh}
        </button>
        <button
          type="button"
          onClick={() => setLocale("en")}
          aria-pressed={locale === "en"}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            locale === "en"
              ? "bg-cyan-400 text-slate-950"
              : "text-slate-200 hover:bg-slate-900"
          }`}
        >
          {messages.languageToggle.en}
        </button>
      </div>
    </div>
  );
}
