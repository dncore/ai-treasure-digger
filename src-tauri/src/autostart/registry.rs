#[allow(unused_imports)]
use crate::models::SERVICE_KEYWORDS;

pub struct AutostartEntry {
    pub name: String,
    pub command: String,
    pub source: String,
    pub is_service_related: bool,
}

#[cfg(target_os = "windows")]
pub fn scan_registry_autostart() -> Vec<AutostartEntry> {
    use windows::Win32::System::Registry::{
        RegOpenKeyExW, RegEnumValueW, RegCloseKey, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE,
        KEY_READ, REG_SZ,
    };
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::ERROR_SUCCESS;

    let mut entries = Vec::new();
    let run_paths = [
        (HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", "HKCU Run"),
        (HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run", "HKLM Run"),
    ];

    for (hkey, path, source) in run_paths {
        let path_wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        let mut key_handle = Default::default();
        unsafe {
            let status = RegOpenKeyExW(hkey, PCWSTR(path_wide.as_ptr()), 0, KEY_READ, &mut key_handle);
            if status != ERROR_SUCCESS { continue; }

            let mut index = 0;
            loop {
                let mut name_buf = [0u16; 256];
                let mut name_len = 256u32;
                let mut data_buf = [0u8; 1024];
                let mut data_len = 1024u32;
                let mut data_type: u32 = 0;

                let result = RegEnumValueW(
                    key_handle,
                    index,
                    PWSTR(name_buf.as_mut_ptr()),
                    &mut name_len,
                    None,
                    Some(&mut data_type as *mut u32),
                    Some(data_buf.as_mut_ptr()),
                    Some(&mut data_len),
                );

                if result != ERROR_SUCCESS { break; }

                if data_type == REG_SZ.0 {
                    let name = String::from_utf16_lossy(&name_buf[..name_len as usize]);
                    let data = String::from_utf8_lossy(&data_buf[..data_len as usize]);
                    let cmd_lower = data.to_lowercase();
                    let is_related = SERVICE_KEYWORDS.iter().any(|kw| cmd_lower.contains(kw));

                    entries.push(AutostartEntry {
                        name: name.trim_end_matches('\0').to_string(),
                        command: data.trim_end_matches('\0').to_string(),
                        source: source.to_string(),
                        is_service_related: is_related,
                    });
                }
                index += 1;
            }

            let _ = RegCloseKey(key_handle);
        }
    }
    entries
}

#[cfg(not(target_os = "windows"))]
pub fn scan_registry_autostart() -> Vec<AutostartEntry> {
    Vec::new()
}
