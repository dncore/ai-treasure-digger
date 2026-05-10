import type { Page, Theme } from "../../App";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const navItems: { page: Page; icon: string; label: string }[] = [
  { page: "dashboard", icon: "◉", label: "Dashboard" },
  { page: "services", icon: "▤", label: "Services" },
  { page: "settings", icon: "⚙", label: "Settings" },
];

export function Sidebar({ currentPage, onNavigate, theme, onToggleTheme }: SidebarProps) {
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

      {navItems.map((item) => {
        const isActive = currentPage === item.page;
        return (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            title={item.label}
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

      <div className="mt-auto">
        <button
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-lg transition-all hover:bg-[var(--bg-input)]"
          style={{ color: "var(--text-muted)" }}
        >
          {theme === "dark" ? "◐" : "◑"}
        </button>
      </div>
    </nav>
  );
}
