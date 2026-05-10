pub struct ResourceUsage {
    pub cpu_usage: f32,
    pub memory_usage: u64,
}

#[cfg(target_os = "windows")]
pub fn get_process_resource_usage(pid: u32) -> Option<ResourceUsage> {
    use windows::Win32::System::Threading::OpenProcess;
    use windows::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
    use windows::Win32::System::Threading::{GetProcessTimes, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
    use windows::Win32::Foundation::{FILETIME, CloseHandle};

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid).ok()?;
        let mut counters = PROCESS_MEMORY_COUNTERS::default();
        let _ = GetProcessMemoryInfo(handle, &mut counters, std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32);

        let memory = counters.WorkingSetSize as u64;

        let mut creation = FILETIME::default();
        let mut exit = FILETIME::default();
        let mut kernel = FILETIME::default();
        let mut user = FILETIME::default();
        let _ = GetProcessTimes(handle, &mut creation, &mut exit, &mut kernel, &mut user);

        let _ = CloseHandle(handle);

        // Simplified CPU calculation
        let cpu = 0.0f32;

        Some(ResourceUsage { cpu_usage: cpu, memory_usage: memory })
    }
}

#[cfg(not(target_os = "windows"))]
pub fn get_process_resource_usage(pid: u32) -> Option<ResourceUsage> {
    use std::fs;
    let stat = fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
    let fields: Vec<&str> = stat.split_whitespace().collect();
    if fields.len() < 24 { return None; }
    let utime: u64 = fields[13].parse().ok()?;
    let stime: u64 = fields[14].parse().ok()?;
    let rss: u64 = fields[23].parse().ok().unwrap_or(0);
    Some(ResourceUsage {
        cpu_usage: ((utime + stime) as f32) / 100.0,
        memory_usage: rss * 4096,
    })
}

pub fn calculate_disk_usage(working_dir: &str, targets: &[&str]) -> u64 {
    use std::path::Path;
    let base = Path::new(working_dir);
    if !base.exists() { return 0; }

    let mut total: u64 = 0;
    for target in targets {
        let target_path = base.join(target);
        if target_path.exists() {
            total += dir_size(&target_path);
        }
    }
    total
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
