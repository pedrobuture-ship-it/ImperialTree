use super::error::{explain, ErrorKind, GitError};
use crate::process::{self, SpawnError, Spec};
use crate::security::refs::sanitize_output;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Duration;

pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);
pub const NETWORK_TIMEOUT: Duration = Duration::from_secs(180);

/// Result of a Git invocation, including the command line as the user would
/// type it so the UI can always show the real Git.
#[derive(Debug, Clone, Serialize)]
pub struct Executed {
    pub command: String,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug)]
pub struct Output {
    pub command: String,
    pub stdout: Vec<u8>,
    pub stderr: String,
    pub code: i32,
}

impl Output {
    pub fn text(&self) -> String {
        String::from_utf8_lossy(&self.stdout).into_owned()
    }
    pub fn executed(self) -> Executed {
        Executed { command: self.command, stdout: sanitize_output(&String::from_utf8_lossy(&self.stdout)), stderr: sanitize_output(&self.stderr) }
    }
}

#[derive(Clone)]
pub struct Git {
    root: PathBuf,
}

/// Quotes arguments for *display only*; the process never goes through a shell.
pub fn display_command(args: &[String]) -> String {
    let mut parts = vec!["git".to_string()];
    for a in args {
        let plain = !a.is_empty() && a.chars().all(|c| c.is_ascii_alphanumeric() || "-_./@:=,+%{}~^".contains(c));
        if plain {
            parts.push(a.clone());
        } else {
            parts.push(format!("\"{}\"", a.replace('\\', "\\\\").replace('"', "\\\"")));
        }
    }
    parts.join(" ")
}

impl Git {
    /// Resolves the top level of the repository that contains `path`.
    pub fn discover(path: &Path) -> Result<Git, GitError> {
        if !path.is_dir() {
            return Err(GitError::invalid(format!("{} is not a directory", path.display())));
        }
        let probe = Git { root: path.to_path_buf() };
        let out = probe.exec_raw(&["rev-parse", "--show-toplevel"], None, DEFAULT_TIMEOUT)?;
        if out.code != 0 {
            let mut err = probe.error_from(&out);
            err.kind = ErrorKind::NotARepository;
            err.message = "This folder is not a Git repository.".into();
            return Err(err);
        }
        let top = out.text().trim().to_string();
        let root = PathBuf::from(top).canonicalize().map_err(|e| GitError::io(e.to_string()))?;
        Ok(Git { root })
    }

    /// A handle for commands that run before a repository exists (clone).
    pub fn from_dir_unchecked(dir: &Path) -> Git {
        Git { root: dir.to_path_buf() }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    fn base_env() -> Vec<(String, String)> {
        vec![
            ("GIT_TERMINAL_PROMPT".into(), "0".into()),
            // Read-only commands must not rewrite the index, otherwise the file
            // watcher would see our own `git status` as a change.
            ("GIT_OPTIONAL_LOCKS".into(), "0".into()),
            ("LC_ALL".into(), "C".into()),
            ("GIT_PAGER".into(), "cat".into()),
            ("GIT_EDITOR".into(), "true".into()),
        ]
    }

    fn exec_raw(&self, args: &[&str], stdin: Option<&[u8]>, timeout: Duration) -> Result<Output, GitError> {
        self.exec_env(args, stdin, timeout, &[])
    }

    pub fn exec_env(&self, args: &[&str], stdin: Option<&[u8]>, timeout: Duration, extra_env: &[(String, String)]) -> Result<Output, GitError> {
        let owned: Vec<String> = args.iter().map(|s| s.to_string()).collect();
        let command = display_command(&owned);
        // Repository config is untrusted: never let it start a filesystem monitor
        // or an external diff tool just because we ran `git status` or `git diff`.
        let mut owned = owned;
        owned.splice(0..0, ["-c".to_string(), "core.fsmonitor=false".to_string()]);
        let mut env = Self::base_env();
        env.extend_from_slice(extra_env);
        let spec = Spec { program: "git", args: &owned, cwd: &self.root, env: &env, stdin, timeout };
        match process::run(&spec) {
            Ok(raw) => Ok(Output { command, stdout: raw.stdout, stderr: String::from_utf8_lossy(&raw.stderr).into_owned(), code: raw.code }),
            Err(SpawnError::NotFound) => Err(GitError {
                kind: ErrorKind::GitNotFound,
                command,
                message: "The `git` executable was not found in PATH.".into(),
                stderr: String::new(),
                code: None,
            }),
            Err(SpawnError::Timeout) => Err(GitError {
                kind: ErrorKind::Timeout,
                command,
                message: format!("Git did not finish within {} seconds.", timeout.as_secs()),
                stderr: String::new(),
                code: None,
            }),
            Err(SpawnError::Io(e)) => Err(GitError { kind: ErrorKind::Io, command, message: e, stderr: String::new(), code: None }),
        }
    }

    fn error_from(&self, out: &Output) -> GitError {
        let stderr = sanitize_output(out.stderr.trim());
        let message = explain(&stderr)
            .map(str::to_string)
            .or_else(|| stderr.lines().rev().find(|l| !l.trim().is_empty()).map(|l| l.trim().to_string()))
            .unwrap_or_else(|| format!("Git exited with status {}", out.code));
        GitError { kind: ErrorKind::Failed, command: out.command.clone(), message, stderr, code: Some(out.code) }
    }

    /// Runs Git and fails on any non-zero exit status.
    pub fn run(&self, args: &[&str]) -> Result<Output, GitError> {
        self.run_with(args, None, DEFAULT_TIMEOUT)
    }

    pub fn run_with(&self, args: &[&str], stdin: Option<&[u8]>, timeout: Duration) -> Result<Output, GitError> {
        let out = self.exec_raw(args, stdin, timeout)?;
        if out.code != 0 {
            return Err(self.error_from(&out));
        }
        Ok(out)
    }

    /// Like `run` but accepts the listed non-zero exit codes (e.g. `diff --no-index` returns 1).
    pub fn run_allow(&self, args: &[&str], ok_codes: &[i32]) -> Result<Output, GitError> {
        let out = self.exec_raw(args, None, DEFAULT_TIMEOUT)?;
        if out.code != 0 && !ok_codes.contains(&out.code) {
            return Err(self.error_from(&out));
        }
        Ok(out)
    }

    /// Never fails on exit code; used for probes such as `git config --get`.
    pub fn probe(&self, args: &[&str]) -> Result<Output, GitError> {
        self.exec_raw(args, None, DEFAULT_TIMEOUT)
    }

    pub fn text(&self, args: &[&str]) -> Result<String, GitError> {
        Ok(self.run(args)?.text())
    }
}

#[cfg(test)]
pub mod testutil {
    use super::*;
    use tempfile::TempDir;

