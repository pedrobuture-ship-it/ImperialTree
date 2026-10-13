use super::{Git, GitError};
use crate::security::refs::{sanitize_output, validate_arg};
use serde::{Deserialize, Serialize};

const RS: char = '\x1e';
const US: char = '\x1f';
const FORMAT: &str = "%x1e%H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%D%x1f%s";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    pub hash: String,
    pub short: String,
    pub parents: Vec<String>,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
    pub refs: Vec<RefLabel>,
    pub subject: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RefLabel {
    pub name: String,
    pub kind: RefKind,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RefKind {
    Head,
    Local,
    Remote,
    Tag,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LogQuery {
    pub skip: Option<u32>,
    pub limit: Option<u32>,
    pub search: Option<String>,
    pub author: Option<String>,
    pub branch: Option<String>,
    pub since: Option<String>,
    pub until: Option<String>,
}

fn parse_refs(decor: &str) -> Vec<RefLabel> {
    decor
        .split(", ")
        .filter(|s| !s.is_empty())
        .map(|d| {
            if let Some(rest) = d.strip_prefix("HEAD -> ") {
                RefLabel { name: rest.into(), kind: RefKind::Head }
            } else if d == "HEAD" {
                RefLabel { name: "HEAD".into(), kind: RefKind::Head }
            } else if let Some(t) = d.strip_prefix("tag: ") {
                RefLabel { name: t.into(), kind: RefKind::Tag }
            } else {
                RefLabel { name: d.into(), kind: RefKind::Local }
            }
        })
        .collect()
}

pub fn parse_log(raw: &str, remotes: &[String]) -> Vec<Commit> {
    raw.split(RS)
        .filter(|r| !r.trim().is_empty())
        .filter_map(|rec| {
            let f: Vec<&str> = rec.trim_start_matches('\n').splitn(8, US).collect();
            if f.len() < 8 {
                return None;
            }
            let mut refs = parse_refs(f[6]);
            for r in &mut refs {
                if r.kind == RefKind::Local && remotes.iter().any(|rm| r.name.starts_with(&format!("{rm}/"))) {
                    r.kind = RefKind::Remote;
                }
            }
            Some(Commit {
                hash: f[0].into(),
                short: f[1].into(),
                parents: f[2].split_whitespace().map(String::from).collect(),
                author: sanitize_output(f[3]),
                email: sanitize_output(f[4]),
                timestamp: f[5].parse().unwrap_or(0),
                refs,
                subject: sanitize_output(f[7].trim_end()),
            })
        })
        .collect()
}

pub fn log(git: &Git, q: &LogQuery) -> Result<Vec<Commit>, GitError> {
    let limit = q.limit.unwrap_or(200).clamp(1, 2000);
    let mut args: Vec<String> = vec!["log".into(), format!("--format={FORMAT}"), "--date-order".into(), format!("--max-count={limit}"), format!("--skip={}", q.skip.unwrap_or(0))];
    match q.branch.as_deref().filter(|b| !b.is_empty()) {
        Some("--all") | None => args.push("--all".into()),
        Some(b) => {
            validate_arg(b, "branch")?;
            args.push(b.into());
        }
    }
    if let Some(s) = q.search.as_deref().filter(|s| !s.is_empty()) {
        args.extend(["--regexp-ignore-case".into(), "--fixed-strings".into(), format!("--grep={s}")]);
    }
    if let Some(a) = q.author.as_deref().filter(|s| !s.is_empty()) {
        args.extend(["--regexp-ignore-case".into(), "--fixed-strings".into(), format!("--author={a}")]);
    }
    if let Some(d) = q.since.as_deref().filter(|s| !s.is_empty()) {
        args.push(format!("--since={d}"));
    }
    if let Some(d) = q.until.as_deref().filter(|s| !s.is_empty()) {
        args.push(format!("--until={d}"));
    }
    // An empty repository has no HEAD; `git log` fails with exit 128.
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = git.probe(&refs)?;
    if out.code != 0 {
        if out.stderr.contains("does not have any commits yet") || out.stderr.contains("bad default revision") {
            return Ok(Vec::new());
        }
        return Err(git.run(&refs).err().unwrap_or_else(|| GitError::io("git log failed")));
    }
    let remotes: Vec<String> = git.text(&["remote"])?.lines().map(String::from).collect();
    Ok(parse_log(&out.text(), &remotes))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStat {
    pub path: String,
    pub added: Option<u32>,
    pub removed: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetails {
    pub commit: Commit,
    pub body: String,
    pub branches: Vec<String>,
    pub files: Vec<FileStat>,
    pub insertions: u32,
    pub deletions: u32,
}

pub fn parse_numstat(raw: &str) -> Vec<FileStat> {
    raw.lines()
        .filter_map(|l| {
            let mut p = l.splitn(3, '\t');
            let (a, r, path) = (p.next()?, p.next()?, p.next()?);
            Some(FileStat { path: path.to_string(), added: a.parse().ok(), removed: r.parse().ok() })
        })
        .collect()
}

pub fn commit_details(git: &Git, hash: &str) -> Result<CommitDetails, GitError> {
    validate_arg(hash, "commit")?;
    let fmt = format!("--format={FORMAT}");
    let head = git.text(&["show", "-s", &fmt, hash])?;
    let remotes: Vec<String> = git.text(&["remote"])?.lines().map(String::from).collect();
    let commit = parse_log(&head, &remotes).into_iter().next().ok_or_else(|| GitError::invalid("commit not found"))?;
    let body = sanitize_output(git.text(&["show", "-s", "--format=%b", hash])?.trim());
    let stat = git.text(&["show", "--format=", "--numstat", "--diff-merges=first-parent", hash])?;
    let files = parse_numstat(&stat);
    let insertions = files.iter().filter_map(|f| f.added).sum();
    let deletions = files.iter().filter_map(|f| f.removed).sum();
    let branches = git
        .text(&["branch", "-a", "--contains", hash, "--format=%(refname:short)"])?
        .lines()
        .map(|s| sanitize_output(s.trim()))
        .filter(|s| !s.is_empty() && !s.contains("HEAD detached"))
        .collect();
    Ok(CommitDetails { commit, body, branches, files, insertions, deletions })
}

pub fn commit_diff(git: &Git, hash: &str) -> Result<String, GitError> {
    validate_arg(hash, "commit")?;
    Ok(git.text(&["show", "--format=", "--no-color", "--no-ext-diff", "--no-textconv", "--diff-merges=first-parent", "--find-renames", hash])?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::testutil::*;

    #[test]
    fn decorations_are_classified() {
        let refs = parse_refs("HEAD -> main, tag: v1.0, origin/main, feature/x");
        assert_eq!(refs[0].kind, RefKind::Head);
        assert_eq!(refs[1], RefLabel { name: "v1.0".into(), kind: RefKind::Tag });
        assert_eq!(refs[3].kind, RefKind::Local);
    }

    #[test]
    fn log_roundtrip_with_hostile_subject() {
        let (_d, g) = init_repo();
        write(&g, "a", "1");
        commit_all(&g, "first | with \x1b[31m escapes");
        write(&g, "a", "2");
        commit_all(&g, "second <script>alert(1)</script>");
        let commits = log(&g, &LogQuery::default()).unwrap();
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].subject, "second <script>alert(1)</script>");
        assert!(!commits[1].subject.contains('\x1b'));
        assert_eq!(commits[0].parents.len(), 1);
        let d = commit_details(&g, &commits[0].hash).unwrap();
        assert_eq!((d.insertions, d.deletions), (1, 1));
        assert_eq!(d.branches, vec!["main"]);
    }

    #[test]
    fn filters_and_pagination() {
        let (_d, g) = init_repo();
        for i in 0..5 {
            write(&g, "a", &i.to_string());
            commit_all(&g, &format!("commit number {i}"));
        }
        let q = LogQuery { limit: Some(2), skip: Some(1), ..Default::default() };
        assert_eq!(log(&g, &q).unwrap().len(), 2);
        let q = LogQuery { search: Some("number 3".into()), ..Default::default() };
        assert_eq!(log(&g, &q).unwrap().len(), 1);
        let q = LogQuery { search: Some(".*".into()), ..Default::default() };
        assert_eq!(log(&g, &q).unwrap().len(), 0, "search must be literal");
    }

    #[test]
    fn empty_repo_has_no_commits() {
        let (_d, g) = init_repo();
        assert!(log(&g, &LogQuery::default()).unwrap().is_empty());
    }
}
