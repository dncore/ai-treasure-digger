use std::path::PathBuf;

pub fn init(log_dir: &str) -> Result<(), log::SetLoggerError> {
    let log_path = PathBuf::from(log_dir);
    // Create the full directory tree including the logs/ directory itself
    let _ = std::fs::create_dir_all(&log_path);

    let date_str = chrono::Local::now().format("%Y-%m-%d").to_string();
    let log_file = log_path.join(format!("ai-treasure-digger-{date_str}.log"));

    let dispatch = fern::Dispatch::new()
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
        .chain(std::io::stdout());

    // File logging is best-effort — if it fails, just log to stdout
    let dispatch = match fern::log_file(&log_file) {
        Ok(file) => dispatch.chain(file),
        Err(e) => {
            eprintln!("Warning: failed to create log file {}: {e}, logging to stdout only", log_file.display());
            dispatch
        }
    };

    dispatch.apply()
}
