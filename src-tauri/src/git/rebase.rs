//! Interactive rebase driven from the UI. The todo list is generated here from
//! validated commit hashes and handed to Git through a private
//! `GIT_SEQUENCE_EDITOR` script, so no user text is ever executed.

use super::{conflict, log, runner::Executed, Git, GitError};
use crate::security::refs::validate_arg;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoItem {
    pub action: String,
    pub hash: String,
    /// New commit message, only for `reword`.
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RebaseOutcome {
    pub executed: Executed,
    /// `true` when Git stopped (conflict or `edit`) and the rebase is still in progress.
    pub stopped: bool,
    pub todo: String,
}

const ACTIONS: &[&str] = &["pick", "reword", "edit", "squash", "fixup", "drop"];

/// Commits between `base` and HEAD, oldest first, as they appear in the todo list.
pub fn commits_since(git: &Git, base: &str) -> Result<Vec<log::Commit>, GitError> {
    validate_arg(base, "base")?;
    let range = format!("{base}..HEAD");
    let fmt = "--format=%x1e%H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%D%x1f%s";
    let out = git.text(&["log", "--reverse", "--no-merges", fmt, &range])?;
    Ok(log::parse_log(&out, &[]))
}

pub fn build_todo(items: &[TodoItem]) -> Result<String, GitError> {
    if items.is_empty() {
        return Err(GitError::invalid("The rebase todo list is empty."));
    }
    let mut lines = Vec::new();
    for (i, it) in items.iter().enumerate() {
        if !ACTIONS.contains(&it.action.as_str()) {
            return Err(GitError::invalid(format!("unknown rebase action '{}'", it.action)));
        }
        if !(it.hash.len() == 40 || it.hash.len() == 64) || !it.hash.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(GitError::invalid("invalid commit hash in todo list"));
        }
        if i == 0 && matches!(it.action.as_str(), "squash" | "fixup") {
            return Err(GitError::invalid("The first commit cannot be squash or fixup."));
        }
        lines.push(format!("{} {}", it.action, it.hash));
    }
    if items.iter().all(|i| i.action == "drop") {
        return Err(GitError::invalid("Dropping every commit is not supported; use reset instead."));
    }
    Ok(lines.join("\n") + "\n")
}

fn state_dir(git: &Git) -> Result<PathBuf, GitError> {
    let d = git.text(&["rev-parse", "--path-format=absolute", "--git-dir"])?;
    Ok(PathBuf::from(d.trim()).join("imperial-rebase"))
}

fn write_script(path: &std::path::Path, body: &str) -> Result<(), GitError> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::write(path, body).map_err(|e| GitError::io(e.to_string()))?;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700)).map_err(|e| GitError::io(e.to_string()))
}

/// Environment for `rebase --continue` so queued reword messages keep being applied.
pub fn continue_env(git: &Git) -> Vec<(String, String)> {
    match state_dir(git) {
        Ok(d) if d.join("editor.sh").exists() => vec![("GIT_EDITOR".into(), d.join("editor.sh").to_string_lossy().into_owned())],
        _ => vec![("GIT_EDITOR".into(), "true".into())],
    }
}

pub fn cleanup(git: &Git) {
    if let Ok(d) = state_dir(git) {
        let _ = std::fs::remove_dir_all(d);
    }
}

