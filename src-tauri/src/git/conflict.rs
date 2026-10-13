use super::{runner::Executed, Git, GitError};
use crate::security::paths::{safe_join, validate_relative};
use serde::Serialize;

#[derive(Debug, Serialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFile {
    pub path: String,
    pub base: Option<String>,
    pub ours: Option<String>,
    pub theirs: Option<String>,
    /// Current working tree content, including conflict markers.
    pub merged: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Operation {
    None,
    Merge,
    Rebase,
    CherryPick,
    Revert,
}

pub fn operation(git: &Git) -> Result<Operation, GitError> {
    let dir = git.text(&["rev-parse", "--path-format=absolute", "--git-dir"])?;
    let dir = std::path::PathBuf::from(dir.trim());
    let has = |n: &str| dir.join(n).exists();
    Ok(if has("rebase-merge") || has("rebase-apply") {
        Operation::Rebase
    } else if has("MERGE_HEAD") {
        Operation::Merge
    } else if has("CHERRY_PICK_HEAD") {
        Operation::CherryPick
    } else if has("REVERT_HEAD") {
        Operation::Revert
    } else {
        Operation::None
    })
}

fn stage_blob(git: &Git, stage: u8, path: &str) -> Option<String> {
    let spec = format!(":{stage}:{path}");
    let out = git.probe(&["show", &spec]).ok()?;
    (out.code == 0).then(|| out.text())
}

pub fn read(git: &Git, path: &str) -> Result<ConflictFile, GitError> {
    let abs = safe_join(git.root(), path)?;
    let merged = std::fs::read_to_string(&abs).map_err(|e| GitError::io(format!("cannot read {path}: {e}")))?;
    Ok(ConflictFile { path: path.into(), base: stage_blob(git, 1, path), ours: stage_blob(git, 2, path), theirs: stage_blob(git, 3, path), merged })
}

pub fn write_result(git: &Git, path: &str, content: &str) -> Result<(), GitError> {
    let abs = safe_join(git.root(), path)?;
    if abs.is_dir() {
        return Err(GitError::invalid("target is a directory"));
    }
    std::fs::write(&abs, content).map_err(|e| GitError::io(format!("cannot write {path}: {e}")))
}

pub fn mark_resolved(git: &Git, path: &str) -> Result<Executed, GitError> {
    validate_relative(path)?;
    Ok(git.run(&["add", "--", path])?.executed())
}

pub fn continue_operation(git: &Git) -> Result<Executed, GitError> {
    match operation(git)? {
        Operation::Rebase => {
            let out = git.exec_env(&["rebase", "--continue"], None, super::runner::DEFAULT_TIMEOUT, &super::rebase::continue_env(git))?;
            let still = operation(git)? == Operation::Rebase;
            if out.code != 0 && !still {
                return Err(git.run(&["rebase", "--continue"]).err().unwrap_or_else(|| GitError::invalid("rebase failed")));
            }
            if !still {
                super::rebase::cleanup(git);
            }
            Ok(out.executed())
        }
        Operation::Merge => Ok(git.run(&["commit", "--no-edit"])?.executed()),
        Operation::CherryPick => Ok(git.run(&["cherry-pick", "--continue"])?.executed()),
        Operation::Revert => Ok(git.run(&["revert", "--continue"])?.executed()),
        Operation::None => Err(GitError::invalid("No operation is in progress.")),
    }
}

pub fn abort_operation(git: &Git) -> Result<Executed, GitError> {
    let args: &[&str] = match operation(git)? {
        Operation::Rebase => &["rebase", "--abort"],
        Operation::Merge => &["merge", "--abort"],
        Operation::CherryPick => &["cherry-pick", "--abort"],
        Operation::Revert => &["revert", "--abort"],
        Operation::None => return Err(GitError::invalid("No operation is in progress.")),
    };
    Ok(git.run(args)?.executed())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::{runner::testutil::*, status::status};

    fn conflicted() -> (tempfile::TempDir, Git) {
        let (d, g) = init_repo();
        write(&g, "f.txt", "base\n");
        commit_all(&g, "base");
        g.run(&["switch", "-c", "other"]).unwrap();
        write(&g, "f.txt", "theirs\n");
        commit_all(&g, "theirs");
        g.run(&["switch", "main"]).unwrap();
        write(&g, "f.txt", "ours\n");
        commit_all(&g, "ours");
        assert!(g.run(&["merge", "--no-edit", "other"]).is_err());
        (d, g)
    }

    #[test]
    fn detects_reads_resolves_and_continues() {
        let (_d, g) = conflicted();
        assert_eq!(operation(&g).unwrap(), Operation::Merge);
        assert!(status(&g).unwrap().entries.iter().any(|e| e.conflicted));
        let c = read(&g, "f.txt").unwrap();
        assert_eq!((c.base.as_deref(), c.ours.as_deref(), c.theirs.as_deref()), (Some("base\n"), Some("ours\n"), Some("theirs\n")));
        assert!(c.merged.contains("<<<<<<<"));
        write_result(&g, "f.txt", "ours\ntheirs\n").unwrap();
        mark_resolved(&g, "f.txt").unwrap();
        continue_operation(&g).unwrap();
        assert_eq!(operation(&g).unwrap(), Operation::None);
    }

    #[test]
    fn abort_restores_state() {
        let (_d, g) = conflicted();
        abort_operation(&g).unwrap();
        assert_eq!(std::fs::read_to_string(g.root().join("f.txt")).unwrap(), "ours\n");
        assert!(read(&g, "../x").is_err());
    }
}
