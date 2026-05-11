import { useState, useEffect, createContext, useContext } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Dashboard } from "./components/dashboard/Dashboard";
import { Services } from "./components/services/Services";
import { Settings } from "./components/settings/Settings";
import { ToastContainer } from "./components/ui/Toast";
import { useToast } from "./hooks/useToast";
import { isAdmin as checkIsAdmin } from "./lib/api";
import type { ToastMessage } from "./lib/types";
import { type Locale, getStoredLocale, setStoredLocale as persistLocale } from "./i18n/locale";
import { t as _t, setLocale as applyLocale, getLocale, type TranslationKey } from "./i18n";

export type Page = "dashboard" | "services" | "settings";
export type Theme = "dark" | "light";

export const ToastContext = {
  addToast: (_toast: Omit<ToastMessage, "id">) => {},
};

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

// i18n context — bump counter triggers re-render across all consumers
interface I18nValue {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  locale: Locale;
  setAppLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nValue>({
  t: _t,
  locale: getLocale(),
  setAppLocale: () => {},
});

export function useI18n() {
  return useContext(I18nContext);
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [admin, setAdmin] = useState(false);
  const [locale, setLocaleState] = useState<Locale>(() => {
    const l = getStoredLocale();
    applyLocale(l);
    return l;
  });
  const [, bump] = useState(0);
  const { toasts, addToast, removeToast } = useToast();

  ToastContext.addToast = addToast;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    checkIsAdmin().then(setAdmin).catch(() => {});
  }, []);

  function setAppLocale(l: Locale) {
    applyLocale(l);
    persistLocale(l);
    setLocaleState(l);
    bump((n) => n + 1);
  }

  const i18n: I18nValue = { t: _t, locale, setAppLocale };

  return (
    <I18nContext.Provider value={i18n}>
      <div className="flex h-screen">
        <Sidebar currentPage={page} onNavigate={setPage} theme={theme} onToggleTheme={toggleTheme} isAdmin={admin} />
        <main className="flex-1 overflow-auto p-6">
          {page === "dashboard" && <Dashboard />}
          {page === "services" && <Services />}
          {page === "settings" && <Settings />}
        </main>
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </div>
    </I18nContext.Provider>
  );

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }
}