pub fn start(git: &Git, base: &str, items: &[TodoItem]) -> Result<RebaseOutcome, GitError> {
    validate_arg(base, "base")?;
    if conflict::operation(git)? != conflict::Operation::None {
        return Err(GitError::invalid("Another operation is already in progress."));
    }
    let status = super::status::status(git)?;
    if status.entries.iter().any(|e| !e.untracked) {
        return Err(GitError::invalid("Commit or stash your changes before starting a rebase."));
    }
    let allowed: Vec<String> = commits_since(git, base)?.into_iter().map(|c| c.hash).collect();
    for it in items {
        if !allowed.contains(&it.hash) {
            return Err(GitError::invalid("The todo list references a commit outside the selected range."));
        }
    }
    let todo = build_todo(items)?;

    let dir = state_dir(git)?;
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).map_err(|e| GitError::io(e.to_string()))?;
    std::fs::write(dir.join("todo"), &todo).map_err(|e| GitError::io(e.to_string()))?;
    write_script(&dir.join("sequence.sh"), &format!("#!/bin/sh\ncp '{}' \"$1\"\n", dir.join("todo").display()))?;

    let mut n = 0;
    for it in items.iter().filter(|i| i.action == "reword") {
        let msg = it.message.as_deref().unwrap_or("").trim();
        if msg.is_empty() {
            return Err(GitError::invalid("A reworded commit needs a message."));
        }
        let original = git.text(&["show", "-s", "--format=%s", &it.hash])?;
        std::fs::write(dir.join(format!("subject-{n}")), original.trim_end()).map_err(|e| GitError::io(e.to_string()))?;
        std::fs::write(dir.join(format!("msg-{n}")), format!("{msg}\n")).map_err(|e| GitError::io(e.to_string()))?;
        n += 1;
    }
    let editor = format!(
        "#!/bin/sh\nd='{d}'\nfirst=$(head -n1 \"$1\")\nn=$(cat \"$d/counter\" 2>/dev/null || echo 0)\nif [ -f \"$d/subject-$n\" ] && [ \"$(cat \"$d/subject-$n\")\" = \"$first\" ]; then\n  cp \"$d/msg-$n\" \"$1\"\n  echo $((n+1)) > \"$d/counter\"\nfi\n",
        d = dir.display()
    );
    write_script(&dir.join("editor.sh"), &editor)?;

    let env = vec![
        ("GIT_SEQUENCE_EDITOR".to_string(), dir.join("sequence.sh").to_string_lossy().into_owned()),
        ("GIT_EDITOR".to_string(), dir.join("editor.sh").to_string_lossy().into_owned()),
    ];
    let out = git.exec_env(&["rebase", "-i", "--no-autosquash", base], None, super::runner::DEFAULT_TIMEOUT, &env)?;
    let stopped = conflict::operation(git)? == conflict::Operation::Rebase;
    if out.code != 0 && !stopped {
        cleanup(git);
        return Err(GitError { kind: super::error::ErrorKind::Failed, command: out.command.clone(), message: super::error::explain(&out.stderr).unwrap_or("The rebase failed.").to_string(), stderr: crate::security::refs::sanitize_output(&out.stderr), code: Some(out.code) });
    }
    if !stopped {
        cleanup(git);
    }
    Ok(RebaseOutcome { executed: out.executed(), stopped, todo })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::testutil::*;

    fn hashes(g: &Git) -> Vec<String> {
        commits_since(g, "HEAD~3").unwrap().into_iter().map(|c| c.hash).collect()
    }

    fn setup() -> (tempfile::TempDir, Git) {
        let (d, g) = init_repo();
        for (i, f) in ["base", "one", "two", "three"].iter().enumerate() {
            write(&g, &format!("{f}.txt"), &i.to_string());
            commit_all(&g, f);
        }
        (d, g)
    }

    fn item(a: &str, h: &str) -> TodoItem {
        TodoItem { action: a.into(), hash: h.into(), message: None }
    }

    #[test]
    fn todo_validation() {
        let h = "a".repeat(40);
        assert!(build_todo(&[item("squash", &h)]).is_err());
        assert!(build_todo(&[item("pick; rm -rf /", &h)]).is_err());
        assert!(build_todo(&[item("pick", "zzz")]).is_err());
        assert!(build_todo(&[item("drop", &h)]).is_err());
        assert_eq!(build_todo(&[item("pick", &h), item("fixup", &h)]).unwrap(), format!("pick {h}\nfixup {h}\n"));
    }

    #[test]
    fn reorder_squash_reword_and_drop() {
        let (_d, g) = setup();
        let h = hashes(&g); // one, two, three
        let items = vec![
            item("pick", &h[1]),
            TodoItem { action: "reword".into(), hash: h[0].clone(), message: Some("renamed one".into()) },
            item("drop", &h[2]),
        ];
        let out = start(&g, "HEAD~3", &items).unwrap();
        assert!(!out.stopped);
        let subjects = g.text(&["log", "--format=%s"]).unwrap();
        assert_eq!(subjects.lines().collect::<Vec<_>>(), vec!["renamed one", "two", "base"]);
        assert!(!state_dir(&g).unwrap().exists());
    }

    #[test]
    fn squash_combines_commits() {
        let (_d, g) = setup();
        let h = hashes(&g);
        start(&g, "HEAD~3", &[item("pick", &h[0]), item("squash", &h[1]), item("pick", &h[2])]).unwrap();
        assert_eq!(g.text(&["rev-list", "--count", "HEAD"]).unwrap().trim(), "3");
    }

    #[test]
    fn conflicting_rebase_stops_for_resolution() {
        let (_d, g) = init_repo();
        write(&g, "f", "base\n");
        commit_all(&g, "base");
        write(&g, "f", "one\n");
        commit_all(&g, "one");
        write(&g, "f", "two\n");
        commit_all(&g, "two");
        let h: Vec<String> = commits_since(&g, "HEAD~2").unwrap().into_iter().map(|c| c.hash).collect();
        // Reordering two commits that edit the same line conflicts.
        let out = start(&g, "HEAD~2", &[item("pick", &h[1]), item("pick", &h[0])]).unwrap();
        assert!(out.stopped);
        assert_eq!(conflict::operation(&g).unwrap(), conflict::Operation::Rebase);
        conflict::abort_operation(&g).unwrap();
        cleanup(&g);
    }

    #[test]
    fn refuses_dirty_tree() {
        let (_d, g) = setup();
        let h = hashes(&g);
        write(&g, "one.txt", "dirty");
        assert!(start(&g, "HEAD~3", &[item("pick", &h[0])]).is_err());
    }
}
