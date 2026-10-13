use super::{Git, GitError};
use crate::security::refs::sanitize_output;
use serde::Serialize;

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LargeFile {
    pub path: String,
    pub bytes: u64,
}

#[derive(Debug, Serialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Health {
    pub repo_bytes: u64,
    pub git_bytes: u64,
    pub loose_objects: u64,
    pub packed_objects: u64,
    pub packs: u64,
    pub garbage: u64,
    pub branches: u32,
    pub stale_branches: Vec<String>,
    pub large_files: Vec<LargeFile>,
    pub dangling: u32,
    pub uncommitted: u32,
    pub warnings: Vec<String>,
    pub suggestions: Vec<String>,
}

pub fn parse_count_objects(raw: &str) -> (u64, u64, u64, u64, u64) {
    let (mut loose, mut loose_kb, mut packed, mut packs, mut size_pack_kb, mut garbage) = (0, 0, 0, 0, 0, 0);
    for l in raw.lines() {
        let Some((k, v)) = l.split_once(": ") else { continue };
        let n: u64 = v.trim().parse().unwrap_or(0);
        match k {
            "count" => loose = n,
            "size" => loose_kb = n,
            "in-pack" => packed = n,
            "packs" => packs = n,
            "size-pack" => size_pack_kb = n,
            "garbage" => garbage = n,
            _ => {}
        }
    }
    let _ = garbage;
    ((loose_kb + size_pack_kb) * 1024, loose, packed, packs, garbage)
}

pub fn parse_ls_tree_sizes(raw: &str, min_bytes: u64) -> Vec<LargeFile> {
    let mut v: Vec<LargeFile> = raw
        .split('\0')
        .filter_map(|rec| {
            // <mode> <type> <oid> <size>\t<path>
            let (meta, path) = rec.split_once('\t')?;
            let size: u64 = meta.split_whitespace().nth(3)?.parse().ok()?;
            (size >= min_bytes).then(|| LargeFile { path: sanitize_output(path), bytes: size })
        })
        .collect();
    v.sort_by(|a, b| b.bytes.cmp(&a.bytes));
    v.truncate(25);
    v
}

fn dir_size(path: &std::path::Path) -> u64 {
    let mut total = 0;
    let Ok(rd) = std::fs::read_dir(path) else { return 0 };
    for e in rd.flatten() {
        let Ok(md) = e.metadata() else { continue };
        if md.is_dir() {
            total += dir_size(&e.path());
        } else {
            total += md.len();
        }
    }
    total
}

pub fn analyze(git: &Git) -> Result<Health, GitError> {
    let mut h = Health::default();
    let counts = git.text(&["count-objects", "-v"])?;
    let (git_bytes, loose, packed, packs, garbage) = parse_count_objects(&counts);
    h.git_bytes = git_bytes;
    h.loose_objects = loose;
    h.packed_objects = packed;
    h.packs = packs;
    h.garbage = garbage;

    // `.git` may be a file in linked worktrees; use the common dir for a real size.
    if let Ok(common) = git.text(&["rev-parse", "--path-format=absolute", "--git-common-dir"]) {
        h.git_bytes = dir_size(std::path::Path::new(common.trim())).max(h.git_bytes);
    }
    let git_dir_inside = git.root().join(".git").is_dir();
    let total = dir_size(git.root());
    h.repo_bytes = if git_dir_inside { total } else { total + h.git_bytes };

    let branches = super::branch::list(git)?;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0);
    let local: Vec<_> = branches.iter().filter(|b| !b.remote).collect();
    h.branches = local.len() as u32;
    h.stale_branches = local.iter().filter(|b| !b.current && now - b.timestamp > 90 * 86400).map(|b| b.name.clone()).collect();

    let head_ok = git.probe(&["rev-parse", "--verify", "-q", "HEAD"])?.code == 0;
    if head_ok {
        let tree = git.run(&["ls-tree", "-r", "-l", "-z", "HEAD"])?.text();
        h.large_files = parse_ls_tree_sizes(&tree, 1024 * 1024);
    }

    // fsck walks every object; on huge repositories it can exceed our timeout, which
    // must not make the whole report fail.
    match git.probe(&["fsck", "--no-progress", "--dangling", "--no-reflogs"]) {
        Ok(fsck) => h.dangling = String::from_utf8_lossy(&fsck.stdout).lines().filter(|l| l.starts_with("dangling ")).count() as u32,
        Err(_) => h.warnings.push("Dangling-object check was skipped (git fsck took too long).".into()),
    }
    h.uncommitted = super::status::status(git)?.entries.len() as u32;

    if !h.large_files.is_empty() {
        h.warnings.push(format!("{} tracked file(s) larger than 1 MB.", h.large_files.len()));
        h.suggestions.push("git lfs track \"*.psd\"   # keep big binaries out of the object database".into());
    }
    if !h.stale_branches.is_empty() {
        h.warnings.push(format!("{} local branch(es) have had no commits for 90+ days.", h.stale_branches.len()));
        h.suggestions.push("git branch --merged main   # find branches that can be deleted safely".into());
    }
    if h.loose_objects > 6700 {
        h.warnings.push("Many loose objects; repacking will reclaim space.".into());
        h.suggestions.push("git gc".into());
    }
    if h.dangling > 0 {
        h.warnings.push(format!("{} unreachable object(s) found.", h.dangling));
        h.suggestions.push("git gc --prune=now   # permanently removes unreachable objects".into());
    }
    if h.garbage > 0 {
        h.warnings.push("Garbage files found inside the object database.".into());
        h.suggestions.push("git count-objects -v   # inspect garbage entries".into());
    }
    Ok(h)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::runner::testutil::*;

    #[test]
    fn parses_count_objects() {
        let raw = "count: 12\nsize: 48\nin-pack: 100\npacks: 2\nsize-pack: 952\nprune-packable: 0\ngarbage: 1\nsize-garbage: 4\n";
        let (bytes, loose, packed, packs, garbage) = parse_count_objects(raw);
        assert_eq!((bytes, loose, packed, packs, garbage), (1000 * 1024, 12, 100, 2, 1));
    }

    #[test]
    fn finds_large_files() {
        let raw = "100644 blob abc  5242880\tbig.bin\0100644 blob def      10\tsmall.txt\0";
        let v = parse_ls_tree_sizes(raw, 1024 * 1024);
        assert_eq!(v, vec![LargeFile { path: "big.bin".into(), bytes: 5242880 }]);
    }

    #[test]
    fn analyzes_real_repo_without_modifying_it() {
        let (_d, g) = init_repo();
        write(&g, "big.bin", &"x".repeat(1_500_000));
        commit_all(&g, "add big");
        write(&g, "dirty.txt", "d");
        let before = g.text(&["rev-parse", "HEAD"]).unwrap();
        let h = analyze(&g).unwrap();
        assert_eq!(h.large_files.len(), 1);
        assert_eq!(h.uncommitted, 1);
        assert_eq!(h.branches, 1);
        assert!(h.repo_bytes > 1_000_000);
        assert_eq!(before, g.text(&["rev-parse", "HEAD"]).unwrap());
    }
}
