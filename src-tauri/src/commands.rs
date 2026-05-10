use crate::models::{
    AppSettings, BatchResult, CleanupTarget, DetectedService,
    ResourceSummary, RiskLevel, ServiceType,
};
use crate::scanner::{docker, port, process, resource, wsl};
use crate::autostart::{registry, task_scheduler};
use crate::operator::{autostart_mgr, cleanup, stop};
use crate::safety::guard;
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

pub struct ScanState {
    pub services: Vec<DetectedService>,
    pub last_scan: std::time::Instant,
}

pub struct AppState {
    pub scan_state: Arc<RwLock<ScanState>>,
    pub settings: Mutex<AppSettings>,
    pub app_handle: AppHandle,
}

impl AppState {
    pub fn new(app_handle: AppHandle) -> Self {
        let log_dir = std::env::current_exe()
            .unwrap_or_default()
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .join("data")
            .join("logs")
            .to_string_lossy()
            .to_string();

        Self {
            scan_state: Arc::new(RwLock::new(ScanState {
                services: Vec::new(),
                last_scan: std::time::Instant::now(),
            })),
            settings: Mutex::new(AppSettings {
                refresh_interval_secs: 5,
                excluded_paths: Vec::new(),
                log_dir,
            }),
            app_handle,
        }
    }

    pub fn new_with_scan_state(app_handle: AppHandle, scan_state: Arc<RwLock<ScanState>>) -> Self {
        let log_dir = std::env::current_exe()
            .unwrap_or_default()
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .join("data")
            .join("logs")
            .to_string_lossy()
            .to_string();

        Self {
            scan_state,
            settings: Mutex::new(AppSettings {
                refresh_interval_secs: 5,
                excluded_paths: Vec::new(),
                log_dir,
            }),
            app_handle,
        }
    }
}

/// 执行完整扫描（在后台线程调用）
pub async fn run_full_scan(scan_state: Arc<RwLock<ScanState>>, app_handle: AppHandle) {
    log::debug!("Starting full scan");

    // 端口扫描（含 PID 关联）
    let (_all_ports, pid_port_map) = port::scan_ports_with_pid();

    // 进程扫描（两级检测 + 端口关联）
    let mut services = process::scan_processes(&pid_port_map);

    // Docker
    match docker::scan_docker().await {
        Ok(docker_services) => services.extend(docker_services),
        Err(e) => log::debug!("Docker scan skipped: {e}"),
    }

    // WSL
    match wsl::scan_wsl() {
        Ok(wsl_services) => services.extend(wsl_services),
        Err(e) => log::debug!("WSL scan skipped: {e}"),
    }

    // 自启动检测
    let autostart_entries = registry::scan_registry_autostart();
    let task_entries = task_scheduler::scan_task_scheduler();

    // 资源信息 + 自启动标记
    for service in &mut services {
        // 自启动：通过 exe 路径或命令行匹配
        for entry in &autostart_entries {
            if service.command_line.to_lowercase().contains(&entry.name.to_lowercase())
                || (entry.is_ai_related && paths_overlap(&service.exe_or_working_dir(), &entry.command))
            {
                service.is_autostart = true;
                service.autostart_source = Some(entry.source.clone());
            }
        }
        for entry in &task_entries {
            if service.command_line.to_lowercase().contains(&entry.name.to_lowercase())
                || (entry.is_ai_related && paths_overlap(&service.exe_or_working_dir(), &entry.command))
            {
                service.is_autostart = true;
                service.autostart_source = Some("Task Scheduler".to_string());
            }
        }

        // 资源占用
        if let Some(pid) = service.pid {
            if let Some(usage) = resource::get_process_resource_usage(pid) {
                service.cpu_usage = usage.cpu_usage;
                service.memory_usage = usage.memory_usage;
            }
        }

        // 磁盘占用
        if !service.working_dir.is_empty() {
            service.disk_usage = resource::calculate_disk_usage(
                &service.working_dir,
                &crate::models::all_cleanup_targets(),
            );
        }

        // 重新计算风险等级（现在有资源数据了）
        service.risk_level = calculate_risk(
            &service.service_type,
            &service.ports,
            service.cpu_usage,
            service.memory_usage,
        );
        service.safe_to_stop = service.risk_level == RiskLevel::Safe;
    }

    // 更新共享缓存
    {
        let mut state = scan_state.write().unwrap();
        state.services = services.clone();
        state.last_scan = std::time::Instant::now();
    }

    log::debug!("Scan complete: {} services found", services.len());

    // 发送事件通知前端
    let _ = app_handle.emit("service-changed", &services);
}

