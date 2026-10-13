use super::{runner::Executed, Git, GitError};
use crate::security::refs::{sanitize_output, validate_arg};
use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Branch {
    pub name: String,
    pub full_name: String,
    pub remote: bool,
    pub current: bool,
    pub hash: String,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub timestamp: i64,
    pub subject: String,
}

const FORMAT: &str = "%(refname)%1f%(refname:short)%1f%(objectname:short)%1f%(upstream:short)%1f%(upstream:track,nobracket)%1f%(HEAD)%1f%(committerdate:unix)%1f%(contents:subject)";

fn parse_track(t: &str) -> (u32, u32) {
    let (mut a, mut b) = (0, 0);
    for part in t.split(',') {
        let part = part.trim();
        if let Some(n) = part.strip_prefix("ahead ") {
            a = n.parse().unwrap_or(0);
        } else if let Some(n) = part.strip_prefix("behind ") {
            b = n.parse().unwrap_or(0);
        }
    }
    (a, b)
}

pub fn parse_branches(raw: &str) -> Vec<Branch> {
    raw.lines()
        .filter_map(|l| {
            let f: Vec<&str> = l.splitn(8, '\x1f').collect();
            if f.len() < 8 {
                return None;
            }
            let remote = f[0].starts_with("refs/remotes/");
            if remote && f[1].ends_with("/HEAD") {
                return None;
            }
            let (ahead, behind) = parse_track(f[4]);
            Some(Branch {
                name: sanitize_output(f[1]),
                full_name: f[0].into(),
                remote,
                current: f[5] == "*",
                hash: f[2].into(),
                upstream: (!f[3].is_empty()).then(|| f[3].to_string()),
                ahead,
                behind,
                timestamp: f[6].parse().unwrap_or(0),
                subject: sanitize_output(f[7]),
            })
        })
        .collect()
}

pub fn list(git: &Git) -> Result<Vec<Branch>, GitError> {
    let fmt = format!("--format={FORMAT}");
    let out = git.text(&["for-each-ref", &fmt, "--sort=-committerdate", "refs/heads", "refs/remotes"])?;
    Ok(parse_branches(&out))
}

/// Validates a branch name with Git itself.
pub fn check_name(git: &Git, name: &str) -> Result<(), GitError> {
    validate_arg(name, "branch name")?;
    let out = git.probe(&["check-ref-format", "--branch", name])?;
    if out.code != 0 {
        return Err(GitError::invalid(format!("'{name}' is not a valid branch name")));
    }
    Ok(())
}

pub fn create_args(name: &str, start: Option<&str>) -> Vec<String> {
    let mut a = vec!["switch".to_string(), "-c".into(), name.into()];
    if let Some(s) = start.filter(|s| !s.is_empty()) {
        a.push(s.into());
    }
    a
}

pub fn create(git: &Git, name: &str, start: Option<&str>) -> Result<Executed, GitError> {
    check_name(git, name)?;
    if let Some(s) = start.filter(|s| !s.is_empty()) {
        validate_arg(s, "start point")?;
    }
    let args = create_args(name, start);
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    Ok(git.run(&refs)?.executed())
}

pub fn checkout(git: &Git, name: &str) -> Result<Executed, GitError> {
    validate_arg(name, "branch")?;
    // `git switch <remote>/<branch>` is rejected for remote refs; use --track / --detach appropriately.
    let remote_branches: Vec<String> = list(git)?.into_iter().filter(|b| b.remote).map(|b| b.name).collect();
    if remote_branches.iter().any(|r| r == name) {
        let local = name.split_once('/').map(|(_, b)| b).unwrap_or(name).to_string();
        return Ok(git.run(&["switch", "--track", name]).or_else(|_| git.run(&["switch", &local]))?.executed());
    }
    Ok(git.run(&["switch", name])?.executed())
}

pub fn checkout_commit(git: &Git, hash: &str) -> Result<Executed, GitError> {
    validate_arg(hash, "commit")?;
    Ok(git.run(&["switch", "--detach", hash])?.executed())
}

pub fn rename(git: &Git, old: &str, new: &str) -> Result<Executed, GitError> {
    validate_arg(old, "branch")?;
    check_name(git, new)?;
    Ok(git.run(&["branch", "-m", old, new])?.executed())
}

pub fn delete(git: &Git, name: &str, force: bool) -> Result<Executed, GitError> {
    validate_arg(name, "branch")?;
    let current = git.text(&["branch", "--show-current"])?;
    if current.trim() == name {
        return Err(GitError::invalid("The current branch cannot be deleted. Switch to another branch first."));
    }
    Ok(git.run(&["branch", if force { "-D" } else { "-d" }, name])?.executed())
}

pub fn merge(git: &Git, name: &str) -> Result<Executed, GitError> {
    validate_arg(name, "branch")?;
    Ok(git.run(&["merge", "--no-edit", name])?.executed())
}

pub fn rebase_onto(git: &Git, name: &str) -> Result<Executed, GitError> {
    validate_arg(name, "branch")?;
    Ok(git.run(&["rebase", name])?.executed())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::testutil::*;

    #[test]
    fn track_parsing() {
        assert_eq!(parse_track("ahead 3, behind 2"), (3, 2));
        assert_eq!(parse_track("behind 1"), (0, 1));
        assert_eq!(parse_track(""), (0, 0));
    }

    #[test]
    fn lifecycle() {
        let (_d, g) = init_repo();
        write(&g, "a", "1");
        commit_all(&g, "init");
        create(&g, "feature/x", None).unwrap();
        let bs = list(&g).unwrap();
        assert!(bs.iter().any(|b| b.name == "feature/x" && b.current));
        assert!(delete(&g, "feature/x", false).is_err(), "current branch cannot be deleted");
        checkout(&g, "main").unwrap();
        rename(&g, "feature/x", "feature/y").unwrap();
        delete(&g, "feature/y", false).unwrap();
        assert_eq!(list(&g).unwrap().len(), 1);
    }

    #[test]
    fn invalid_names_are_rejected() {
        let (_d, g) = init_repo();
        write(&g, "a", "1");
        commit_all(&g, "init");
        assert!(create(&g, "bad name", None).is_err());
        assert!(create(&g, "a..b", None).is_err());
        assert!(create(&g, "--orphan", None).is_err());
        assert!(create(&g, "ok", Some("--detach")).is_err());
    }

    #[test]
    fn create_args_match_git_switch_syntax() {
        assert_eq!(create_args("feature/example", Some("main")).join(" "), "switch -c feature/example main");
    }
}
