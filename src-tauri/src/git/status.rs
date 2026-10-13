use super::{Git, GitError};
use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub path: String,
    pub orig_path: Option<String>,
    /// Index (staged) status letter, `.` when unchanged.
    pub index: char,
    /// Worktree (unstaged) status letter, `.` when unchanged.
    pub worktree: char,
    pub untracked: bool,
    pub conflicted: bool,
}

#[derive(Debug, Clone, Serialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepoStatus {
    pub branch: Option<String>,
    pub oid: Option<String>,
    pub detached: bool,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub entries: Vec<FileEntry>,
}

pub fn parse_porcelain_v2(raw: &str) -> RepoStatus {
    let mut st = RepoStatus::default();
    let mut fields = raw.split('\0');
    while let Some(rec) = fields.next() {
        if rec.is_empty() {
            continue;
        }
        if let Some(h) = rec.strip_prefix("# ") {
            let mut it = h.splitn(2, ' ');
            match (it.next(), it.next()) {
                (Some("branch.oid"), Some(v)) => st.oid = (v != "(initial)").then(|| v.to_string()),
                (Some("branch.head"), Some(v)) => {
                    if v == "(detached)" {
                        st.detached = true;
                    } else {
                        st.branch = Some(v.to_string());
                    }
                }
                (Some("branch.upstream"), Some(v)) => st.upstream = Some(v.to_string()),
                (Some("branch.ab"), Some(v)) => {
                    for part in v.split(' ') {
                        if let Some(n) = part.strip_prefix('+') {
                            st.ahead = n.parse().unwrap_or(0);
                        } else if let Some(n) = part.strip_prefix('-') {
                            st.behind = n.parse().unwrap_or(0);
                        }
                    }
                }
                _ => {}
            }
            continue;
        }
        let kind = rec.as_bytes()[0];
        match kind {
            b'1' => {
                // 1 XY sub mH mI mW hH hI path
                let parts: Vec<&str> = rec.splitn(9, ' ').collect();
                if parts.len() == 9 {
                    let xy: Vec<char> = parts[1].chars().collect();
                    st.entries.push(FileEntry { path: parts[8].into(), orig_path: None, index: xy[0], worktree: xy[1], untracked: false, conflicted: false });
                }
            }
            b'2' => {
                // 2 XY sub mH mI mW hH hI Xscore path \0 origPath
                let parts: Vec<&str> = rec.splitn(10, ' ').collect();
                let orig = fields.next().map(str::to_string);
                if parts.len() == 10 {
                    let xy: Vec<char> = parts[1].chars().collect();
                    st.entries.push(FileEntry { path: parts[9].into(), orig_path: orig, index: xy[0], worktree: xy[1], untracked: false, conflicted: false });
                }
            }
            b'u' => {
                // u XY sub m1 m2 m3 mW h1 h2 h3 path
                let parts: Vec<&str> = rec.splitn(11, ' ').collect();
                if parts.len() == 11 {
                    let xy: Vec<char> = parts[1].chars().collect();
                    st.entries.push(FileEntry { path: parts[10].into(), orig_path: None, index: xy[0], worktree: xy[1], untracked: false, conflicted: true });
                }
            }
            b'?' => st.entries.push(FileEntry { path: rec[2..].into(), orig_path: None, index: '.', worktree: '?', untracked: true, conflicted: false }),
            _ => {}
        }
    }
    st
}

pub fn status(git: &Git) -> Result<RepoStatus, GitError> {
    let out = git.run(&["status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all"])?;
    Ok(parse_porcelain_v2(&out.text()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::testutil::*;

    #[test]
    fn parses_branch_headers_and_entries() {
        let raw = "# branch.oid abc123\0# branch.head main\0# branch.upstream origin/main\0# branch.ab +3 -1\0\
1 .M N... 100644 100644 100644 aaa bbb src/a b.rs\0\
2 R. N... 100644 100644 100644 aaa bbb R100 new.rs\0old.rs\0\
u UU N... 100644 100644 100644 100644 a b c conflict.rs\0\
? docs/new file.md\0";
        let st = parse_porcelain_v2(raw);
        assert_eq!(st.branch.as_deref(), Some("main"));
        assert_eq!(st.upstream.as_deref(), Some("origin/main"));
        assert_eq!((st.ahead, st.behind), (3, 1));
        assert_eq!(st.entries.len(), 4);
        assert_eq!(st.entries[0].path, "src/a b.rs");
        assert_eq!((st.entries[0].index, st.entries[0].worktree), ('.', 'M'));
        assert_eq!(st.entries[1].orig_path.as_deref(), Some("old.rs"));
        assert!(st.entries[2].conflicted);
        assert!(st.entries[3].untracked);
        assert_eq!(st.entries[3].path, "docs/new file.md");
    }

    #[test]
    fn detached_and_initial() {
        let st = parse_porcelain_v2("# branch.oid (initial)\0# branch.head (detached)\0");
        assert!(st.detached && st.oid.is_none() && st.branch.is_none());
    }

    #[test]
    fn real_repo_status() {
        let (_d, g) = init_repo();
        write(&g, "a.txt", "1\n");
        commit_all(&g, "init");
        write(&g, "a.txt", "2\n");
        write(&g, "weird name \"q\".txt", "x");
        g.run(&["mv", "a.txt", "b.txt"]).unwrap();
        let st = status(&g).unwrap();
        assert_eq!(st.branch.as_deref(), Some("main"));
        assert!(st.entries.iter().any(|e| e.path == "weird name \"q\".txt" && e.untracked));
        assert!(st.entries.iter().any(|e| e.path == "b.txt" && e.orig_path.as_deref() == Some("a.txt")));
    }
}
