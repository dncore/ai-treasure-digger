use crate::models::FORBIDDEN_PATHS;

pub fn is_path_safe(path: &str) -> bool {
    !FORBIDDEN_PATHS.iter().any(|p| path.starts_with(p))
}

pub fn validate_cleanup_paths(paths: &[String]) -> Vec<String> {
    paths
        .iter()
        .filter(|p| is_path_safe(p))
        .cloned()
        .collect()
}
