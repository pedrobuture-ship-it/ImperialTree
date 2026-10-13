use super::{branch::check_name, runner::Executed, Git, GitError};
use crate::security::refs::{sanitize_output, validate_arg};
use serde::Serialize;

#[derive(Debug, Clone, Serialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Worktree {
    pub path: String,
    pub head: String,
    pub branch: Option<String>,
    pub detached: bool,
    pub bare: bool,
    pub locked: bool,
    pub prunable: bool,
    pub main: bool,
    pub dirty: Option<u32>,
}

pub fn parse_worktrees(raw: &str) -> Vec<Worktree> {
    let mut out: Vec<Worktree> = Vec::new();
    for block in raw.split("\n\n").filter(|b| !b.trim().is_empty()) {
        let mut w = Worktree::default();
        for line in block.lines() {
            let (k, v) = line.split_once(' ').unwrap_or((line, ""));
            match k {
                "worktree" => w.path = sanitize_output(v),
                "HEAD" => w.head = v.chars().take(40).collect(),
                "branch" => w.branch = Some(v.strip_prefix("refs/heads/").unwrap_or(v).to_string()),
                "detached" => w.detached = true,
                "bare" => w.bare = true,
                "locked" => w.locked = true,
                "prunable" => w.prunable = true,
                _ => {}
            }
        }
        out.push(w);
    }
    if let Some(first) = out.first_mut() {
        first.main = true;
    }
    out
}

/// `with_status` runs `git status` inside every worktree, which is costly on big
/// repositories, so only the Worktrees screen asks for it.
pub fn list(git: &Git, with_status: bool) -> Result<Vec<Worktree>, GitError> {
    let mut wts = parse_worktrees(&git.text(&["worktree", "list", "--porcelain"])?);
    for w in &mut wts {
        if !with_status || w.bare || w.prunable {
            continue;
        }
        w.dirty = Git::discover(std::path::Path::new(&w.path))
            .and_then(|g| g.text(&["status", "--porcelain"]))
            .ok()
            .map(|s| s.lines().count() as u32);
    }
    Ok(wts)
}

pub fn add_args(path: &str, branch: &str, create: bool) -> Vec<String> {
    if create {
        vec!["worktree".into(), "add".into(), "-b".into(), branch.into(), path.into()]
    } else {
        vec!["worktree".into(), "add".into(), path.into(), branch.into()]
    }
}

pub fn add(git: &Git, path: &str, branch: &str, create: bool) -> Result<Executed, GitError> {
    validate_arg(branch, "branch")?;
    if path.is_empty() || path.contains('\0') || path.starts_with('-') {
        return Err(GitError::invalid("invalid destination path"));
    }
    if create {
        check_name(git, branch)?;
    }
    let args = add_args(path, branch, create);
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    Ok(git.run(&refs)?.executed())
}

pub fn remove(git: &Git, path: &str, force: bool) -> Result<Executed, GitError> {
    // Only worktrees Git itself lists may be removed, and never the main one.
    let known = list(git, true)?;
    let target = known.iter().find(|w| w.path == path).ok_or_else(|| GitError::invalid("Unknown worktree."))?;
    if target.main {
        return Err(GitError::invalid("The main worktree cannot be removed."));
    }
    let mut args = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push(path);
    Ok(git.run(&args)?.executed())
}

pub fn prune(git: &Git) -> Result<Executed, GitError> {
    Ok(git.run(&["worktree", "prune", "-v"])?.executed())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::testutil::*;

    #[test]
    fn parses_porcelain() {
        let w = parse_worktrees("worktree /a/main\nHEAD abc\nbranch refs/heads/main\n\nworktree /a/wt\nHEAD def\ndetached\nlocked\n");
        assert_eq!(w.len(), 2);
        assert!(w[0].main && w[0].branch.as_deref() == Some("main"));
        assert!(w[1].detached && w[1].locked && !w[1].main);
    }

    #[test]
    fn add_list_remove() {
        let (_d, g) = init_repo();
        write(&g, "a", "1");
        commit_all(&g, "init");
        let parent = tempfile::tempdir().unwrap();
        let dest = parent.path().join("feature-auth");
        let dest = dest.to_str().unwrap();
        let e = add(&g, dest, "feature/auth", true).unwrap();
        assert!(e.command.starts_with("git worktree add -b feature/auth"));
        let l = list(&g, true).unwrap();
        assert_eq!(l.len(), 2);
        assert_eq!(l[1].branch.as_deref(), Some("feature/auth"));
        assert_eq!(l[1].dirty, Some(0));
        assert!(remove(&g, g.root().to_str().unwrap(), false).is_err());
        assert!(remove(&g, "/etc", true).is_err());
        let canon = l[1].path.clone();
        remove(&g, &canon, false).unwrap();
        assert_eq!(list(&g, false).unwrap().len(), 1);
    }
}
