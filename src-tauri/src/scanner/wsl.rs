use crate::models::{DetectedService, DetectionMethod, RiskLevel, ServiceType};

pub fn scan_wsl() -> Result<Vec<DetectedService>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("wsl")
            .args(["--list", "--running", "--verbose"])
            .output()
            .map_err(|e| format!("WSL command failed: {e}"))?;

        if !output.status.success() {
            return Ok(Vec::new());
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut services = Vec::new();

        for line in stdout.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let name = parts[0].to_string();
                let state = parts.get(1).unwrap_or(&"Unknown").to_string();

                if state.contains("Running") {
                    services.push(DetectedService {
                        id: format!("WslInstance:{name}"),
                        service_type: ServiceType::WslInstance,
                        name: name.clone(),
                        pid: None,
                        command_line: format!("wsl -d {name}"),
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
                        detection_method: DetectionMethod::HardMatch,
                    });
                }
            }
        }
        Ok(services)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}
