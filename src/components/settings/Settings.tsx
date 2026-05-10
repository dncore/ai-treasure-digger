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

  if (!settings) return <div style={{ color: "var(--text-muted)" }}>Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Scan Settings</h2>
        <label className="flex items-center gap-3 text-sm">
          <span className="w-40" style={{ color: "var(--text-secondary)" }}>Refresh Interval</span>
          <input
            type="number"
            min={1}
            max={60}
            value={settings.refresh_interval_secs}
            onChange={(e) =>
              setSettings({ ...settings, refresh_interval_secs: Number(e.target.value) })
            }
            className="w-20 rounded border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
          />
          <span style={{ color: "var(--text-muted)" }}>seconds</span>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Excluded Paths</h2>
        <div className="space-y-2">
          {settings.excluded_paths.map((path, i) => (
            <div key={i} className="flex items-center justify-between rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
              <span style={{ color: "var(--text-secondary)" }}>{path}</span>
              <button
                onClick={() => removeExcludedPath(i)}
                className="hover:text-red-400"
                style={{ color: "var(--text-muted)" }}
              >
                &#x2715;
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newExcludedPath}
              onChange={(e) => setNewExcludedPath(e.target.value)}
              placeholder="Add path to exclude..."
              className="flex-1 rounded border px-3 py-1.5 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
              onKeyDown={(e) => e.key === "Enter" && addExcludedPath()}
            />
            <button
              onClick={addExcludedPath}
              className="rounded border px-3 py-1.5 text-sm transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Add
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Logs</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Log directory: {settings.log_dir}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">System</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              try {
                await restartAsAdmin();
              } catch (e) {
                ToastContext.addToast({ type: "error", title: "Failed to restart", detail: String(e) });
              }
            }}
            className="rounded border border-amber-700 px-4 py-2 text-sm text-amber-300 hover:bg-amber-950"
          >
            Restart as Administrator
          </button>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Required to stop some processes
          </span>
        </div>
      </section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
