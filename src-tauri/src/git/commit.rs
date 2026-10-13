use super::{runner::Executed, Git, GitError};
use serde::Serialize;

#[derive(Debug, Serialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StagedSummary {
    pub files: u32,
    pub added: u32,
    pub removed: u32,
}

pub fn staged_summary(git: &Git) -> Result<StagedSummary, GitError> {
    let out = git.text(&["diff", "--cached", "--numstat"])?;
    let mut s = StagedSummary::default();
    for f in super::log::parse_numstat(&out) {
        s.files += 1;
        s.added += f.added.unwrap_or(0);
        s.removed += f.removed.unwrap_or(0);
    }
    Ok(s)
}

pub fn commit_args(summary: &str, description: &str, amend: bool) -> Vec<String> {
    let mut a = vec!["commit".to_string(), "-m".into(), summary.into()];
    if !description.trim().is_empty() {
        a.extend(["-m".to_string(), description.trim().into()]);
    }
    if amend {
        a.push("--amend".into());
    }
    a
}

pub fn commit(git: &Git, summary: &str, description: &str, amend: bool) -> Result<Executed, GitError> {
    if summary.trim().is_empty() {
        return Err(GitError::invalid("The commit summary cannot be empty."));
    }
    let args = commit_args(summary.trim(), description, amend);
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    Ok(git.run(&refs)?.executed())
}

pub fn cherry_pick(git: &Git, hash: &str) -> Result<Executed, GitError> {
    crate::security::refs::validate_arg(hash, "commit")?;
    Ok(git.run(&["cherry-pick", hash])?.executed())
}

pub fn revert(git: &Git, hash: &str) -> Result<Executed, GitError> {
    crate::security::refs::validate_arg(hash, "commit")?;
    Ok(git.run(&["revert", "--no-edit", hash])?.executed())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::testutil::*;

    #[test]
    fn commit_with_description_and_summary_counts() {
        let (_d, g) = init_repo();
        write(&g, "a.txt", "1\n2\n");
        g.run(&["add", "a.txt"]).unwrap();
        assert_eq!(staged_summary(&g).unwrap(), StagedSummary { files: 1, added: 2, removed: 0 });
        let e = commit(&g, "feat(board): add note", "Body line", false).unwrap();
        assert_eq!(e.command, "git commit -m \"feat(board): add note\" -m \"Body line\"");
        assert_eq!(g.text(&["log", "-1", "--format=%B"]).unwrap().trim(), "feat(board): add note\n\nBody line");
        assert!(commit(&g, "  ", "", false).is_err());
    }

    #[test]
    fn revert_and_cherry_pick() {
        let (_d, g) = init_repo();
        write(&g, "a", "1");
        commit_all(&g, "one");
        write(&g, "a", "2");
        commit_all(&g, "two");
        let hash = g.text(&["rev-parse", "HEAD"]).unwrap().trim().to_string();
        revert(&g, &hash).unwrap();
        assert_eq!(std::fs::read_to_string(g.root().join("a")).unwrap(), "1");
    }
}
