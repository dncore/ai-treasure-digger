use std::collections::HashMap;
use crate::models::PortBinding;

pub fn scan_ports_with_pid() -> (Vec<PortBinding>, HashMap<u32, Vec<PortBinding>>) {
    let ports = scan_ports_raw();
    let mut pid_map: HashMap<u32, Vec<PortBinding>> = HashMap::new();

    for port in &ports {
        if let Some(pid) = port.owning_pid {
            pid_map.entry(pid).or_default().push(port.clone());
        }
    }

    (ports, pid_map)
}

#[cfg(target_os = "windows")]
fn scan_ports_raw() -> Vec<PortBinding> {
    use windows::Win32::NetworkManagement::IpHelper::{
        GetExtendedTcpTable, MIB_TCPTABLE_OWNER_PID, MIB_TCPROW_OWNER_PID,
        TCP_TABLE_OWNER_PID_ALL,
    };
    use windows::Win32::Foundation::BOOL;

    let mut ports = Vec::new();

    let mut tcp_size: u32 = 0;
    unsafe {
        let _ = GetExtendedTcpTable(
            None, &mut tcp_size, BOOL(0),
            2, // AF_INET
            TCP_TABLE_OWNER_PID_ALL, 0,
        );
    }

    if tcp_size > 0 {
        let mut buffer = vec![0u8; tcp_size as usize];
        unsafe {
            let table = buffer.as_mut_ptr() as *mut MIB_TCPTABLE_OWNER_PID;
            if GetExtendedTcpTable(
                Some(buffer.as_mut_ptr() as *mut _),
                &mut tcp_size,
                BOOL(0),
                2,
                TCP_TABLE_OWNER_PID_ALL,
                0,
            ) == 0
            {
                let count = (*table).dwNumEntries as usize;
                let entries = std::slice::from_raw_parts((*table).table.as_ptr(), count);
                for entry in entries {
                    let local_port = u16::from_be(entry.dwLocalPort as u16);
                    let local_addr = format!(
                        "{}.{}.{}.{}",
                        entry.dwLocalAddr & 0xFF,
                        (entry.dwLocalAddr >> 8) & 0xFF,
                        (entry.dwLocalAddr >> 16) & 0xFF,
                        (entry.dwLocalAddr >> 24) & 0xFF,
                    );
                    ports.push(PortBinding {
                        protocol: "TCP".to_string(),
                        local_addr: format!("{local_addr}:{local_port}"),
                        remote_addr: None,
                        state: format!("{}", entry.dwState),
                        owning_pid: Some(entry.dwOwningPid),
                    });
                }
            }
        }
    }

    ports
}

#[cfg(not(target_os = "windows"))]
fn scan_ports_raw() -> Vec<PortBinding> {
    use std::process::Command;
    let mut ports = Vec::new();
    let output = Command::new("lsof")
        .args(["-i", "-P", "-n"])
        .output();

    if let Ok(output) = output {
        let s = String::from_utf8_lossy(&output.stdout);
        for line in s.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 9 {
                let protocol = if parts.len() > 7 && parts[7].contains("TCP") { "TCP" } else { "UDP" };
                let pid = parts[1].parse::<u32>().ok();
                ports.push(PortBinding {
                    protocol: protocol.to_string(),
                    local_addr: parts[8].to_string(),
                    remote_addr: None,
                    state: "LISTEN".to_string(),
                    owning_pid: pid,
                });
            }
        }
    }
    ports
}

pub fn scan_ports() -> Vec<PortBinding> {
    scan_ports_raw()
}
