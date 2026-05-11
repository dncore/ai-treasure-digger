mod commands;
mod models;
mod scanner;
mod autostart;
mod operator;
mod safety;
mod logger;

use commands::AppState;
use std::sync::{Arc, RwLock};
use std::path::PathBuf;
use tauri::Manager;

/// Determine the data directory.
/// Portable mode: if `portable.marker` exists next to the exe, use `<exe_dir>/data/`
/// Installed mode: use Tauri's app_data_dir (e.g. %LOCALAPPDATA% on Windows)
fn resolve_data_dir(app: &tauri::App) -> PathBuf {
    let exe = std::env::current_exe().unwrap_or_default();
    if let Some(exe_dir) = exe.parent() {
        let marker = exe_dir.join("portable.marker");
        if marker.exists() {
            return exe_dir.join("data");
        }
    }

    app.path().app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = resolve_data_dir(app);
            let log_dir = data_dir.join("logs");
            let log_dir_str = log_dir.to_string_lossy().to_string();
            let data_dir_str = data_dir.to_string_lossy().to_string();

            if let Err(e) = logger::init(&log_dir_str) {
                eprintln!("Failed to initialize logger: {e}");
            }
            log::info!("AI Treasure Digger starting, data dir: {}", data_dir.display());

            let app_handle = app.handle().clone();
            let scan_state = Arc::new(RwLock::new(commands::ScanState {
                services: Vec::new(),
                last_scan: std::time::Instant::now(),
            }));

            app.manage(AppState::new_with_dirs(app_handle.clone(), scan_state.clone(), &data_dir_str));

            // 启动后台扫描线程
            let scan_state_bg = scan_state.clone();
            let app_handle_bg = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                commands::run_full_scan(scan_state_bg.clone(), app_handle_bg.clone()).await;

                loop {
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    commands::run_full_scan(scan_state_bg.clone(), app_handle_bg.clone()).await;
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_services,
            commands::get_resource_summary,
            commands::get_top_consumers,
            commands::stop_service,
            commands::stop_services,
            commands::disable_autostart,
            commands::restore_autostart,
            commands::get_cleanup_targets,
            commands::start_cleanup,
            commands::abort_cleanup,
            commands::trigger_scan,
            commands::restart_as_admin,
            commands::get_settings,
            commands::save_settings,
            commands::toggle_console,
            commands::is_admin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
