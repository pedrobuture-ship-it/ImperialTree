//! Debug-only UI smoke-test hook. In debug builds, if `IT_AUTOMATION` points
//! to a JavaScript file it is evaluated in the main window after startup. The
//! script reports back with the `debug_report` command; lines starting with
//! `SHOT:` capture this window with `grim` into `IT_REPORT_DIR`.
//! Release builds contain none of this.

#[tauri::command]
pub fn debug_report(text: String) {
    #[cfg(debug_assertions)]
    {
        use std::io::Write;
        let Some(dir) = std::env::var_os("IT_REPORT_DIR").map(std::path::PathBuf::from) else { return };
        if let Some(name) = text.strip_prefix("SHOT:") {
            let safe: String = name.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_').collect();
            // Capture only this app's window so nothing else on screen is recorded.
            let geometry = std::process::Command::new("hyprctl")
                .args(["clients", "-j"])
                .output()
                .ok()
                .and_then(|o| serde_json::from_slice::<serde_json::Value>(&o.stdout).ok())
                .and_then(|v| {
                    v.as_array()?.iter().find(|c| c["class"] == "imperial-terminal").map(|c| {
                        format!("{},{} {}x{}", c["at"][0], c["at"][1], c["size"][0], c["size"][1])
                    })
                });
            if let Some(g) = geometry {
                let _ = std::process::Command::new("grim").args(["-g", &g]).arg(dir.join(format!("{safe}.png"))).status();
            }
        } else if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(dir.join("report.log")) {
            let _ = writeln!(f, "{text}");
        }
    }
    #[cfg(not(debug_assertions))]
    let _ = text;
}

#[cfg(debug_assertions)]
pub fn attach(app: &tauri::App) {
    use tauri::Manager;
    let Some(path) = std::env::var_os("IT_AUTOMATION") else { return };
    let Some(win) = app.get_webview_window("main") else { return };
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(3000));
        if let Ok(script) = std::fs::read_to_string(path) {
            let _ = win.eval(&script);
        }
    });
}
