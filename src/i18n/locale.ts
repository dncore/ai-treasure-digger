export type Locale = "zh-CN" | "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  "zh-CN": "中文",
  "en": "English",
};

export const FALLBACK: Locale = "en";

function detectSystemLocale(): Locale {
  const lang = navigator.language; // e.g. "zh-CN", "zh", "en-US", "en"
  if (lang.startsWith("zh")) return "zh-CN";
  return FALLBACK;
}

export function getStoredLocale(): Locale {
  const stored = localStorage.getItem("locale");
  if (stored === "zh-CN" || stored === "en") return stored;
  const detected = detectSystemLocale();
  localStorage.setItem("locale", detected);
  return detected;
}

export function setStoredLocale(locale: Locale) {
  localStorage.setItem("locale", locale);
}
