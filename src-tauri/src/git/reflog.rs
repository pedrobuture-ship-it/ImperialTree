use super::{Git, GitError};
use crate::security::refs::sanitize_output;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReflogEntry {
    pub hash: String,
    pub short: String,
    pub selector: String,
    pub timestamp: i64,
    /// First word of the reflog message: commit, checkout, reset, merge, rebase...
    pub action: String,
    pub message: String,
}

pub fn parse_reflog(raw: &str) -> Vec<ReflogEntry> {
    raw.lines()
        .filter_map(|l| {
            let f: Vec<&str> = l.splitn(5, '\x1f').collect();
            if f.len() < 5 {
                return None;
            }
            let msg = sanitize_output(f[4]);
            let action = msg.split([':', ' ']).next().unwrap_or("").to_string();
            Some(ReflogEntry { hash: f[0].into(), short: f[1].into(), selector: f[2].into(), timestamp: f[3].parse().unwrap_or(0), action, message: msg })
        })
        .collect()
}

pub fn reflog(git: &Git, limit: u32) -> Result<Vec<ReflogEntry>, GitError> {
    let n = format!("--max-count={}", limit.clamp(1, 1000));
    let out = git.probe(&["reflog", "show", "--format=%H%x1f%h%x1f%gd%x1f%at%x1f%gs", &n, "HEAD"])?;
    if out.code != 0 {
        return Ok(Vec::new());
    }
    Ok(parse_reflog(&out.text()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::testutil::*;

    #[test]
    fn entries_have_actions() {
        let (_d, g) = init_repo();
        write(&g, "a", "1");
        commit_all(&g, "init");
        g.run(&["switch", "-c", "feature"]).unwrap();
        let e = reflog(&g, 50).unwrap();
        assert_eq!(e[0].action, "checkout");
        assert!(e.iter().any(|x| x.action == "commit"));
        assert_eq!(e[0].selector, "HEAD@{0}");
    }
}
