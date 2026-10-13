//! Debounced repository watcher. It reports *that* something relevant changed;
//! the UI then asks Git for the new state once, instead of running
//! `git status` for every filesystem event.

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

const DEBOUNCE: Duration = Duration::from_millis(300);
const MAX_DIRS: usize = 4000;

pub struct Handle {
    stop: mpsc::Sender<()>,
    thread: Option<JoinHandle<()>>,
}

impl Drop for Handle {
    fn drop(&mut self) {
        let _ = self.stop.send(());
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

#[derive(Default, Clone)]
pub struct WatcherState(pub Arc<Mutex<Option<Handle>>>);

/// Decides whether a changed path matters. Anything inside `.git` is ignored
/// except the files that define HEAD, the index, refs and in-progress operations.
pub fn is_relevant(path: &Path, git_dir: &Path) -> bool {
    if let Ok(rel) = path.strip_prefix(git_dir) {
        let s = rel.to_string_lossy();
        if s.ends_with(".lock") {
            return false;
        }
        return matches!(s.as_ref(), "HEAD" | "index" | "packed-refs" | "MERGE_HEAD" | "ORIG_HEAD" | "CHERRY_PICK_HEAD" | "REVERT_HEAD" | "logs/HEAD")
            || s.starts_with("refs/")
            || s.starts_with("rebase-merge")
            || s.starts_with("rebase-apply")
            || s.starts_with("worktrees/");
    }
    true
}

fn tracked_dirs(root: &Path) -> Vec<PathBuf> {
    // Non-ignored directories only: node_modules, target, etc. are skipped by Git's own rules.
    let out = std::process::Command::new("git")
        .args(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
        .current_dir(root)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .output();
    let mut dirs = std::collections::BTreeSet::new();
    dirs.insert(root.to_path_buf());
    if let Ok(o) = out {
        for f in o.stdout.split(|b| *b == 0).filter(|f| !f.is_empty()) {
            let rel = String::from_utf8_lossy(f);
            let mut p = root.join(rel.as_ref());
            while p.pop() && p != root && p.starts_with(root) {
                if !dirs.insert(p.clone()) {
                    break;
                }
            }
            if dirs.len() >= MAX_DIRS {
                break;
            }
        }
    }
    dirs.into_iter().collect()
}

pub fn start(root: PathBuf, git_dir: PathBuf, on_change: impl Fn() + Send + 'static) -> Result<Handle, String> {
    let (tx, rx) = mpsc::channel::<Event>();
    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let mut watcher = RecommendedWatcher::new(
        move |res: notify::Result<Event>| {
            if let Ok(ev) = res {
                let _ = tx.send(ev);
            }
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    for d in tracked_dirs(&root) {
        // Individual failures (permissions, vanished dirs) must not abort watching.
        let _ = watcher.watch(&d, RecursiveMode::NonRecursive);
    }
    watcher.watch(&git_dir, RecursiveMode::Recursive).map_err(|e| e.to_string())?;

    let thread = std::thread::spawn(move || {
        let _keep = watcher;
        let mut pending: Option<Instant> = None;
        loop {
            if stop_rx.try_recv().is_ok() {
                return;
            }
            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(ev) => {
                    let interesting = !matches!(ev.kind, EventKind::Access(_)) && ev.paths.iter().any(|p| is_relevant(p, &git_dir));
                    if interesting && pending.is_none() {
                        pending = Some(Instant::now());
                    }
                }
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => return,
            }
            if let Some(since) = pending {
                // Debounce: wait until events stop arriving for DEBOUNCE.
                if since.elapsed() >= DEBOUNCE {
                    while rx.try_recv().is_ok() {}
                    pending = None;
                    on_change();
                }
            }
        }
    });
    Ok(Handle { stop: stop_tx, thread: Some(thread) })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn git_internals_are_filtered() {
        let g = Path::new("/r/.git");
        assert!(is_relevant(Path::new("/r/.git/HEAD"), g));
        assert!(is_relevant(Path::new("/r/.git/refs/heads/main"), g));
        assert!(is_relevant(Path::new("/r/src/a.rs"), g));
        assert!(!is_relevant(Path::new("/r/.git/index.lock"), g));
        assert!(!is_relevant(Path::new("/r/.git/objects/ab/cdef"), g));
        assert!(!is_relevant(Path::new("/r/.git/FETCH_HEAD"), g));
    }

    #[test]
    fn debounces_bursts_into_one_notification() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        let git_dir = root.join(".git");
        std::fs::create_dir_all(&git_dir).unwrap();
        let count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let c = count.clone();
        let h = start(root.clone(), git_dir, move || {
            c.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        })
        .unwrap();
        for i in 0..20 {
            std::fs::write(root.join(format!("f{i}.txt")), "x").unwrap();
        }
        std::thread::sleep(Duration::from_millis(1200));
        let n = count.load(std::sync::atomic::Ordering::SeqCst);
        drop(h);
        assert!((1..=2).contains(&n), "expected a debounced notification, got {n}");
    }
}
