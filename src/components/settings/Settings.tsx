import { useEffect, useState } from "react";
import { getSettings, saveSettings, restartAsAdmin } from "../../lib/api";
import { ToastContext } from "../../App";
import type { AppSettings } from "../../lib/types";

export function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [newExcludedPath, setNewExcludedPath] = useState("");

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((e) => ToastContext.addToast({ type: "error", title: "Failed to load settings", detail: String(e) }));
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettings(settings);
      ToastContext.addToast({ type: "success", title: "Settings saved" });
    } catch (e) {
      ToastContext.addToast({ type: "error", title: "Failed to save", detail: String(e) });
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
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Scan Settings
        </h2>
        <label className="flex items-center gap-4">
          <span className="w-48 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Refresh Interval
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
            seconds
          </span>
        </label>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Excluded Paths
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
                Remove
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newExcludedPath}
              onChange={(e) => setNewExcludedPath(e.target.value)}
              placeholder="Add path to exclude..."
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
              Add
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          System
        </h2>
        <div className="flex items-center gap-4">
          <button
            onClick={async () => {
              try {
                await restartAsAdmin();
              } catch (e) {
                ToastContext.addToast({ type: "error", title: "Failed to restart", detail: String(e) });
              }
            }}
            className="rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
            style={{
              backgroundColor: "var(--warning-bg)",
              color: "var(--warning)",
            }}
          >
            Restart as Administrator
          </button>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Required to stop some processes
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Logs
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
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
