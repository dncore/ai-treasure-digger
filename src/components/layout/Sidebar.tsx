import type { Page, Theme } from "../../App";
import { useI18n } from "../../App";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  theme: Theme;
  onToggleTheme: () => void;
  isAdmin: boolean;
}

const NAV_KEYS = [
  { page: "dashboard" as Page, icon: "◉", labelKey: "nav.dashboard" as const },
  { page: "services" as Page, icon: "▤", labelKey: "nav.services" as const },
  { page: "settings" as Page, icon: "⚙", labelKey: "nav.settings" as const },
];

export function Sidebar({ currentPage, onNavigate, theme, onToggleTheme, isAdmin }: SidebarProps) {
  const { t } = useI18n();

  return (
    <nav
      className="flex h-full w-[64px] flex-col items-center py-5 gap-1"
      style={{ backgroundColor: "var(--bg-sidebar)" }}
    >
      <div
        className="mb-6 text-2xl font-bold"
        style={{ color: "var(--accent)" }}
      >
        ⛏
      </div>

      {NAV_KEYS.map((item) => {
        const isActive = currentPage === item.page;
        return (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            title={t(item.labelKey)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-lg transition-all"
            style={{
              backgroundColor: isActive ? "var(--bg-input)" : "transparent",
              color: isActive ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {item.icon}
          </button>
        );
      })}

      <div className="mt-auto flex flex-col items-center gap-1">
        {isAdmin && (
          <div title={t("set.restart_admin")} className="flex h-11 w-11 items-center justify-center rounded-xl text-lg" style={{ color: "var(--warning)" }}>
            🛡
          </div>
        )}
        <button
          onClick={onToggleTheme}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-lg transition-all hover:bg-[var(--bg-input)]"
          style={{ color: "var(--text-muted)" }}
        >
          {theme === "dark" ? "◐" : "◑"}
        </button>
      </div>
    </nav>
  );
}
