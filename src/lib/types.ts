export interface PortBinding {
  protocol: string;
  local_addr: string;
  remote_addr: string | null;
  state: string;
  owning_pid: number | null;
}

export type ServiceType = "NodeProcess" | "PythonProcess" | "DockerContainer" | "WslInstance";
export type RiskLevel = "Safe" | "Caution" | "Danger" | "Critical";
export type CleanupCategory = "Safe" | "Warning" | "Source";

export interface DetectedService {
  id: string;
  service_type: ServiceType;
  name: string;
  pid: number | null;
  command_line: string;
  working_dir: string;
  ports: PortBinding[];
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  is_autostart: boolean;
  autostart_source: string | null;
  children: number[];
  safe_to_stop: boolean;
  risk_level: RiskLevel;
}

export interface ResourceSummary {
  active_services: number;
  ports_in_use: number;
  total_cpu: number;
  total_memory: number;
  total_disk: number;
  autostart_count: number;
}

export interface CleanupTarget {
  path: string;
  size: number;
  is_source_code: boolean;
  category: CleanupCategory;
}

export interface AppSettings {
  refresh_interval_secs: number;
  excluded_paths: string[];
  log_dir: string;
  show_console: boolean;
}

export interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning";
  title: string;
  detail?: string;
}

export interface CleanupProgress {
  current: number;
  total: number;
  current_path: string;
  deleted: string[];
  failed: string[];
}