fn paths_overlap(a: &str, b: &str) -> bool {
    let a_lower = a.to_lowercase();
    let b_lower = b.to_lowercase();
    a_lower.contains(&b_lower) || b_lower.contains(&a_lower)
}

fn calculate_risk(
    service_type: &ServiceType,
    ports: &[crate::models::PortBinding],
    cpu_usage: f32,
    memory_usage: u64,
) -> RiskLevel {
    match service_type {
        ServiceType::WslInstance | ServiceType::DockerContainer => RiskLevel::Critical,
        _ => {
            if !ports.is_empty() {
                RiskLevel::Danger
            } else if cpu_usage > 0.1 || memory_usage > 10 * 1024 * 1024 {
                RiskLevel::Caution
            } else {
                RiskLevel::Safe
            }
        }
    }
}

// --- Tauri Commands ---

#[tauri::command]
pub async fn get_services(state: tauri::State<'_, AppState>) -> Result<Vec<DetectedService>, String> {
    let scan_state = state.scan_state.read().map_err(|e| e.to_string())?;
    Ok(scan_state.services.clone())
}

#[tauri::command]
pub async fn get_resource_summary(state: tauri::State<'_, AppState>) -> Result<ResourceSummary, String> {
    let scan_state = state.scan_state.read().map_err(|e| e.to_string())?;
    let services = &scan_state.services;

    Ok(ResourceSummary {
        active_services: services.len(),
        ports_in_use: services.iter().map(|s| s.ports.len()).sum(),
        total_cpu: services.iter().map(|s| s.cpu_usage).sum(),
        total_memory: services.iter().map(|s| s.memory_usage).sum(),
        total_disk: services.iter().map(|s| s.disk_usage).sum(),
        autostart_count: services.iter().filter(|s| s.is_autostart).count(),
    })
}

#[tauri::command]
pub async fn get_top_consumers(state: tauri::State<'_, AppState>, n: usize) -> Result<Vec<DetectedService>, String> {
    let scan_state = state.scan_state.read().map_err(|e| e.to_string())?;
    let mut services = scan_state.services.clone();
    services.sort_by(|a, b| {
        let a_score = a.cpu_usage * 1000.0 + (a.memory_usage as f32 / 1024.0);
        let b_score = b.cpu_usage * 1000.0 + (b.memory_usage as f32 / 1024.0);
        b_score.partial_cmp(&a_score).unwrap_or(std::cmp::Ordering::Equal)
    });
    services.truncate(n);
    Ok(services)
}

#[tauri::command]
pub async fn stop_service(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let service_type = {
        let scan_state = state.scan_state.read().map_err(|e| e.to_string())?;
        let service = scan_state.services
            .iter()
            .find(|s| s.id == id)
            .ok_or_else(|| format!("Service not found: {id}"))?;
        service.service_type.clone()
    };

    let result = stop::stop_service_by_id(&id, &service_type);
    log::info!("Stop service {id}: {:?}", result.as_ref().err());
    run_full_scan(state.scan_state.clone(), state.app_handle.clone()).await;
    result
}

