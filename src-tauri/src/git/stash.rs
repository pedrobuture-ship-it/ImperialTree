use super::{runner::Executed, Git, GitError};
use crate::security::refs::sanitize_output;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Stash {
    pub index: u32,
    pub name: String,
    pub message: String,
    pub branch: String,
    pub timestamp: i64,
}

pub fn parse_stashes(raw: &str) -> Vec<Stash> {
    raw.lines()
        .filter_map(|l| {
            let f: Vec<&str> = l.splitn(3, '\x1f').collect();
            if f.len() < 3 {
                return None;
            }
            let index: u32 = f[0].strip_prefix("stash@{")?.strip_suffix('}')?.parse().ok()?;
            // Subject looks like "WIP on main: abc123 msg" or "On main: custom message".
            let subject = sanitize_output(f[2]);
            let (branch, message) = subject
                .strip_prefix("WIP on ")
                .or_else(|| subject.strip_prefix("On "))
                .and_then(|r| r.split_once(": "))
                .map(|(b, m)| (b.to_string(), m.to_string()))
                .unwrap_or_else(|| (String::new(), subject.clone()));
            Some(Stash { index, name: f[0].into(), message, branch, timestamp: f[1].parse().unwrap_or(0) })
        })
        .collect()
}

pub fn list(git: &Git) -> Result<Vec<Stash>, GitError> {
    Ok(parse_stashes(&git.text(&["stash", "list", "--format=%gd%x1f%at%x1f%gs"])?))
}

fn validate_stash(name: &str) -> Result<(), GitError> {
    let ok = name.strip_prefix("stash@{").and_then(|r| r.strip_suffix('}')).is_some_and(|n| !n.is_empty() && n.chars().all(|c| c.is_ascii_digit()));
    if ok { Ok(()) } else { Err(GitError::invalid("invalid stash reference")) }
}

pub fn push(git: &Git, message: &str, include_untracked: bool) -> Result<Executed, GitError> {
    let mut args = vec!["stash", "push"];
    if include_untracked {
        args.push("--include-untracked");
    }
    if !message.trim().is_empty() {
        args.extend(["-m", message.trim()]);
    }
    Ok(git.run(&args)?.executed())
}

pub fn apply(git: &Git, name: &str) -> Result<Executed, GitError> {
    validate_stash(name)?;
    Ok(git.run(&["stash", "apply", name])?.executed())
}

pub fn pop(git: &Git, name: &str) -> Result<Executed, GitError> {
    validate_stash(name)?;
    Ok(git.run(&["stash", "pop", name])?.executed())
}

pub fn drop(git: &Git, name: &str) -> Result<Executed, GitError> {
    validate_stash(name)?;
    Ok(git.run(&["stash", "drop", name])?.executed())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::testutil::*;

    #[test]
    fn parses_both_subject_styles() {
        let s = parse_stashes("stash@{0}\x1f100\x1fOn main: WIP: note\nstash@{1}\x1f90\x1fWIP on feature/x: abc123 msg\n");
        assert_eq!((s[0].branch.as_str(), s[0].message.as_str()), ("main", "WIP: note"));
        assert_eq!(s[1].branch, "feature/x");
    }

    #[test]
    fn stash_lifecycle_with_untracked() {
        let (_d, g) = init_repo();
        write(&g, "a", "1");
        commit_all(&g, "init");
        write(&g, "a", "2");
        write(&g, "u.txt", "untracked");
        push(&g, "WIP", true).unwrap();
        assert!(!g.root().join("u.txt").exists());
        let l = list(&g).unwrap();
        assert_eq!(l.len(), 1);
        pop(&g, "stash@{0}").unwrap();
        assert!(g.root().join("u.txt").exists());
        assert!(apply(&g, "stash@{0}").is_err());
        assert!(drop(&g, "--all").is_err());
    }
}
