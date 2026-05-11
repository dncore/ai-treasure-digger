use std::collections::HashMap;
use std::sync::Mutex;
use std::time::SystemTime;

pub struct ResourceUsage {
    pub cpu_usage: f32,
    pub memory_usage: u64,
}

/// Stores the kernel+user time and timestamp for a PID to compute CPU delta.
struct CpuSample {
    kernel_us: i64,
    #[allow(dead_code)]
    user_us: i64,
    timestamp: SystemTime,
}

/// Global state: previous CPU samples keyed by PID.
static CPU_SAMPLES: once_cell::sync::Lazy<Mutex<HashMap<u32, CpuSample>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(HashMap::new()));

/// Convert FILETIME (100-ns intervals since 1601) to microseconds.
#[cfg(target_os = "windows")]
fn filetime_to_us(ft: windows::Win32::Foundation::FILETIME) -> i64 {
    ((ft.dwHighDateTime as i64) << 32 | ft.dwLowDateTime as i64) / 10
}

#[cfg(target_os = "windows")]
pub fn get_process_resource_usage(pid: u32) -> Option<ResourceUsage> {
    use windows::Win32::System::Threading::OpenProcess;
    use windows::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
    use windows::Win32::System::Threading::{GetProcessTimes, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
    use windows::Win32::Foundation::CloseHandle;

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid).ok()?;

        // Memory
        let mut counters = PROCESS_MEMORY_COUNTERS::default();
        let _ = GetProcessMemoryInfo(handle, &mut counters, std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32);
        let memory = counters.WorkingSetSize as u64;

        // CPU times
        let mut creation = Default::default();
        let mut exit = Default::default();
        let mut kernel = Default::default();
        let mut user = Default::default();
        let times_ok = GetProcessTimes(handle, &mut creation, &mut exit, &mut kernel, &mut user).is_ok();

        let _ = CloseHandle(handle);

        let cpu = if times_ok {
            let kernel_us = filetime_to_us(kernel);
            let user_us = filetime_to_us(user);
            let now = SystemTime::now();

            let mut samples = CPU_SAMPLES.lock().unwrap_or_else(|e| e.into_inner());
            let cpu_pct = if let Some(prev) = samples.get(&pid) {
                let delta_proc_us = (kernel_us - prev.kernel_us) + (user_us - prev.user_us);
                let delta_wall = now.duration_since(prev.timestamp).unwrap_or(std::time::Duration::ZERO);
                let delta_wall_us = delta_wall.as_micros() as i64;
                if delta_wall_us > 0 {
                    (delta_proc_us as f64 / delta_wall_us as f64 * 100.0) as f32
                } else {
                    0.0
                }
            } else {
                0.0 // First sample — no delta yet
            };

            samples.insert(pid, CpuSample { kernel_us, user_us, timestamp: now });
            cpu_pct
        } else {
            0.0
        };

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

    let total_ticks = utime + stime;
    let now = SystemTime::now();

    let mut samples = CPU_SAMPLES.lock().unwrap_or_else(|e| e.into_inner());
    let cpu_pct = if let Some(prev) = samples.get(&pid) {
        let delta = total_ticks as f64 - prev.kernel_us as f64;
        let elapsed = now.duration_since(prev.timestamp).unwrap_or(std::time::Duration::ZERO);
        let elapsed_s = elapsed.as_secs_f64();
        if elapsed_s > 0.0 {
            // Assume 100 Hz tick rate on Linux; CPU% = delta_ticks / (elapsed * clk_tck) * 100
            let clk_tck = 100.0;
            (delta / (elapsed_s * clk_tck) * 100.0) as f32
        } else {
            0.0
        }
    } else {
        0.0
    };

    samples.insert(pid, CpuSample { kernel_us: total_ticks as i64, user_us: 0, timestamp: now });
    Some(ResourceUsage { cpu_usage: cpu_pct, memory_usage: rss * 4096 })
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
