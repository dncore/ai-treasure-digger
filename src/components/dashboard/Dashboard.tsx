import { useEffect, useState } from "react";
import { getServices, getResourceSummary, getTopConsumers, onServiceChanged } from "../../lib/api";
import type { ResourceSummary, DetectedService } from "../../lib/types";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function Dashboard() {
  const [summary, setSummary] = useState<ResourceSummary | null>(null);
  const [topConsumers, setTopConsumers] = useState<DetectedService[]>([]);
  const [autostartServices, setAutostartServices] = useState<DetectedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [sum, top, services] = await Promise.all([
        getResourceSummary(),
        getTopConsumers(5),
        getServices(),
      ]);
      setSummary(sum);
      setTopConsumers(top);
      setAutostartServices(services.filter((s) => s.is_autostart));
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const unlisten = onServiceChanged(() => load());
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  if (loading) return <div style={{ color: "var(--text-muted)" }}>Scanning...</div>;

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-300">
        Scan failed: {error}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Services" value={String(summary.active_services)} icon="◈" />
        <StatCard label="Ports In Use" value={String(summary.ports_in_use)} icon="⊕" />
        <StatCard label="CPU Usage" value={summary.total_cpu.toFixed(1) + "%"} icon="▧" />
        <StatCard label="Memory Usage" value={formatBytes(summary.total_memory)} icon="▤" />
      </div>

      {topConsumers.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Top Resource Consumers</h2>
          <div className="space-y-2">
            {topConsumers.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-right text-sm" style={{ color: "var(--text-muted)" }}>{i + 1}.</span>
                  <span className="font-medium">{s.name}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${riskColor(s.risk_level)}`}>
                    {s.risk_level}
                  </span>
                </div>
                <div className="flex gap-6 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span>CPU {s.cpu_usage.toFixed(1)}%</span>
                  <span>MEM {formatBytes(s.memory_usage)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {autostartServices.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-amber-400">
            Autostart Services ({autostartServices.length})
          </h2>
          <div className="space-y-2">
            {autostartServices.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3"
              >
                <div>
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-2 text-sm" style={{ color: "var(--text-secondary)" }}>{s.autostart_source}</span>
                </div>
                <span className="rounded bg-amber-900/50 px-2 py-0.5 text-xs text-amber-300">
                  autostart
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        <span>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function riskColor(level: string): string {
  switch (level) {
    case "Safe": return "bg-emerald-900/50 text-emerald-300";
    case "Caution": return "bg-amber-900/50 text-amber-300";
    case "Danger": return "bg-orange-900/50 text-orange-300";
    case "Critical": return "bg-red-900/50 text-red-300";
    default: return "bg-neutral-800 text-neutral-400";
  }
}
