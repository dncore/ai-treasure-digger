import { useEffect, useState } from "react";
import { getSettings, saveSettings, restartAsAdmin, toggleConsole } from "../../lib/api";
import { ToastContext, useI18n } from "../../App";
import type { AppSettings } from "../../lib/types";
import { type Locale, LOCALE_LABELS } from "../../i18n/locale";

export function Settings() {
  const { t, locale, setAppLocale } = useI18n();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [newExcludedPath, setNewExcludedPath] = useState("");

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((e) => ToastContext.addToast({ type: "error", title: t("toast.settings_save_failed"), detail: String(e) }));
  }, [t]);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettings(settings);
      ToastContext.addToast({ type: "success", title: t("toast.settings_saved") });
    } catch (e) {
      ToastContext.addToast({ type: "error", title: t("toast.settings_save_failed"), detail: String(e) });
    } finally {
      setSaving(false);
    }
  }

  function addExcludedPath() {
    if (!newExcludedPath.trim() || !settings) return;
    setSettings({
      ...settings,
      excluded_paths: [...settings.excluded_paths, newExcludedPath.trim()],
    });
    setNewExcludedPath("");
  }

  function removeExcludedPath(index: number) {
    if (!settings) return;
    setSettings({
      ...settings,
      excluded_paths: settings.excluded_paths.filter((_, i) => i !== index),
    });
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg" style={{ color: "var(--text-muted)" }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">{t("set.title")}</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("set.language")}
        </h2>
        <div className="flex gap-2">
          {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setAppLocale(key)}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
              style={{
                backgroundColor: locale === key ? "var(--accent)" : "var(--bg-input)",
                color: locale === key ? "#fff" : "var(--text-primary)",
                border: locale === key ? "none" : "1px solid var(--border)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {t("set.language_sub")}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("set.scan")}
        </h2>
        <label className="flex items-center gap-4">
          <span className="w-48 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("set.refresh_interval")}
          </span>
          <input
            type="number"
            min={1}
            max={60}
            value={settings.refresh_interval_secs}
            onChange={(e) =>
              setSettings({ ...settings, refresh_interval_secs: Number(e.target.value) })
            }
            className="w-24 rounded-lg px-3 py-2 text-sm font-medium"
            style={{
              backgroundColor: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t("set.seconds")}
          </span>
        </label>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("set.excluded_paths")}
        </h2>
        <div className="space-y-2">
          {settings.excluded_paths.map((path, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
                {path}
              </span>
              <button
                onClick={() => removeExcludedPath(i)}
                className="text-sm font-medium transition-colors hover:opacity-70"
                style={{ color: "var(--danger)" }}
              >
                {t("set.remove")}
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newExcludedPath}
              onChange={(e) => setNewExcludedPath(e.target.value)}
              placeholder={t("set.add_path")}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm"
              style={{
                backgroundColor: "var(--bg-card)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
              onKeyDown={(e) => e.key === "Enter" && addExcludedPath()}
            />
            <button
              onClick={addExcludedPath}
              className="rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
              style={{
                backgroundColor: "var(--bg-input)",
                color: "var(--text-primary)",
              }}
            >
              {t("set.add")}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("set.system")}
        </h2>
        <div className="flex items-center gap-4">
          <button
            onClick={async () => {
              try {
                await restartAsAdmin();
              } catch (e) {
                ToastContext.addToast({ type: "error", title: t("toast.restart_failed"), detail: String(e) });
              }
            }}
            className="rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
            style={{
              backgroundColor: "var(--warning-bg)",
              color: "var(--warning)",
            }}
          >
            {t("set.restart_admin")}
          </button>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t("set.restart_admin_sub")}
          </span>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("set.console")}
        </h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className="relative w-10 h-5 rounded-full transition-colors"
            style={{ backgroundColor: settings.show_console ? "var(--accent)" : "var(--bg-input)" }}
            onClick={async () => {
              const next = !settings.show_console;
              setSettings({ ...settings, show_console: next });
              try {
                await toggleConsole(next);
              } catch {
                // Non-Windows — ignore
              }
            }}
          >
            <div
              className="absolute top-0.5 w-4 h-4 rounded-full transition-transform bg-white"
              style={{ left: settings.show_console ? "1.25rem" : "0.125rem" }}
            />
          </div>
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("set.show_console")}
          </span>
        </label>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {t("set.console_sub")}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("set.logs")}
        </h2>
        <p className="text-sm font-mono rounded-xl px-4 py-3" style={{
          backgroundColor: "var(--bg-card)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border)"
        }}>
          {settings.log_dir}
        </p>
      </section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-xl px-6 py-3 text-sm font-medium transition-all disabled:opacity-50"
        style={{
          backgroundColor: "var(--success)",
          color: "#fff",
        }}
      >
        {saving ? t("set.saving") : t("set.save")}
      </button>
    </div>
  );
}
