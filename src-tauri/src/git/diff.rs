use super::{runner::Executed, Git, GitError};
use crate::security::paths::validate_relative;

fn is_binary_or_empty(git: &Git, path: &str) -> bool {
    let full = git.root().join(path);
    std::fs::metadata(full).map(|m| m.len() == 0).unwrap_or(false)
}

/// Returns the unified diff of one file. `staged` selects the index vs HEAD
/// diff; untracked files are diffed against /dev/null.
pub fn file_diff(git: &Git, path: &str, staged: bool, untracked: bool) -> Result<String, GitError> {
    validate_relative(path)?;
    if untracked {
        if is_binary_or_empty(git, path) {
            return Ok(String::new());
        }
        let out = git.run_allow(&["diff", "--no-index", "--no-color", "--", "/dev/null", path], &[1])?;
        return Ok(out.text());
    }
    let mut args = vec!["diff", "--no-color", "--find-renames"];
    if staged {
        args.push("--cached");
    }
    args.extend(["--", path]);
    Ok(git.text(&args)?)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PatchMode {
    Stage,
    Unstage,
    Discard,
}

/// Applies a single-file patch built from one hunk. The patch is fed through
/// stdin; nothing from it is ever interpolated into a command line.
pub fn apply_patch(git: &Git, patch: &str, mode: PatchMode) -> Result<Executed, GitError> {
    if !patch.starts_with("diff --git ") || patch.contains('\0') {
        return Err(GitError::invalid("not a valid single-file patch"));
    }
    if patch.matches("\ndiff --git ").count() > 0 {
        return Err(GitError::invalid("patch must touch exactly one file"));
    }
    let args: &[&str] = match mode {
        PatchMode::Stage => &["apply", "--cached", "--recount", "-"],
        PatchMode::Unstage => &["apply", "--cached", "--reverse", "--recount", "-"],
        PatchMode::Discard => &["apply", "--reverse", "--recount", "-"],
    };
    Ok(git.run_with(args, Some(patch.as_bytes()), super::runner::DEFAULT_TIMEOUT)?.executed())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::testutil::*;

    fn first_hunk_patch(diff: &str) -> String {
        let mut header = String::new();
        let mut hunk = String::new();
        let mut in_hunk = false;
        for l in diff.split_inclusive('\n') {
            if l.starts_with("@@") {
                if in_hunk {
                    break;
                }
                in_hunk = true;
            }
            if in_hunk {
                hunk.push_str(l);
            } else {
                header.push_str(l);
            }
        }
        header + &hunk
    }

    #[test]
    fn stage_and_unstage_a_single_hunk() {
        let (_d, g) = init_repo();
        let base: String = (1..=40).map(|i| format!("line {i}\n")).collect();
        write(&g, "f.txt", &base);
        commit_all(&g, "init");
        let edited = base.replace("line 2\n", "LINE 2\n").replace("line 38\n", "LINE 38\n");
        write(&g, "f.txt", &edited);
        let diff = file_diff(&g, "f.txt", false, false).unwrap();
        assert_eq!(diff.matches("\n@@").count(), 2);
        let patch = first_hunk_patch(&diff);
        apply_patch(&g, &patch, PatchMode::Stage).unwrap();
        let staged = file_diff(&g, "f.txt", true, false).unwrap();
        assert!(staged.contains("+LINE 2") && !staged.contains("LINE 38"));
        let unstaged = file_diff(&g, "f.txt", false, false).unwrap();
        assert!(unstaged.contains("+LINE 38") && !unstaged.contains("+LINE 2\n"));
        apply_patch(&g, &first_hunk_patch(&staged), PatchMode::Unstage).unwrap();
        assert!(file_diff(&g, "f.txt", true, false).unwrap().is_empty());
    }

    #[test]
    fn discard_hunk_reverts_worktree_only() {
        let (_d, g) = init_repo();
        write(&g, "f.txt", "a\nb\nc\n");
        commit_all(&g, "init");
        write(&g, "f.txt", "a\nB\nc\n");
        let patch = first_hunk_patch(&file_diff(&g, "f.txt", false, false).unwrap());
        apply_patch(&g, &patch, PatchMode::Discard).unwrap();
        assert_eq!(std::fs::read_to_string(g.root().join("f.txt")).unwrap(), "a\nb\nc\n");
    }

    #[test]
    fn untracked_file_diff_and_bad_patches() {
        let (_d, g) = init_repo();
        write(&g, "n.txt", "hello\n");
        let d = file_diff(&g, "n.txt", false, true).unwrap();
        assert!(d.contains("+hello"));
        assert!(apply_patch(&g, "rm -rf /", PatchMode::Stage).is_err());
        assert!(file_diff(&g, "../x", false, false).is_err());
    }
}
