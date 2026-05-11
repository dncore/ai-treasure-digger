// Hide the console window on Windows — the app uses WebView2 for UI.
// Console output is still written to log files; toggle visibility from Settings.
#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

fn main() {
    ai_treasure_digger_lib::run()
}
