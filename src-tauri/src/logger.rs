use std::path::PathBuf;

pub fn init(log_dir: &str) -> Result<(), log::SetLoggerError> {
    let log_path = PathBuf::from(log_dir);
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let date_str = chrono::Local::now().format("%Y-%m-%d").to_string();
    let log_file = log_path.join(format!("ai-treasure-digger-{date_str}.log"));
    let log_file_str = log_file.to_string_lossy().to_string();

    fern::Dispatch::new()
        .format(|out, message, record| {
            out.finish(format_args!(
                "{}[{}][{}] {}",
                chrono::Local::now().format("[%Y-%m-%d %H:%M:%S]"),
                record.target(),
                record.level(),
                message,
            ))
        })
        .level(log::LevelFilter::Info)
        .level_for("ai_treasure_digger", log::LevelFilter::Debug)
        .chain(std::io::stdout())
        .chain(fern::log_file(&log_file_str).unwrap_or_else(|e| {
            eprintln!("Failed to create log file {log_file_str}: {e}");
            std::process::exit(1);
        }))
        .apply()
}
