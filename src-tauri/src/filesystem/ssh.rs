//! Read-only SSH diagnostics. Private keys are never opened: only `*.pub`
//! files are read, and only when the user asks to copy one.

use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicKey {
    pub file: String,
    pub fingerprint: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshStatus {
    pub dir_exists: bool,
    pub keys: Vec<PublicKey>,
    pub agent_running: bool,
    pub agent_keys: Option<u32>,
}

fn ssh_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".ssh"))
}

pub fn diagnose() -> SshStatus {
    let dir = ssh_dir();
    let dir_exists = dir.as_ref().is_some_and(|d| d.is_dir());
    let mut keys = Vec::new();
    if let (true, Some(d)) = (dir_exists, dir.as_ref()) {
        if let Ok(rd) = std::fs::read_dir(d) {
            for e in rd.flatten() {
                let name = e.file_name().to_string_lossy().into_owned();
                if !name.ends_with(".pub") {
                    continue;
                }
                let fp = Command::new("ssh-keygen").arg("-lf").arg(e.path()).output().ok().filter(|o| o.status.success()).map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string()).unwrap_or_default();
                keys.push(PublicKey { file: name, fingerprint: fp });
            }
        }
    }
    keys.sort_by(|a, b| a.file.cmp(&b.file));
    let agent_running = std::env::var_os("SSH_AUTH_SOCK").is_some();
    let agent_keys = if agent_running {
        Command::new("ssh-add").arg("-l").output().ok().and_then(|o| match o.status.code() {
            Some(0) => Some(String::from_utf8_lossy(&o.stdout).lines().count() as u32),
            Some(1) => Some(0),
            _ => None,
        })
    } else {
        None
    };
    SshStatus { dir_exists, keys, agent_running: agent_running && agent_keys.is_some(), agent_keys }
}

pub fn read_public_key(file: &str) -> Result<String, String> {
    if file.contains('/') || file.contains('\\') || !file.ends_with(".pub") || file.contains('\0') {
        return Err("only public key files inside ~/.ssh can be copied".into());
    }
    let path = ssh_dir().ok_or("no home directory")?.join(file);
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    if content.contains("PRIVATE KEY") {
        return Err("refusing to read a private key".into());
    }
    Ok(content.trim().to_string())
}
