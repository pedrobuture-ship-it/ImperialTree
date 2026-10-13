use super::{branch::check_name, runner::Executed, Git, GitError};
use crate::security::refs::{sanitize_output, validate_arg};
use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub name: String,
    pub annotated: bool,
    pub commit: String,
    pub timestamp: i64,
    pub message: String,
}

pub fn parse_tags(raw: &str) -> Vec<Tag> {
    raw.lines()
        .filter_map(|l| {
            let f: Vec<&str> = l.splitn(6, '\x1f').collect();
            if f.len() < 6 {
                return None;
            }
            let annotated = f[1] == "tag";
            let commit = if annotated && !f[3].is_empty() { f[3] } else { f[2] };
            Some(Tag { name: sanitize_output(f[0]), annotated, commit: commit.into(), timestamp: f[4].parse().unwrap_or(0), message: sanitize_output(f[5]) })
        })
        .collect()
}

pub fn list(git: &Git) -> Result<Vec<Tag>, GitError> {
    let fmt = "--format=%(refname:short)%1f%(objecttype)%1f%(objectname:short)%1f%(*objectname:short)%1f%(creatordate:unix)%1f%(contents:subject)";
    Ok(parse_tags(&git.text(&["for-each-ref", fmt, "--sort=-creatordate", "refs/tags"])?))
}

pub fn create(git: &Git, name: &str, target: Option<&str>, message: Option<&str>) -> Result<Executed, GitError> {
    check_name(git, name)?;
    let mut args = vec!["tag"];
    if let Some(m) = message.filter(|m| !m.trim().is_empty()) {
        args.extend(["-a", "-m", m.trim()]);
    }
    args.push(name);
    if let Some(t) = target.filter(|t| !t.is_empty()) {
        validate_arg(t, "target")?;
        args.push(t);
    }
    Ok(git.run(&args)?.executed())
}

pub fn delete(git: &Git, name: &str) -> Result<Executed, GitError> {
    validate_arg(name, "tag")?;
    Ok(git.run(&["tag", "-d", name])?.executed())
}

pub fn push(git: &Git, remote: &str, name: &str) -> Result<Executed, GitError> {
    validate_arg(remote, "remote")?;
    validate_arg(name, "tag")?;
    Ok(git.run_with(&["push", remote, "--", &format!("refs/tags/{name}")], None, super::runner::NETWORK_TIMEOUT)?.executed())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::testutil::*;

    #[test]
    fn lightweight_and_annotated() {
        let (_d, g) = init_repo();
        write(&g, "a", "1");
        commit_all(&g, "init");
        create(&g, "v0.1", None, None).unwrap();
        create(&g, "v0.2", None, Some("release 0.2")).unwrap();
        let tags = list(&g).unwrap();
        let light = tags.iter().find(|t| t.name == "v0.1").unwrap();
        let ann = tags.iter().find(|t| t.name == "v0.2").unwrap();
        assert!(!light.annotated && ann.annotated);
        assert_eq!(light.commit, ann.commit);
        delete(&g, "v0.1").unwrap();
        assert!(create(&g, "bad tag", None, None).is_err());
    }
}
