export const SOURCE_TYPES = [
  "official_module",
  "gm_notes",
  "session_record",
  "custom_reference",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];
export type SourceTypeLocale = "en" | "zh";

export const DEFAULT_SOURCE_TYPE: SourceType = "custom_reference";

export const SOURCE_TYPE_LABELS: Record<
  SourceType,
  { en: string; zh: string }
> = {
  official_module: {
    en: "Official module",
    zh: "官方模组",
  },
  gm_notes: {
    en: "GM notes",
    zh: "GM 笔记",
  },
  session_record: {
    en: "Session record",
    zh: "跑团记录",
  },
  custom_reference: {
    en: "Custom reference",
    zh: "自定义资料",
  },
};

export function getSourceTypeLabel(
  locale: SourceTypeLocale,
  sourceType: SourceType,
) {
  return SOURCE_TYPE_LABELS[sourceType][locale];
}

export function isSourceType(value: string): value is SourceType {
  return SOURCE_TYPES.includes(value as SourceType);
}

export function resolveSourceType(
  value: string | null | undefined,
  fallback: SourceType = DEFAULT_SOURCE_TYPE,
): SourceType {
  if (value && isSourceType(value)) {
    return value;
  }

  return fallback;
}
