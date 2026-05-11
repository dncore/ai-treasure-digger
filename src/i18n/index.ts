import { type Locale, FALLBACK } from "./locale";
import en from "./en";
import zhCN from "./zh-CN";

export type TranslationKey = keyof typeof en;

const messages: Record<Locale, Record<TranslationKey, string>> = {
  "en": en,
  "zh-CN": zhCN,
};

let currentLocale: Locale = FALLBACK;

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let text = messages[currentLocale]?.[key] ?? messages[FALLBACK][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
