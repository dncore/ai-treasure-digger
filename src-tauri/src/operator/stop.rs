use crate::models::ServiceType;

pub fn stop_process(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .output()
            .map_err(|e| format!("Failed to stop process {pid}: {e}"))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to stop process {pid}: {e}"))?;
        Ok(())
    }
}

pub fn stop_docker_container(container_id: &str) -> Result<(), String> {
    use std::process::Command;
    Command::new("docker")
        .args(["stop", container_id])
        .output()
        .map_err(|e| format!("Failed to stop container {container_id}: {e}"))?;
    Ok(())
}

pub fn stop_wsl_instance(name: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("wsl")
            .args(["--terminate", name])
            .output()
            .map_err(|e| format!("Failed to stop WSL instance {name}: {e}"))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("WSL is not available on this platform".to_string())
    }
}

pub fn stop_service_by_id(id: &str, service_type: &ServiceType) -> Result<(), String> {
    match service_type {
        ServiceType::NodeProcess | ServiceType::PythonProcess => {
            let pid = id.split(':').nth(1)
                .and_then(|p| p.parse::<u32>().ok())
                .ok_or_else(|| format!("Invalid service ID: {id}"))?;
            stop_process(pid)
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
