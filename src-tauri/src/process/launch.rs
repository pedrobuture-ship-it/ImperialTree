//! Launching external programs (terminals and editors). These are fire and
//! forget; they never share a code path with the Git runner.

use serde::Serialize;
use std::path::Path;
use std::process::{Command, Stdio};

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct Tool {
    pub id: String,
    pub name: String,
}

fn on_path(bin: &str) -> bool {
    std::env::var_os("PATH").is_some_and(|p| std::env::split_paths(&p).any(|d| d.join(bin).is_file()))
}

const TERMINALS: &[(&str, &str)] = &[
    ("alacritty", "Alacritty"),
    ("kitty", "kitty"),
    ("foot", "foot"),
    ("ghostty", "Ghostty"),
    ("wezterm", "WezTerm"),
    ("gnome-terminal", "GNOME Terminal"),
    ("konsole", "Konsole"),
    ("xfce4-terminal", "Xfce Terminal"),
    ("xterm", "xterm"),
];

/// id, display name, binary
const EDITORS: &[(&str, &str, &str)] = &[
    ("code", "VS Code", "code"),
    ("vscodium", "VSCodium", "codium"),
    ("zed", "Zed", "zed"),
    ("nvim", "Neovim", "nvim"),
    ("subl", "Sublime Text", "subl"),
];

pub fn terminals() -> Vec<Tool> {
    TERMINALS.iter().filter(|(b, _)| on_path(b)).map(|(b, n)| Tool { id: (*b).into(), name: (*n).into() }).collect()
}

pub fn editors() -> Vec<Tool> {
    EDITORS.iter().filter(|(_, _, b)| on_path(b)).map(|(i, n, _)| Tool { id: (*i).into(), name: (*n).into() }).collect()
}

fn spawn(mut cmd: Command) -> Result<(), String> {
    cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    let mut child = cmd.spawn().map_err(|e| format!("could not start {:?}: {e}", cmd.get_program()))?;
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

pub fn open_terminal(dir: &Path, preferred: Option<&str>) -> Result<(), String> {
    let available = terminals();
    let env_term = std::env::var("TERMINAL").ok().filter(|t| !t.contains(' ') && on_path(t));
    let bin = preferred
        .and_then(|p| available.iter().find(|t| t.id == p).map(|t| t.id.clone()))
        .or(env_term)
        .or_else(|| available.first().map(|t| t.id.clone()))
        .ok_or("no terminal emulator was found")?;
    let mut cmd = Command::new(&bin);
    match bin.as_str() {
        "gnome-terminal" => {
            cmd.arg("--working-directory").arg(dir);
        }
        "konsole" => {
            cmd.arg("--workdir").arg(dir);
        }
        "xfce4-terminal" => {
            cmd.arg("--working-directory").arg(dir);
        }
        _ => {}
    }
    cmd.current_dir(dir);
    spawn(cmd)
}

pub fn open_editor(id: Option<&str>, repo: &Path, target: &Path, line: Option<u32>) -> Result<(), String> {
    let available = editors();
    let chosen = id.and_then(|i| available.iter().find(|e| e.id == i)).or_else(|| available.first()).ok_or("no supported editor was found")?;
    let bin = EDITORS.iter().find(|(i, _, _)| *i == chosen.id).map(|(_, _, b)| *b).unwrap();
    let loc = line.filter(|l| *l > 0);
    let path_s = target.to_string_lossy().into_owned();
    let mut cmd;
    match chosen.id.as_str() {
        "nvim" => {
            // Neovim needs a terminal to live in.
            let term = terminals().into_iter().next().ok_or("Neovim needs a terminal emulator")?;
            cmd = Command::new(&term.id);
            cmd.arg(if term.id == "gnome-terminal" { "--" } else { "-e" }).arg("nvim");
            if let Some(l) = loc {
                cmd.arg(format!("+{l}"));
            }
            cmd.arg(&path_s);
        }
        "code" | "vscodium" => {
            cmd = Command::new(bin);
            match loc {
                Some(l) => cmd.arg("--goto").arg(format!("{path_s}:{l}")),
                None => cmd.arg(&path_s),
            };
        }
        _ => {
            cmd = Command::new(bin);
            match loc {
                Some(l) => cmd.arg(format!("{path_s}:{l}")),
                None => cmd.arg(&path_s),
            };
        }
    }
    cmd.current_dir(repo);
    spawn(cmd)
}
