use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum ServiceType {
    NodeProcess,
    PythonProcess,
    DockerContainer,
    WslInstance,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum RiskLevel {
    Safe,
    Caution,
    Danger,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortBinding {
    pub protocol: String,
    pub local_addr: String,
    pub remote_addr: Option<String>,
    pub state: String,
    pub owning_pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedService {
    pub id: String,
    pub service_type: ServiceType,
    pub name: String,
    pub pid: Option<u32>,
    pub command_line: String,
    pub working_dir: String,
    pub ports: Vec<PortBinding>,
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub disk_usage: u64,
    pub is_autostart: bool,
    pub autostart_source: Option<String>,
    pub children: Vec<u32>,
    pub safe_to_stop: bool,
    pub risk_level: RiskLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceSummary {
    pub active_services: usize,
    pub ports_in_use: usize,
    pub total_cpu: f32,
    pub total_memory: u64,
    pub total_disk: u64,
    pub autostart_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupTarget {
    pub path: String,
    pub size: u64,
    pub is_source_code: bool,
    pub category: CleanupCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum CleanupCategory {
    Safe,      // 可重建：node_modules, .venv, __pycache__, dist, etc.
    Warning,   // 不可重建：.env.local, Dockerfile, docker-compose.yml
    Source,    // 源代码：src, lib, app, etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub refresh_interval_secs: u64,
    pub excluded_paths: Vec<String>,
    pub log_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResult {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

// --- 自启动匹配关键词 ---

#[allow(dead_code)]
pub const SERVICE_KEYWORDS: &[&str] = &[
    "node", "python", "python3", "pip", "npm", "yarn", "pnpm",
    "docker", "flask", "fastapi", "gradio", "streamlit", "uvicorn",
    "jupyter", "gunicorn", "serve", "http-server", "live-server",
];

// --- 路径安全 ---

pub const FORBIDDEN_PATHS: &[&str] = &[
    r"C:\Windows\",
    r"C:\Program Files\",
    r"C:\Program Files (x86)\",
    r"C:\ProgramData\",
];

// --- 清理目标三级分类 ---

pub const CLEANUP_SAFE: &[&str] = &[
    "node_modules", ".venv", "venv", "__pycache__", ".cache",
    ".pytest_cache", ".mypy_cache", "dist", "build", ".next", ".nuxt",
];

pub const CLEANUP_WARNING: &[&str] = &[
    ".env.local", ".env.development.local", "Dockerfile", "docker-compose.yml",
];

pub const CLEANUP_SOURCE: &[&str] = &[
    "src", "lib", "app", "components", "pages", "internal", "pkg", "cmd",
];

pub fn all_cleanup_targets() -> Vec<&'static str> {
    CLEANUP_SAFE.iter()
        .chain(CLEANUP_WARNING.iter())
        .chain(CLEANUP_SOURCE.iter())
        .copied()
        .collect()
}
