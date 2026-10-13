use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ErrorKind {
    GitNotFound,
    NotARepository,
    InvalidInput,
    Timeout,
    Failed,
    Io,
}

/// Typed error returned to the UI. `stderr` is the real, unfiltered (but
/// sanitized) Git output so it can be shown in an expandable area.
#[derive(Debug, Clone, Serialize)]
pub struct GitError {
    pub kind: ErrorKind,
    pub command: String,
    pub message: String,
    pub stderr: String,
    pub code: Option<i32>,
}

impl GitError {
    pub fn invalid(message: impl Into<String>) -> Self {
        GitError { kind: ErrorKind::InvalidInput, command: String::new(), message: message.into(), stderr: String::new(), code: None }
    }

    pub fn io(message: impl Into<String>) -> Self {
        GitError { kind: ErrorKind::Io, command: String::new(), message: message.into(), stderr: String::new(), code: None }
    }
}

impl std::fmt::Display for GitError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl From<String> for GitError {
    fn from(message: String) -> Self {
        GitError::invalid(message)
    }
}

/// Maps well known Git failures to a short, human readable reason.
pub fn explain(stderr: &str) -> Option<&'static str> {
    let s = stderr.to_lowercase();
    let table: &[(&str, &str)] = &[
        ("would be overwritten by merge", "Your local changes would be overwritten by merge."),
        ("would be overwritten by checkout", "Your local changes would be overwritten by checkout."),
        ("please commit your changes or stash them", "You have local changes that must be committed or stashed first."),
        ("automatic merge failed", "Automatic merge failed; fix the conflicts and commit the result."),
        ("could not apply", "A commit could not be applied cleanly; resolve the conflicts to continue."),
        ("not a git repository", "This folder is not a Git repository."),
        ("authentication failed", "Authentication failed. Check your credential helper or SSH key."),
        ("permission denied (publickey)", "SSH authentication failed: the remote rejected your public key."),
        ("could not resolve host", "The remote host could not be resolved. Check your network connection."),
        ("non-fast-forward", "The remote has commits you do not have. Pull (or fetch and rebase) before pushing."),
        ("failed to push some refs", "The push was rejected by the remote."),
        ("no upstream branch", "The current branch has no upstream. Push with --set-upstream."),
        ("has no upstream branch", "The current branch has no upstream. Push with --set-upstream."),
        ("already exists", "The target already exists."),
        ("not fully merged", "The branch is not fully merged. Use force delete only if you are sure."),
        ("nothing to commit", "There is nothing to commit."),
        ("index.lock", "Another Git process is running or left a stale index.lock."),
        ("terminal prompts disabled", "The remote requires credentials; configure a credential helper or use SSH."),
    ];
    table.iter().find(|(needle, _)| s.contains(needle)).map(|(_, reason)| *reason)
}
