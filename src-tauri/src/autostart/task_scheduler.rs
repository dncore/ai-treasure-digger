#[allow(unused_imports)]
use crate::models::SERVICE_KEYWORDS;

pub struct TaskEntry {
    pub name: String,
    #[allow(dead_code)]
    pub path: String,
    pub command: String,
    pub is_service_related: bool,
}

#[cfg(target_os = "windows")]
fn hidden_command(program: &str) -> std::process::Command {
    use std::os::windows::process::CommandExt;
    use windows::Win32::System::Threading::CREATE_NO_WINDOW;
    let mut cmd = std::process::Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW.0);
    cmd
}

#[cfg(target_os = "windows")]
pub fn scan_task_scheduler() -> Vec<TaskEntry> {
    let mut entries = Vec::new();

    let output = hidden_command("schtasks")
        .args(["/query", "/fo", "LIST", "/v"])
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut current_name = String::new();
        let mut current_command = String::new();

        for line in stdout.lines() {
            let trimmed = line.trim();

            if let Some(val) = trimmed.strip_prefix("Task Name:") {
                if !current_name.is_empty() {
                    let cmd_lower = current_command.to_lowercase();
                    let is_related = SERVICE_KEYWORDS.iter().any(|kw| cmd_lower.contains(kw));
                    entries.push(TaskEntry {
                        name: current_name.clone(),
                        path: String::new(),
                        command: current_command.clone(),
                        is_service_related: is_related,
                    });
                }
                current_name = val.trim().to_string();
                current_command = String::new();
            } else if let Some(val) = trimmed.strip_prefix("Task To Run:") {
                current_command = val.trim().to_string();
            }
        }

        if !current_name.is_empty() {
            let cmd_lower = current_command.to_lowercase();
            let is_related = SERVICE_KEYWORDS.iter().any(|kw| cmd_lower.contains(kw));
            entries.push(TaskEntry {
                name: current_name,
                path: String::new(),
                command: current_command,
                is_service_related: is_related,
            });
        }
    }
    entries
}

#[cfg(not(target_os = "windows"))]
pub fn scan_task_scheduler() -> Vec<TaskEntry> {
    Vec::new()
}
