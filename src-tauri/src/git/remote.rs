use super::{
    runner::{Executed, NETWORK_TIMEOUT},
    Git, GitError,
};
use crate::security::refs::{sanitize_output, validate_arg};
use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Remote {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
}

pub fn parse_remotes(raw: &str) -> Vec<Remote> {
    let mut out: Vec<Remote> = Vec::new();
    for l in raw.lines() {
        let Some((name, rest)) = l.split_once('\t') else { continue };
        let Some((url, kind)) = rest.rsplit_once(' ') else { continue };
        let url = sanitize_output(url);
        if !out.iter().any(|r| r.name == name) {
            out.push(Remote { name: name.into(), ..Default::default() });
        }
        let r = out.iter_mut().find(|r| r.name == name).unwrap();
        match kind {
            "(fetch)" => r.fetch_url = url,
            "(push)" => r.push_url = url,
            _ => {}
        }
    }
    out
}

pub fn list(git: &Git) -> Result<Vec<Remote>, GitError> {
    Ok(parse_remotes(&git.text(&["remote", "-v"])?))
}

fn net(git: &Git, args: &[&str]) -> Result<Executed, GitError> {
    Ok(git.run_with(args, None, NETWORK_TIMEOUT)?.executed())
}

pub fn fetch(git: &Git, remote: &str) -> Result<Executed, GitError> {
    validate_arg(remote, "remote")?;
    net(git, &["fetch", "--prune", remote])
}

pub fn pull(git: &Git, remote: &str, rebase: bool) -> Result<Executed, GitError> {
    validate_arg(remote, "remote")?;
    let mode = if rebase { "--rebase" } else { "--ff-only" };
    net(git, &["pull", mode, remote])
}

pub fn push(git: &Git, remote: &str, branch: &str, set_upstream: bool) -> Result<Executed, GitError> {
    validate_arg(remote, "remote")?;
    validate_arg(branch, "branch")?;
    if set_upstream {
        net(git, &["push", "--set-upstream", remote, branch])
    } else {
        net(git, &["push", remote, branch])
    }
}

pub fn add(git: &Git, name: &str, url: &str) -> Result<Executed, GitError> {
    validate_arg(name, "remote name")?;
    validate_arg(url, "remote URL")?;
    if url.starts_with("ext::") || url.starts_with("fd::") {
        return Err(GitError::invalid("This transport is not allowed."));
    }
    Ok(git.run(&["remote", "add", name, url])?.executed())
}

/// Clones outside of any repository, so it does not need a `Git` handle.
pub fn clone(url: &str, dest: &std::path::Path) -> Result<Executed, GitError> {
    validate_arg(url, "URL")?;
    if url.starts_with("ext::") || url.starts_with("fd::") {
        return Err(GitError::invalid("This transport is not allowed."));
    }
    let parent = dest.parent().filter(|p| p.is_dir()).ok_or_else(|| GitError::invalid("The destination parent folder does not exist."))?;
    let name = dest.file_name().and_then(|n| n.to_str()).ok_or_else(|| GitError::invalid("Invalid destination."))?;
    let runner = super::runner::Git::from_dir_unchecked(parent);
    Ok(runner.run_with(&["clone", "--progress", "--", url, name], None, NETWORK_TIMEOUT)?.executed())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::testutil::*;

    #[test]
    fn parses_remote_verbose() {
        let r = parse_remotes("origin\tgit@github.com:a/b.git (fetch)\norigin\tgit@github.com:a/b.git (push)\nup\thttps://x/y (fetch)\n");
        assert_eq!(r.len(), 2);
        assert_eq!(r[0].push_url, "git@github.com:a/b.git");
        assert_eq!(r[1].push_url, "");
    }

    #[test]
    fn fetch_pull_push_against_local_remote() {
        let bare = tempfile::tempdir().unwrap();
        let (_d, g) = init_repo();
        std::process::Command::new("git").args(["init", "-q", "--bare", "-b", "main"]).arg(bare.path()).status().unwrap();
        write(&g, "a", "1");
        commit_all(&g, "init");
        add(&g, "origin", bare.path().to_str().unwrap()).unwrap();
        push(&g, "origin", "main", true).unwrap();
        fetch(&g, "origin").unwrap();
        pull(&g, "origin", false).unwrap();
        let rs = list(&g).unwrap();
        assert_eq!(rs[0].name, "origin");
    }

    #[test]
    fn clone_rejects_dangerous_inputs() {
        let d = tempfile::tempdir().unwrap();
        assert!(clone("--upload-pack=touch /tmp/x", &d.path().join("c")).is_err());
        assert!(clone("ext::sh -c touch% /tmp/x", &d.path().join("c")).is_err());
    }
}
