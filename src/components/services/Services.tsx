import { useEffect, useState, useCallback } from "react";
import { getServices, stopService, stopServices, disableAutostart, onServiceChanged } from "../../lib/api";
import { CleanupModal } from "./CleanupModal";
import { ToastContext } from "../../App";
import type { DetectedService, ServiceType } from "../../lib/types";

const SERVICE_TYPE_CONFIG: Record<ServiceType, { label: string; color: string }> = {
  NodeProcess: { label: "Node.js", color: "#22c55e" },
  PythonProcess: { label: "Python", color: "#eab308" },
  DockerContainer: { label: "Docker", color: "#3b82f6" },
  WslInstance: { label: "WSL", color: "#a855f7" },
};

const RISK_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  Safe: { label: "Safe", bgColor: "var(--success-bg)", textColor: "var(--success)" },
  Caution: { label: "Caution", bgColor: "var(--warning-bg)", textColor: "var(--warning)" },
  Danger: { label: "Danger", bgColor: "var(--danger-bg)", textColor: "var(--danger)" },
  Critical: { label: "Critical", bgColor: "var(--critical-bg)", textColor: "var(--critical)" },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

type Filter = "all" | ServiceType;

export function Services() {
  const [services, setServices] = useState<DetectedService[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cleanupTarget, setCleanupTarget] = useState<DetectedService | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await getServices();
      setServices(result);
    } catch (e) {
      ToastContext.addToast({ type: "error", title: "Scan failed", detail: String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unlisten = onServiceChanged(load);
    return () => { unlisten.then((fn) => fn()); };
  }, [load]);

  async function handleStop(id: string) {
    setStopping((prev) => new Set(prev).add(id));
    try {
      await stopService(id);
      ToastContext.addToast({ type: "success", title: "Service stopped" });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      ToastContext.addToast({ type: "error", title: "Failed to stop", detail: String(e) });
    } finally {
      setStopping((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  async function handleBatchStop() {
    try {
      const result = await stopServices(Array.from(selected));
      if (result.failed > 0) {
        ToastContext.addToast({ type: "warning", title: `${result.succeeded} stopped, ${result.failed} failed` });
      } else {
        ToastContext.addToast({ type: "success", title: `${result.succeeded} services stopped` });
      }
      setSelected(new Set());
    } catch (e) {
      ToastContext.addToast({ type: "error", title: "Batch stop failed", detail: String(e) });
    }
  }

  async function handleDisableAutostart(id: string) {
    try {
      await disableAutostart(id);
      ToastContext.addToast({ type: "success", title: "Autostart disabled" });
    } catch (e) {
      ToastContext.addToast({ type: "error", title: "Failed to disable autostart", detail: String(e) });
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const filtered = filter === "all" ? services : services.filter((s) => s.service_type === filter);
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.id)));
    }
  }

  const filtered = filter === "all" ? services : services.filter((s) => s.service_type === filter);

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "NodeProcess", label: "Node.js" },
    { value: "PythonProcess", label: "Python" },
    { value: "DockerContainer", label: "Docker" },
    { value: "WslInstance", label: "WSL" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center" style={{ color: "var(--text-muted)" }}>
          <div className="animate-pulse text-lg">Scanning services...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Services</h1>
        <button
          onClick={load}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-all hover:scale-105"
          style={{
            backgroundColor: "var(--bg-input)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        >
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1.5 p-1 rounded-lg" style={{ backgroundColor: "var(--bg-card)" }}>
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className="rounded-md px-3 py-1.5 text-sm font-medium transition-all"
              style={{
                backgroundColor: filter === f.value ? "var(--bg-input)" : "transparent",
                color: filter === f.value ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filtered.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors hover:bg-[var(--bg-input)]"
            style={{ color: "var(--text-secondary)" }}
          >
            {selected.size === filtered.length ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            backgroundColor: "var(--warning-bg)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
          }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--warning)" }}>
            {selected.size} selected
          </span>
          <button
            onClick={handleBatchStop}
            className="rounded-lg px-3 py-1 text-sm font-medium transition-all"
            style={{
              backgroundColor: "var(--danger)",
              color: "#fff",
            }}
          >
            Stop Selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-lg px-3 py-1 text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--bg-input)",
              color: "var(--text-secondary)",
            }}
          >
            Clear
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div
            className="text-6xl mb-4 opacity-50"
            style={{ color: "var(--text-muted)" }}
          >
            ✓
          </div>
          <p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>
            Your device is clean
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            No services detected
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((service) => {
            const typeConfig = SERVICE_TYPE_CONFIG[service.service_type];
            const riskConfig = RISK_CONFIG[service.risk_level];
            const isSelected = selected.has(service.id);

            return (
              <div
                key={service.id}
                className="rounded-xl p-4 transition-all cursor-pointer hover:scale-[1.01]"
                style={{
                  backgroundColor: isSelected ? "var(--bg-card-hover)" : "var(--bg-card)",
                  border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                  boxShadow: isSelected ? "0 0 0 1px var(--accent)" : "none",
                }}
                onClick={() => toggleSelect(service.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(service.id)}
                    className="mt-1 w-4 h-4 rounded"
                    style={{ accentColor: "var(--accent)" }}
                    onClick={(e) => e.stopPropagation()}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                        {service.name}
                      </span>

                      <span
                        className="rounded-md px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${typeConfig.color}15`,
                          color: typeConfig.color,
                        }}
                      >
                        {typeConfig.label}
                      </span>

                      <span
                        className="rounded-md px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: riskConfig.bgColor,
                          color: riskConfig.textColor,
                        }}
                      >
                        {riskConfig.label}
                      </span>

                      {service.is_autostart && (
                        <span
                          className="rounded-md px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: "var(--warning-bg)",
                            color: "var(--warning)",
                          }}
                        >
                          autostart
                        </span>
                      )}
                    </div>

                    <p
                      className="text-sm mb-2 truncate"
                      style={{ color: "var(--text-secondary)" }}
                      title={service.command_line}
                    >
                      {service.command_line}
                    </p>

                    <div className="flex gap-4 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                      {service.pid && <span>PID: {service.pid}</span>}
                      <span>CPU: {service.cpu_usage.toFixed(1)}%</span>
                      <span>MEM: {formatBytes(service.memory_usage)}</span>
                      <span>DISK: {formatBytes(service.disk_usage)}</span>
                      {service.ports.length > 0 && (
                        <span style={{ color: "var(--accent)" }}>
                          {service.ports.length} port{service.ports.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {service.working_dir.length > 0 && service.service_type !== "WslInstance" && (
                      <button
                        onClick={() => setCleanupTarget(service)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                        style={{
                          backgroundColor: "var(--bg-input)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Cleanup
                      </button>
                    )}
                    {service.is_autostart && (
                      <button
                        onClick={() => handleDisableAutostart(service.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                        style={{
                          backgroundColor: "var(--warning-bg)",
                          color: "var(--warning)",
                        }}
                      >
                        Disable
                      </button>
                    )}
                    <button
                      onClick={() => handleStop(service.id)}
                      disabled={service.risk_level === "Critical" || stopping.has(service.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: "var(--danger-bg)",
                        color: "var(--danger)",
                      }}
                    >
                      {stopping.has(service.id) ? "Stopping..." : "Stop"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cleanupTarget && (
        <CleanupModal
          service={cleanupTarget}
          onClose={() => setCleanupTarget(null)}
        />
      )}
    </div>
  );
}
