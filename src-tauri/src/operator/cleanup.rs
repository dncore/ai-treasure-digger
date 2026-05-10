use std::sync::atomic::{AtomicBool, Ordering};
use crate::models::{CleanupCategory, CleanupTarget, CLEANUP_SAFE, CLEANUP_WARNING, CLEANUP_SOURCE, FORBIDDEN_PATHS};

static ABORT_FLAG: AtomicBool = AtomicBool::new(false);

pub fn abort_cleanup() {
    ABORT_FLAG.store(true, Ordering::SeqCst);
}

fn is_forbidden(path: &str) -> bool {
    FORBIDDEN_PATHS.iter().any(|p| path.starts_with(p))
}

fn categorize(name: &str) -> CleanupCategory {
    if CLEANUP_SAFE.contains(&name) {
        CleanupCategory::Safe
    } else if CLEANUP_WARNING.contains(&name) {
        CleanupCategory::Warning
    } else if CLEANUP_SOURCE.contains(&name) {
        CleanupCategory::Source
    } else {
        CleanupCategory::Safe
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CleanupProgress {
    pub current: usize,
    pub total: usize,
    pub current_path: String,
    pub deleted: Vec<String>,
    pub failed: Vec<String>,
}

pub fn get_cleanup_targets(working_dir: &str) -> Vec<CleanupTarget> {
    let mut targets = Vec::new();
    let base = std::path::Path::new(working_dir);

    if !base.exists() { return targets; }

    let all_names: Vec<&str> = CLEANUP_SAFE.iter()
        .chain(CLEANUP_WARNING.iter())
        .chain(CLEANUP_SOURCE.iter())
        .copied()
        .collect();

    for target_name in all_names {
        let target_path = base.join(target_name);
        if target_path.exists() {
            let path_str = target_path.to_string_lossy().to_string();
            if is_forbidden(&path_str) { continue; }

            let category = categorize(target_name);
            let is_source = category == CleanupCategory::Source;
            let size = if target_path.is_dir() {
                dir_size(&target_path)
            } else {
                std::fs::metadata(&target_path).map(|m| m.len()).unwrap_or(0)
            };

            targets.push(CleanupTarget {
                path: path_str,
                size,
                is_source_code: is_source,
                category,
            });
        }
    }

    targets
}

pub fn execute_cleanup<F>(selected_paths: &[String], mut on_progress: F) -> Result<Vec<String>, String>
where
    F: FnMut(&CleanupProgress),
{
    ABORT_FLAG.store(false, Ordering::SeqCst);
    let total = selected_paths.len();
    let mut deleted = Vec::new();
    let mut failed = Vec::new();

    for (i, path) in selected_paths.iter().enumerate() {
        if ABORT_FLAG.load(Ordering::SeqCst) {
            break;
        }

        if is_forbidden(path) {
            failed.push(path.clone());
            on_progress(&CleanupProgress {
                current: i + 1,
                total,
                current_path: path.clone(),
                deleted: deleted.clone(),
                failed: failed.clone(),
            });
            continue;
        }

        let p = std::path::Path::new(path);
        let result = if p.is_dir() {
            std::fs::remove_dir_all(p)
        } else if p.is_file() {
            std::fs::remove_file(p)
        } else {
            continue;
        };

        match result {
            Ok(_) => {
                deleted.push(path.clone());
            }
            Err(e) => {
                log::warn!("Failed to remove {path}: {e}");
                failed.push(path.clone());
            }
        }

        on_progress(&CleanupProgress {
            current: i + 1,
            total,
            current_path: path.clone(),
            deleted: deleted.clone(),
            failed: failed.clone(),
        });
    }

    Ok(deleted)
}

fn dir_size(path: &std::path::Path) -> u64 {
    let mut total: u64 = 0;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    total += metadata.len();
                } else if metadata.is_dir() {
                    total += dir_size(&entry.path());
                }
            }
        }
    }
    total
}
