mod commands;
mod models;
mod scanner;
mod autostart;
mod operator;
mod safety;
mod logger;

use commands::AppState;
use std::sync::{Arc, RwLock};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let log_dir = std::env::current_exe()
                .unwrap_or_default()
                .parent()
                .unwrap_or(std::path::Path::new("."))
                .join("data")
                .join("logs")
                .to_string_lossy()
                .to_string();

            if let Err(e) = logger::init(&log_dir) {
                eprintln!("Failed to initialize logger: {e}");
            }
            log::info!("AI Treasure Digger starting, log dir: {log_dir}");

            let app_handle = app.handle().clone();
            let scan_state = Arc::new(RwLock::new(commands::ScanState {
                services: Vec::new(),
                last_scan: std::time::Instant::now(),
            }));

            app.manage(AppState::new_with_scan_state(app_handle.clone(), scan_state.clone()));

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
