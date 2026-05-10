import { useState, useEffect } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Dashboard } from "./components/dashboard/Dashboard";
import { Services } from "./components/services/Services";
import { Settings } from "./components/settings/Settings";
import { ToastContainer } from "./components/ui/Toast";
import { useToast } from "./hooks/useToast";
import type { ToastMessage } from "./lib/types";

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

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const { toasts, addToast, removeToast } = useToast();

  ToastContext.addToast = addToast;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return (
    <div className="flex h-screen">
      <Sidebar currentPage={page} onNavigate={setPage} theme={theme} onToggleTheme={toggleTheme} />
      <main className="flex-1 overflow-auto p-6">
        {page === "dashboard" && <Dashboard />}
        {page === "services" && <Services />}
        {page === "settings" && <Settings />}
      </main>
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
