use crate::models::soft_match;

pub struct AutostartEntry {
    pub name: String,
    pub command: String,
    pub source: String,
    pub is_ai_related: bool,
}

#[cfg(target_os = "windows")]
pub fn scan_registry_autostart() -> Vec<AutostartEntry> {
    use windows::Win32::System::Registry::{
        RegOpenKeyExW, RegEnumValueW, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, REG_SZ,
    };
    use windows::core::PCWSTR;
    use std::ptr;

    let mut entries = Vec::new();
    let run_paths = [
        (HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", "HKCU Run"),
        (HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run", "HKLM Run"),
    ];

    for (hkey, path, source) in run_paths {
        let path_wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        let mut key_handle = Default::default();
        unsafe {
            if RegOpenKeyExW(hkey, PCWSTR(path_wide.as_ptr()), 0, KEY_READ, &mut key_handle).is_ok() {
                let mut index = 0;
                loop {
                    let mut name_buf = [0u16; 256];
                    let mut name_len = 256u32;
                    let mut data_buf = [0u8; 1024];
                    let mut data_len = 1024u32;
                    let mut data_type = 0u32;

                    let result = RegEnumValueW(
                        key_handle, index, &mut name_buf, &mut name_len as *mut _ as *mut _,
                        ptr::null_mut(), &mut data_type, Some(&mut data_buf), &mut data_len as *mut _ as *mut _,
                    );

                    if result.is_err() { break; }

                    if data_type == REG_SZ as u32 {
                        let name = String::from_utf16_lossy(&name_buf[..name_len as usize]);
                        let data = String::from_utf8_lossy(&data_buf[..data_len as usize]);
                        let is_ai = soft_match(data);

                        entries.push(AutostartEntry {
                            name: name.trim_end_matches('\0').to_string(),
                            command: data.trim_end_matches('\0').to_string(),
                            source: source.to_string(),
                            is_ai_related: is_ai,
                        });
                    }
                    index += 1;
                }
            }
        }
    }
    entries
}

#[cfg(not(target_os = "windows"))]
pub fn scan_registry_autostart() -> Vec<AutostartEntry> {
    Vec::new()
}
