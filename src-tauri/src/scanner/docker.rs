use crate::models::{DetectedService, RiskLevel, ServiceType};

pub async fn scan_docker() -> Result<Vec<DetectedService>, String> {
    use std::process::Command;
    let output = Command::new("docker")
        .args(["ps", "--format", "{{json .}}"])
        .output()
        .map_err(|e| format!("Docker command failed: {e}"))?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut services = Vec::new();

    for line in stdout.lines() {
        if line.trim().is_empty() { continue; }
        if let Ok(container) = serde_json::from_str::<serde_json::Value>(line) {
            let id = container["ID"].as_str().unwrap_or("unknown").to_string();
            let name = container["Names"].as_str().unwrap_or("unknown").to_string();
            let image = container["Image"].as_str().unwrap_or("unknown").to_string();

            services.push(DetectedService {
                id: format!("DockerContainer:{id}"),
                service_type: ServiceType::DockerContainer,
                name,
                pid: None,
                command_line: image,
                working_dir: String::new(),
                ports: Vec::new(),
                cpu_usage: 0.0,
                memory_usage: 0,
                disk_usage: 0,
                is_autostart: false,
                autostart_source: None,
                children: Vec::new(),
                safe_to_stop: false,
                risk_level: RiskLevel::Critical,
            });
        }
    }
    Ok(services)
}
