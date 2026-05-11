import { useState, useEffect } from "react";
import { getCleanupTargets, startCleanup, abortCleanup, onCleanupProgress } from "../../lib/api";
import { ToastContext, useI18n } from "../../App";
import type { DetectedService, CleanupTarget, CleanupCategory, CleanupProgress } from "../../lib/types";
import type { TranslationKey } from "../../i18n";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const CATEGORY_KEYS: Record<CleanupCategory, { icon: string; labelKey: TranslationKey; color: string }> = {
  Safe: { icon: "\u{1F7E2}", labelKey: "cleanup.category_safe", color: "border-emerald-800/50 bg-emerald-950/20" },
  Warning: { icon: "\u{1F7E1}", labelKey: "cleanup.category_warning", color: "border-amber-800/50 bg-amber-950/20" },
  Source: { icon: "\u{1F534}", labelKey: "cleanup.category_source", color: "border-red-800/50 bg-red-950/20" },
};

type Step = "select" | "confirm-wsl" | "execute";

interface CleanupModalProps {
  service: DetectedService;
  onClose: () => void;
}

export function CleanupModal({ service, onClose }: CleanupModalProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("select");
  const [targets, setTargets] = useState<CleanupTarget[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<CleanupProgress | null>(null);

  useEffect(() => {
    if (step !== "execute") return;
    const unlisten = onCleanupProgress(setProgress);
    return () => { unlisten.then((fn) => fn()); };
  }, [step]);

  async function loadTargets() {
    setLoading(true);
    try {
      const result = await getCleanupTargets(service.id);
      setTargets(result);
      const defaultSelected = new Set(
        result.filter((item) => item.category === "Safe").map((item) => item.path)
      );
      setSelectedPaths(defaultSelected);
    } catch (e) {
      ToastContext.addToast({ type: "error", title: t("toast.scan_failed"), detail: String(e) });
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setStep("select");
    loadTargets();
  }

  function togglePath(path: string) {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }

  async function handleStartCleanup() {
    if (service.service_type === "WslInstance" && step === "select") {
      setStep("confirm-wsl");
      return;
    }

    setStep("execute");
    try {
      await startCleanup(service.id, Array.from(selectedPaths));
      ToastContext.addToast({ type: "success", title: t("toast.cleanup_complete") });
      onClose();
    } catch (e) {
      ToastContext.addToast({ type: "error", title: t("toast.scan_failed"), detail: String(e) });
    }
  }

  async function handleAbort() {
    try {
      await abortCleanup();
      onClose();
    } catch (e) {
      ToastContext.addToast({ type: "error", title: "Abort failed", detail: String(e) });
    }
  }

  const totalSize = targets
    .filter((item) => selectedPaths.has(item.path))
    .reduce((acc, item) => acc + item.size, 0);

  const grouped = {
    Safe: targets.filter((item) => item.category === "Safe"),
    Warning: targets.filter((item) => item.category === "Warning"),
    Source: targets.filter((item) => item.category === "Source"),
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border p-6 shadow-2xl"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{t("cleanup.title")}: {service.name}</h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>&#x2715;</button>
        </div>

        {step === "select" && loading && (
          <div className="py-8 text-center" style={{ color: "var(--text-muted)" }}>Loading...</div>
        )}

        {step === "select" && !loading && targets.length === 0 && (
          <div className="py-8 text-center">
            <p style={{ color: "var(--text-secondary)" }}>{t("cleanup.no_targets")}</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{t("cleanup.no_targets_sub")}</p>
          </div>
        )}

        {step === "select" && !loading && targets.length > 0 && (
          <div className="space-y-4 max-h-[60vh] overflow-auto">
            {(["Safe", "Warning", "Source"] as CleanupCategory[]).map((cat) => {
              const items = grouped[cat];
              if (items.length === 0) return null;
              const config = CATEGORY_KEYS[cat];
              return (
                <div key={cat}>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <span>{config.icon}</span>
                    <span>{t(config.labelKey)}</span>
                    <span style={{ color: "var(--text-muted)" }}>({items.length})</span>
                  </h3>
                  <div className="space-y-1">
                    {items.map((target) => (
                      <label
                        key={target.path}
                        className={`flex items-center justify-between rounded-lg border p-2.5 cursor-pointer ${config.color}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedPaths.has(target.path)}
                            onChange={() => togglePath(target.path)}
                            className="accent-emerald-500 flex-shrink-0"
                          />
                          <span className="text-sm truncate" title={target.path}>{target.path.split(/[\\/]/).pop()}</span>
                        </div>
                        <span className="text-sm flex-shrink-0 ml-2" style={{ color: "var(--text-muted)" }}>{formatBytes(target.size)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {t("cleanup.selected_count", { n: selectedPaths.size })} &middot; {t("cleanup.total_size")}: {formatBytes(totalSize)}
              </span>
              <button
                onClick={handleStartCleanup}
                disabled={selectedPaths.size === 0}
                className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {service.service_type === "WslInstance" ? t("cleanup.next") : t("cleanup.start_cleanup")}
              </button>
            </div>
          </div>
        )}

        {step === "confirm-wsl" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-800 bg-red-950/50 p-4">
              <h3 className="font-semibold text-red-300 mb-2">WSL Warning</h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {t("cleanup.confirm_warning")}
              </p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" id="wsl-c1" className="accent-red-500" />
                {t("cleanup.confirm_warning")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" id="wsl-c2" className="accent-red-500" />
                {t("cleanup.confirm_warning")}
              </label>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const c1 = (document.getElementById("wsl-c1") as HTMLInputElement)?.checked;
                  const c2 = (document.getElementById("wsl-c2") as HTMLInputElement)?.checked;
                  if (c1 && c2) handleStartCleanup();
                }}
                className="rounded bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-600"
              >
                {t("cleanup.start_cleanup")}
              </button>
              <button
                onClick={() => setStep("select")}
                className="rounded border px-4 py-2 text-sm transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {t("cleanup.back")}
              </button>
            </div>
          </div>
        )}

        {step === "execute" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--text-secondary)" }}>
                {progress ? `${t("cleanup.cleaning")} ${progress.current}/${progress.total}` : `${t("cleanup.cleaning")}...`}
              </span>
              {progress && (
                <span style={{ color: "var(--text-muted)" }}>
                  {progress.deleted.length} deleted, {progress.failed.length} failed
                </span>
              )}
            </div>
            {progress && (
              <>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-input)" }}>
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }} title={progress.current_path}>
                  {progress.current_path.split(/[\\/]/).pop()}
                </p>
              </>
            )}
            <button
              onClick={handleAbort}
              className="rounded border px-4 py-2 text-sm transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              {t("cleanup.abort")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