    pub fn init_repo() -> (TempDir, Git) {
        let dir = tempfile::tempdir().unwrap();
        let g = Git { root: dir.path().canonicalize().unwrap() };
        g.run(&["init", "-q", "-b", "main"]).unwrap();
        g.run(&["config", "user.name", "Test"]).unwrap();
        g.run(&["config", "user.email", "test@example.com"]).unwrap();
        g.run(&["config", "commit.gpgsign", "false"]).unwrap();
        (dir, g)
    }

    pub fn write(g: &Git, rel: &str, content: &str) {
        let p = g.root().join(rel);
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(p, content).unwrap();
    }

    pub fn commit_all(g: &Git, msg: &str) {
        g.run(&["add", "-A"]).unwrap();
        g.run(&["commit", "-q", "-m", msg]).unwrap();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_quotes_only_when_needed() {
        let args: Vec<String> = ["commit", "-m", "feat: add x", "--", "a b.txt"].iter().map(|s| s.to_string()).collect();
        assert_eq!(display_command(&args), "git commit -m \"feat: add x\" -- \"a b.txt\"");
    }

    #[test]
    fn args_are_never_shell_interpreted() {
        let (_d, g) = testutil::init_repo();
        testutil::write(&g, "a.txt", "x");
        g.run(&["add", "--", "a.txt"]).unwrap();
        // A hostile message stays a literal commit message.
        g.run(&["commit", "-q", "-m", "$(touch pwned); `touch pwned2`; rm -rf /"]).unwrap();
        assert!(!g.root().join("pwned").exists());
        assert!(!g.root().join("pwned2").exists());
        let subject = g.text(&["log", "-1", "--format=%s"]).unwrap();
        assert!(subject.contains("$(touch pwned)"));
    }

    #[test]
    fn hostile_repo_config_is_not_executed() {
        let (_d, g) = testutil::init_repo();
        testutil::write(&g, "a.txt", "1");
        testutil::commit_all(&g, "init");
        let marker = g.root().join("pwned-fsmonitor");
        g.run(&["config", "core.fsmonitor", &format!("touch {}", marker.display())]).unwrap();
        g.run(&["config", "diff.external", &format!("touch {}", g.root().join("pwned-diff").display())]).unwrap();
        testutil::write(&g, "a.txt", "2");
        let _ = crate::git::status::status(&g).unwrap();
        let _ = crate::git::diff::file_diff(&g, "a.txt", false, false).unwrap();
        assert!(!marker.exists(), "core.fsmonitor must not run");
        assert!(!g.root().join("pwned-diff").exists(), "diff.external must not run");
    }

    #[test]
    fn failure_is_typed_and_keeps_stderr() {
        let (_d, g) = testutil::init_repo();
        let err = g.run(&["checkout", "does-not-exist"]).unwrap_err();
        assert_eq!(err.kind, ErrorKind::Failed);
        assert!(!err.stderr.is_empty());
        assert_eq!(err.command, "git checkout does-not-exist");
    }

    #[test]
    fn discover_rejects_plain_folders() {
        let dir = tempfile::tempdir().unwrap();
        let err = Git::discover(dir.path()).err().expect("not a repo");
        assert_eq!(err.kind, ErrorKind::NotARepository);
    }
}
