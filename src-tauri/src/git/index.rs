//! Staging area operations on whole files.

use super::{runner::Executed, Git, GitError};
use crate::security::paths::validate_relative;

fn run_paths(git: &Git, head: &[&str], paths: &[String]) -> Result<Executed, GitError> {
    if paths.is_empty() {
        return Err(GitError::invalid("no paths given"));
    }
    for p in paths {
        validate_relative(p)?;
    }
    let mut args: Vec<&str> = head.to_vec();
    args.push("--");
    args.extend(paths.iter().map(String::as_str));
    Ok(git.run(&args)?.executed())
}

pub fn stage(git: &Git, paths: &[String]) -> Result<Executed, GitError> {
    run_paths(git, &["add"], paths)
}

fn has_head(git: &Git) -> Result<bool, GitError> {
    Ok(git.probe(&["rev-parse", "--verify", "-q", "HEAD"])?.code == 0)
}

pub fn unstage(git: &Git, paths: &[String]) -> Result<Executed, GitError> {
    if has_head(git)? {
        run_paths(git, &["restore", "--staged"], paths)
    } else {
        run_paths(git, &["rm", "--cached", "-r", "-q"], paths)
    }
}

/// Discards tracked changes in the working tree. Destructive.
pub fn discard(git: &Git, paths: &[String]) -> Result<Executed, GitError> {
    run_paths(git, &["restore"], paths)
}

/// Removes untracked files. Destructive.
pub fn clean(git: &Git, paths: &[String]) -> Result<Executed, GitError> {
    run_paths(git, &["clean", "-f"], paths)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::{runner::testutil::*, status::status};

    #[test]
    fn stage_unstage_discard_clean() {
        let (_d, g) = init_repo();
        write(&g, "-dash.txt", "1");
        stage(&g, &["-dash.txt".into()]).unwrap();
        assert_eq!(status(&g).unwrap().entries[0].index, 'A');
        unstage(&g, &["-dash.txt".into()]).unwrap();
        assert!(status(&g).unwrap().entries[0].untracked);
        commit_all(&g, "init");
        write(&g, "-dash.txt", "2");
        discard(&g, &["-dash.txt".into()]).unwrap();
        assert!(status(&g).unwrap().entries.is_empty());
        write(&g, "new.txt", "x");
        clean(&g, &["new.txt".into()]).unwrap();
        assert!(!g.root().join("new.txt").exists());
        assert!(stage(&g, &["../outside".into()]).is_err());
    }
}
