//! Tiny local persistence for UI state (recent repositories, preferences).
//! Everything stays on disk under the user's config directory.

use std::path::PathBuf;

const MAX_BYTES: usize = 512 * 1024;

fn state_path() -> Result<PathBuf, String> {
    let base = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))
        .ok_or("cannot locate the config directory")?;
    Ok(base.join("imperial-terminal").join("state.json"))
}

pub fn load() -> Result<String, String> {
    match std::fs::read_to_string(state_path()?) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok("{}".into()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn save(json: &str) -> Result<(), String> {
    if json.len() > MAX_BYTES {
        return Err("state is too large".into());
    }
    serde_json::from_str::<serde_json::Value>(json).map_err(|e| format!("invalid state: {e}"))?;
    let path = state_path()?;
    std::fs::create_dir_all(path.parent().ok_or("bad path")?).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}
