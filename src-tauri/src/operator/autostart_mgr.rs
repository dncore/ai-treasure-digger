use std::path::PathBuf;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct AutostartBackup {
    pub name: String,
    pub source: String,
    pub original_command: String,
}

fn backup_dir() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .unwrap_or_else(|_| PathBuf::from("."));
    exe_dir.parent()
        .unwrap_or_else(|| std::path::Path::new("."))
        .join("data")
        .join("backup")
}

pub fn backup_autostart(name: &str, source: &str, command: &str) -> Result<PathBuf, String> {
    let dir = backup_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create backup dir: {e}"))?;

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let filename = format!("{timestamp}_{name}.json");
    let path = dir.join(&filename);

    let backup = AutostartBackup {
        name: name.to_string(),
        source: source.to_string(),
        original_command: command.to_string(),
    };

    let json = serde_json::to_string_pretty(&backup)
        .map_err(|e| format!("Failed to serialize backup: {e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write backup: {e}"))?;

    Ok(path)
}

pub fn disable_registry_autostart(name: &str, source: &str) -> Result<(), String> {
    let _ = backup_autostart(name, source, "");

    #[cfg(target_os = "windows")]
    {
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::ERROR_SUCCESS;
        use windows::Win32::System::Registry::{
            RegCloseKey, RegDeleteValueW, RegOpenKeyExW, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE,
            KEY_SET_VALUE,
        };

        let (hkey, path) = if source.contains("HKCU") {
            (HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run")
        } else {
            (HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run")
        };

        let path_wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        let mut key_handle = Default::default();

        unsafe {
            let status = RegOpenKeyExW(
                hkey,
                PCWSTR(path_wide.as_ptr()),
                0,
                KEY_SET_VALUE,
                &mut key_handle,
            );
            if status != ERROR_SUCCESS {
                return Err(format!("Failed to open registry key: {status:?}"));
            }

            let name_wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
            let status = RegDeleteValueW(key_handle, PCWSTR(name_wide.as_ptr()));
            RegCloseKey(key_handle);
            if status != ERROR_SUCCESS {
                return Err(format!("Failed to delete registry value: {status:?}"));
            }
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Registry operations not available on this platform".to_string())
    }
}

pub fn restore_autostart(name: &str) -> Result<(), String> {
    let dir = backup_dir();
    let entries = std::fs::read_dir(&dir).map_err(|e| format!("Failed to read backup dir: {e}"))?;

    for entry in entries.flatten() {
        if let Some(filename) = entry.file_name().to_str() {
            if filename.contains(name) {
                let content = std::fs::read_to_string(entry.path())
                    .map_err(|e| format!("Failed to read backup: {e}"))?;
                let backup: AutostartBackup = serde_json::from_str(&content)
                    .map_err(|e| format!("Failed to parse backup: {e}"))?;

                #[cfg(target_os = "windows")]
                {
                    use windows::core::PCWSTR;
                    use windows::Win32::Foundation::ERROR_SUCCESS;
                    use windows::Win32::System::Registry::{
                        RegCloseKey, RegOpenKeyExW, RegSetValueExW, HKEY_CURRENT_USER,
                        HKEY_LOCAL_MACHINE, KEY_SET_VALUE, REG_SZ,
                    };

                    let (hkey, path) = if backup.source.contains("HKCU") {
                        (HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run")
                    } else {
                        (HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run")
                    };

                    let path_wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
                    let mut key_handle = Default::default();

                    unsafe {
                        let status = RegOpenKeyExW(
                            hkey,
                            PCWSTR(path_wide.as_ptr()),
                            0,
                            KEY_SET_VALUE,
                            &mut key_handle,
                        );
                        if status != ERROR_SUCCESS {
                            return Err(format!("Failed to open registry key: {status:?}"));
                        }

                        let name_wide: Vec<u16> = backup.name.encode_utf16().chain(std::iter::once(0)).collect();
                        let data_wide: Vec<u16> = backup.original_command.encode_utf16().chain(std::iter::once(0)).collect();
                        let data_bytes = std::slice::from_raw_parts(
                            data_wide.as_ptr() as *const u8,
                            data_wide.len() * 2,
                        );

                        let status = RegSetValueExW(
                            key_handle,
                            PCWSTR(name_wide.as_ptr()),
                            0,
                            REG_SZ,
                            Some(data_bytes),
                        );
                        RegCloseKey(key_handle);
                        if status != ERROR_SUCCESS {
                            return Err(format!("Failed to set registry value: {status:?}"));
                        }
                    }
                }

                let _ = std::fs::remove_file(entry.path());
                return Ok(());
            }
        }
    }

    Err(format!("No backup found for '{name}'"))
}