#[tauri::command]
pub async fn stop_services(state: tauri::State<'_, AppState>, ids: Vec<String>) -> Result<BatchResult, String> {
    let id_type_map: Vec<(String, ServiceType)> = {
        let scan_state = state.scan_state.read().map_err(|e| e.to_string())?;
        ids.iter()
            .filter_map(|id| {
                scan_state.services.iter()
                    .find(|s| s.id == *id)
                    .map(|s| (id.clone(), s.service_type.clone()))
            })
            .collect()
    };

    let mut result = BatchResult {
        total: ids.len(),
        succeeded: 0,
        failed: 0,
        errors: Vec::new(),
    };

    for (id, service_type) in &id_type_map {
        match stop::stop_service_by_id(id, service_type) {
            Ok(_) => result.succeeded += 1,
            Err(e) => {
                result.failed += 1;
                result.errors.push(format!("{id}: {e}"));
            }
        }
    }

    run_full_scan(state.scan_state.clone(), state.app_handle.clone()).await;
    log::info!("Batch stop: {} succeeded, {} failed", result.succeeded, result.failed);
    Ok(result)
}

#[tauri::command]
pub async fn disable_autostart(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let (name, source) = {
        let scan_state = state.scan_state.read().map_err(|e| e.to_string())?;
        let service = scan_state.services
            .iter()
            .find(|s| s.id == id)
            .ok_or_else(|| format!("Service not found: {id}"))?;
        (service.name.clone(), service.autostart_source.clone())
    };

    if let Some(source) = source {
        autostart_mgr::disable_registry_autostart(&name, &source)?;
    }
    run_full_scan(state.scan_state.clone(), state.app_handle.clone()).await;
    Ok(())
}

#[tauri::command]
pub async fn restore_autostart(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let scan_state = state.scan_state.read().map_err(|e| e.to_string())?;
    let name = scan_state.services
        .iter()
        .find(|s| s.id == id)
        .map(|s| s.name.clone())
        .unwrap_or_default();
    drop(scan_state);
    autostart_mgr::restore_autostart(&name)
}

#[tauri::command]
pub async fn get_cleanup_targets(state: tauri::State<'_, AppState>, id: String) -> Result<Vec<CleanupTarget>, String> {
    let scan_state = state.scan_state.read().map_err(|e| e.to_string())?;
    let service = scan_state.services
        .iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("Service not found: {id}"))?;

    if service.working_dir.is_empty() {
        return Ok(Vec::new());
    }

    Ok(cleanup::get_cleanup_targets(&service.working_dir))
}

#[tauri::command]
pub async fn start_cleanup(
    state: tauri::State<'_, AppState>,
    _id: String,
    selected_paths: Vec<String>,
) -> Result<(), String> {
    let safe_paths = guard::validate_cleanup_paths(&selected_paths);
    let app_handle = state.app_handle.clone();
    cleanup::execute_cleanup(&safe_paths, |progress| {
        let _ = app_handle.emit("cleanup-progress", progress);
    })?;
    run_full_scan(state.scan_state.clone(), state.app_handle.clone()).await;
    Ok(())
}

#[tauri::command]
pub async fn abort_cleanup() -> Result<(), String> {
    cleanup::abort_cleanup();
    Ok(())
}

#[tauri::command]
pub async fn trigger_scan(state: tauri::State<'_, AppState>) -> Result<(), String> {
    run_full_scan(state.scan_state.clone(), state.app_handle.clone()).await;
    Ok(())
}

#[tauri::command]
pub async fn restart_as_admin() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        Command::new("powershell")
            .args(["-Command", &format!("Start-Process '{}' -Verb RunAs", exe.display())])
            .spawn()
            .map_err(|e| format!("Failed to restart as admin: {e}"))?;
        std::process::exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Admin restart is only available on Windows".to_string())
    }
}

#[tauri::command]
pub async fn get_settings(state: tauri::State<'_, AppState>) -> Result<AppSettings, String> {
    let settings = state.settings.lock().await;
    Ok(settings.clone())
}

#[tauri::command]
pub async fn save_settings(
    state: tauri::State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    let mut current = state.settings.lock().await;
    *current = settings;
    Ok(())
}

/// Helper: get exe path or working dir for matching
trait ExeOrWorkingDir {
    fn exe_or_working_dir(&self) -> String;
}

impl ExeOrWorkingDir for DetectedService {
    fn exe_or_working_dir(&self) -> String {
        if !self.working_dir.is_empty() {
            self.working_dir.clone()
        } else if !self.command_line.is_empty() {
            self.command_line.clone()
        } else {
            String::new()
        }
    }
}
