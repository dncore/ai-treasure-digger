import { useEffect, useState, useCallback } from "react";
import { getServices, stopService, stopServices, disableAutostart, onServiceChanged } from "../../lib/api";
import { CleanupModal } from "./CleanupModal";
import { ToastContext } from "../../App";
import type { DetectedService, ServiceType } from "../../lib/types";

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  NodeProcess: "Node.js",
  PythonProcess: "Python",
  DockerContainer: "Docker",
  WslInstance: "WSL",
};

const SERVICE_TYPE_COLORS: Record<ServiceType, string> = {
  NodeProcess: "bg-green-900/50 text-green-300",
  PythonProcess: "bg-yellow-900/50 text-yellow-300",
  DockerContainer: "bg-blue-900/50 text-blue-300",
  WslInstance: "bg-purple-900/50 text-purple-300",
};

const RISK_COLORS: Record<string, string> = {
  Safe: "bg-emerald-900/50 text-emerald-300",
  Caution: "bg-amber-900/50 text-amber-300",
  Danger: "bg-orange-900/50 text-orange-300",
  Critical: "bg-red-900/50 text-red-300",
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

  if (loading) return <div style={{ color: "var(--text-muted)" }}>Scanning services...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Services</h1>
        <button
          onClick={load}
          className="rounded-lg border px-3 py-1.5 text-sm transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                filter === f.value
                  ? "font-medium"
                  : ""
              }`}
              style={filter === f.value ? { backgroundColor: "var(--bg-input)", color: "var(--text-primary)" } : { color: "var(--text-muted)" }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filtered.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {selected.size === filtered.length ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3">
          <span className="text-sm text-amber-300">{selected.size} selected</span>
          <button
            onClick={handleBatchStop}
            className="rounded border border-red-800 px-3 py-1 text-sm text-red-300 hover:bg-red-950"
          >
            Stop Selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded border px-3 py-1 text-sm transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Clear
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20" style={{ color: "var(--text-muted)" }}>
          <span className="text-4xl">&#x2728;</span>
          <p className="mt-3 text-lg">Your device is clean</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((service) => (
            <div
              key={service.id}
              className="rounded-lg border p-4 transition-colors"
              style={{
                borderColor: selected.has(service.id) ? "#065f46" : "var(--border)",
                backgroundColor: selected.has(service.id) ? "rgba(6,78,59,0.15)" : "var(--bg-card)",
              }}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(service.id)}
                  onChange={() => toggleSelect(service.id)}
                  className="mt-1 accent-emerald-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{service.name}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${SERVICE_TYPE_COLORS[service.service_type]}`}>
                      {SERVICE_TYPE_LABELS[service.service_type]}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs ${RISK_COLORS[service.risk_level]}`}>
                      {service.risk_level}
                    </span>
                    {service.is_autostart && (
                      <span className="rounded bg-amber-900/50 px-2 py-0.5 text-xs text-amber-300">
                        autostart
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm truncate" style={{ color: "var(--text-muted)" }} title={service.command_line}>
                    {service.command_line}
                  </p>
                  <div className="mt-2 flex gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                    {service.pid && <span>PID: {service.pid}</span>}
                    <span>CPU: {service.cpu_usage.toFixed(1)}%</span>
                    <span>MEM: {formatBytes(service.memory_usage)}</span>
                    <span>DISK: {formatBytes(service.disk_usage)}</span>
                    {service.ports.length > 0 && (
                      <span>Ports: {service.ports.map((p) => p.local_addr).join(", ")}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {service.working_dir.length > 0 && service.service_type !== "WslInstance" && (
                    <button
                      onClick={() => setCleanupTarget(service)}
                      className="rounded border px-2 py-1 text-xs transition-colors"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      Cleanup
                    </button>
                  )}
                  {service.is_autostart && (
                    <button
                      onClick={() => handleDisableAutostart(service.id)}
                      className="rounded border border-amber-800 px-2 py-1 text-xs text-amber-300 hover:bg-amber-950"
                    >
                      Disable Autostart
                    </button>
                  )}
                  <button
                    onClick={() => handleStop(service.id)}
                    disabled={service.risk_level === "Critical" || stopping.has(service.id)}
                    className="rounded border border-red-800 px-2 py-1 text-xs text-red-300 hover:bg-red-950 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {stopping.has(service.id) ? "Stopping..." : "Stop"}
                  </button>
                </div>
              </div>
            </div>
          ))}
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
