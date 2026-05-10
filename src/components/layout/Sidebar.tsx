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
    <nav className="flex h-full w-[60px] flex-col items-center py-4 gap-1" style={{ backgroundColor: "var(--bg-sidebar)" }}>
      <div className="mb-4 text-lg font-bold text-emerald-400">⛏</div>
      {navItems.map((item) => (
        <button
          key={item.page}
          onClick={() => onNavigate(item.page)}
          title={item.label}
          className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors ${
            currentPage === item.page
              ? "text-emerald-400"
              : "hover:text-[var(--text-secondary)]"
          }`}
          style={currentPage === item.page ? { backgroundColor: "var(--bg-input)" } : { color: "var(--text-muted)" }}
        >
          {item.icon}
        </button>
      ))}
      <div className="mt-auto">
        <button
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          {theme === "dark" ? "◐" : "◑"}
        </button>
      </div>
    </nav>
  );
}
