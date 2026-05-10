use crate::models::ServiceType;

pub fn stop_process(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .output()
            .map_err(|e| format!("Failed to execute taskkill for PID {pid}: {e}"))?;

        if output.status.success() {
            log::info!("taskkill succeeded for PID {pid}");
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            let msg = format!("taskkill failed for PID {pid}: stdout={stdout}, stderr={stderr}");

            // Access denied — suggest admin restart
            if stderr.contains("denied") || stderr.contains("Access is denied") {
                return Err(format!("{msg}\nTry restarting the app as Administrator."));
            }
            Err(msg)
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let status = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .status()
            .map_err(|e| format!("Failed to kill PID {pid}: {e}"))?;

        if status.success() {
            Ok(())
        } else {
            Err(format!("kill -9 failed for PID {pid}"))
        }
    }
}

pub fn stop_docker_container(container_id: &str) -> Result<(), String> {
    use std::process::Command;
    let output = Command::new("docker")
        .args(["stop", container_id])
        .output()
        .map_err(|e| format!("Failed to stop container {container_id}: {e}"))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("docker stop failed for {container_id}: {stderr}"))
    }
}

pub fn stop_wsl_instance(name: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("wsl")
            .args(["--terminate", name])
            .output()
            .map_err(|e| format!("Failed to stop WSL instance {name}: {e}"))?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("wsl --terminate failed for {name}: {stderr}"))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = name;
        Err("WSL is not available on this platform".to_string())
    }
}

pub fn stop_service_by_id(id: &str, service_type: &ServiceType) -> Result<(), String> {
    log::info!("stop_service_by_id: id={id}, type={service_type:?}");
    match service_type {
        ServiceType::NodeProcess | ServiceType::PythonProcess => {
            let pid = id.split(':').nth(1)
                .and_then(|p| p.parse::<u32>().ok())
                .ok_or_else(|| format!("Invalid service ID: {id}"))?;

            let result = stop_process(pid);

            // Verify process is actually gone
            #[cfg(target_os = "windows")]
            {
                use std::process::Command;
                let check = Command::new("tasklist")
                    .args(["/FI", &format!("PID eq {pid}"), "/NH"])
                    .output();
                if let Ok(output) = check {
                    let out = String::from_utf8_lossy(&output.stdout);
                    log::info!("Post-kill check PID {pid}: {out}");
                    if out.contains(&pid.to_string()) && !out.contains("INFO: No tasks") {
                        log::warn!("PID {pid} still alive after taskkill!");
                    }
                }
            }

            result
        }
        ServiceType::DockerContainer => {
            let container_id = id.split(':').nth(1).unwrap_or(id);
            stop_docker_container(container_id)
        }
        ServiceType::WslInstance => {
            let name = id.split(':').nth(1).unwrap_or(id);
            stop_wsl_instance(name)
        }
    }
}
