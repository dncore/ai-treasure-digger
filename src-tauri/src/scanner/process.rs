use std::collections::HashMap;
use crate::models::{
    DetectedService, DetectionMethod, PortBinding, RiskLevel, ServiceType,
    HARD_MATCH_RULES, soft_match,
};

pub struct ProcessInfo {
    pub pid: u32,
    pub exe_path: String,
    pub command_line: String,
    pub working_dir: String,
}

#[cfg(target_os = "windows")]
fn get_process_list() -> Vec<ProcessInfo> {
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
    };
    use windows::Win32::System::ProcessStatus::EnumProcesses;
    use windows::Win32::Foundation::{CloseHandle, MAX_PATH};
    use windows::core::PWSTR;
    use windows::Win32::System::Threading::{PROCESS_NAME_FORMAT, QueryFullProcessImageNameW};

    let mut pids = [0u32; 4096];
    let mut bytes_returned = 0u32;
    unsafe {
        let _ = EnumProcesses(pids.as_mut_ptr(), (pids.len() * 4) as u32, &mut bytes_returned);
    }
    let count = bytes_returned as usize / 4;

    let mut result = Vec::new();
    for &pid in &pids[..count] {
        if pid == 0 { continue; }

        unsafe {
            if let Ok(handle) = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid) {
                let exe_path = {
                    let mut size = MAX_PATH as u32;
                    let mut buffer = [0u16; MAX_PATH as usize];
                    if QueryFullProcessImageNameW(
                        handle,
                        PROCESS_NAME_FORMAT(0),
                        PWSTR(buffer.as_mut_ptr()),
                        &mut size,
                    ).is_ok() {
                        String::from_utf16_lossy(&buffer[..size as usize])
                    } else {
                        String::new()
                    }
                };
                CloseHandle(handle).ok();

                let command_line = get_command_line(pid).unwrap_or_default();
                let working_dir = get_working_dir(pid).unwrap_or_default();

                result.push(ProcessInfo { pid, exe_path, command_line, working_dir });
            }
        }
    }
    result
}

#[cfg(target_os = "windows")]
fn get_command_line(pid: u32) -> Option<String> {
    use std::process::Command;
    let output = Command::new("wmic")
        .args(["process", "where", &format!("ProcessId={pid}"), "get", "CommandLine", "/value"])
        .output()
        .ok()?;
    let s = String::from_utf8_lossy(&output.stdout);
    for line in s.lines() {
        if let Some(val) = line.strip_prefix("CommandLine=") {
            return Some(val.trim().to_string());
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn get_working_dir(pid: u32) -> Option<String> {
    use std::process::Command;
    let output = Command::new("wmic")
        .args(["process", "where", &format!("ProcessId={pid}"), "get", "ExecutablePath", "/value"])
        .output()
        .ok()?;
    let s = String::from_utf8_lossy(&output.stdout);
    for line in s.lines() {
        if let Some(val) = line.strip_prefix("ExecutablePath=") {
            if let Some(pos) = val.rfind('\\') {
                return Some(val[..pos].to_string());
            }
        }
    }
    None
}

#[cfg(not(target_os = "windows"))]
fn get_process_list() -> Vec<ProcessInfo> {
    use std::process::Command;
    let output = Command::new("ps").args(["-eo", "pid,comm,args"]).output();
    let mut result = Vec::new();
    if let Ok(output) = output {
        let s = String::from_utf8_lossy(&output.stdout);
        for line in s.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let pid = parts[0].parse::<u32>().unwrap_or(0);
                if pid == 0 { continue; }
                result.push(ProcessInfo {
                    pid,
                    exe_path: parts[1].to_string(),
                    command_line: parts[2..].join(" "),
                    working_dir: String::new(),
                });
            }
        }
    }
    result
}

fn classify_process(exe: &str, cmdline: &str) -> Option<(ServiceType, DetectionMethod)> {
    let exe_lower = exe.to_lowercase();
    let cmd_lower = cmdline.to_lowercase();

    for rule in HARD_MATCH_RULES {
        if cmd_lower.contains(rule.pattern) {
            return Some((rule.service_type.clone(), DetectionMethod::HardMatch));
        }
    }

    let is_node = exe_lower.contains("node") || exe_lower.contains("nodejs");
    let is_python = exe_lower.contains("python");

    if is_node {
        if soft_match(cmdline) {
            return Some((ServiceType::NodeProcess, DetectionMethod::SoftMatch));
        }
    }
    if is_python {
        if soft_match(cmdline) {
            return Some((ServiceType::PythonProcess, DetectionMethod::SoftMatch));
        }
    }

    None
}

fn calculate_risk_level(
    service_type: &ServiceType,
    ports: &[PortBinding],
    cpu_usage: f32,
    memory_usage: u64,
) -> RiskLevel {
    match service_type {
        ServiceType::WslInstance => return RiskLevel::Critical,
        ServiceType::DockerContainer => return RiskLevel::Critical,
        _ => {}
    }

    if !ports.is_empty() {
        return RiskLevel::Danger;
    }

    if cpu_usage > 0.1 || memory_usage > 10 * 1024 * 1024 {
        return RiskLevel::Caution;
    }

    RiskLevel::Safe
}

pub fn scan_processes(port_map: &HashMap<u32, Vec<PortBinding>>) -> Vec<DetectedService> {
    let processes = get_process_list();
    let mut services = Vec::new();

    for proc in processes {
        if let Some((service_type, detection_method)) = classify_process(&proc.exe_path, &proc.command_line) {
            let pid_ports = port_map.get(&proc.pid).cloned().unwrap_or_default();

            let risk = calculate_risk_level(&service_type, &pid_ports, 0.0, 0);
            let name = extract_name(&proc.command_line, &proc.exe_path);

            services.push(DetectedService {
                id: format!("{}:{}", serde_json::to_value(&service_type).unwrap().as_str().unwrap_or("unknown"), proc.pid),
                service_type,
                name,
                pid: Some(proc.pid),
                command_line: proc.command_line,
                working_dir: proc.working_dir,
                ports: pid_ports,
                cpu_usage: 0.0,
                memory_usage: 0,
                disk_usage: 0,
                is_autostart: false,
                autostart_source: None,
                children: Vec::new(),
                safe_to_stop: risk == RiskLevel::Safe,
                risk_level: risk,
                detection_method,
            });
        }
    }
    services
}

fn extract_name(cmdline: &str, exe: &str) -> String {
    if let Some(pos) = cmdline.rfind('\\') {
        let filename = &cmdline[pos + 1..];
        if !filename.is_empty() {
            return filename.to_string();
        }
    }
    if let Some(pos) = exe.rfind('\\') {
        return exe[pos + 1..].to_string();
    }
    if let Some(pos) = exe.rfind('/') {
        return exe[pos + 1..].to_string();
    }
    exe.to_string()
}
