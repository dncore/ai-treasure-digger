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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg" style={{ color: "var(--text-muted)" }}>
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl px-6 py-4"
        style={{
          backgroundColor: "var(--danger-bg)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          color: "var(--danger)",
        }}
      >
        Scan failed: {error}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Active Services"
          value={String(summary.active_services)}
          icon="◈"
          color="var(--accent)"
        />
        <StatCard
          label="Ports In Use"
          value={String(summary.ports_in_use)}
          icon="⊕"
          color="#f59e0b"
        />
        <StatCard
          label="CPU Usage"
          value={summary.total_cpu.toFixed(1) + "%"}
          icon="▧"
          color="#22c55e"
        />
        <StatCard
          label="Memory Usage"
          value={formatBytes(summary.total_memory)}
          icon="▤"
          color="#a855f7"
        />
      </div>

      {topConsumers.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            Top Resource Consumers
          </h2>
          <div className="space-y-2">
            {topConsumers.map((s, i) => {
              const riskConfig = RISK_CONFIG[s.risk_level];
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-6 text-right text-sm font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {i + 1}
                    </span>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {s.name}
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
                  </div>
                  <div className="flex gap-6 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    <span>CPU {s.cpu_usage.toFixed(1)}%</span>
                    <span>MEM {formatBytes(s.memory_usage)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {autostartServices.length > 0 && (
        <section>
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: "var(--warning)" }}
          >
            Autostart Services ({autostartServices.length})
          </h2>
          <div className="space-y-2">
            {autostartServices.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{
                  backgroundColor: "var(--warning-bg)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                }}
              >
                <div>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {s.name}
                  </span>
                  <span
                    className="ml-2 text-sm font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {s.autostart_source}
                  </span>
                </div>
                <span
                  className="rounded-md px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: "rgba(245, 158, 11, 0.15)",
                    color: "var(--warning)",
                  }}
                >
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

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-5 transition-all hover:scale-105"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="flex items-center gap-2 text-sm font-medium mb-3"
        style={{ color: "var(--text-secondary)" }}
      >
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

const RISK_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  Safe: { label: "Safe", bgColor: "var(--success-bg)", textColor: "var(--success)" },
  Caution: { label: "Caution", bgColor: "var(--warning-bg)", textColor: "var(--warning)" },
  Danger: { label: "Danger", bgColor: "var(--danger-bg)", textColor: "var(--danger)" },
  Critical: { label: "Critical", bgColor: "var(--critical-bg)", textColor: "var(--critical)" },
};
