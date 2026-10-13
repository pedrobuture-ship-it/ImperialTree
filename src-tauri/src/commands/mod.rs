//! Thin Tauri command layer. Every command receives the repository root the
//! UI is working with and resolves it through `AppState`, which only knows
//! repositories that were explicitly opened by the user.

use crate::filesystem::{ssh, store, watcher};
use crate::git::{
    branch, commit, config, conflict, diff, health, index, log, rebase, reflog, remote, stash, status, tag, worktree, Executed, Git, GitError,
};
use crate::process::launch;
use crate::security::paths::safe_join;
use serde::Serialize;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};

#[derive(Default, Clone)]
pub struct AppState {
    open: Arc<Mutex<HashSet<PathBuf>>>,
}

impl AppState {
    fn git(&self, root: &str) -> Result<Git, GitError> {
        let path = PathBuf::from(root);
        let known = self.open.lock().map_err(|_| GitError::io("state poisoned"))?.contains(&path);
        if !known {
            return Err(GitError::invalid("This repository has not been opened."));
        }
        Ok(Git::from_dir_unchecked(&path))
    }
}

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T, GitError> + Send + 'static) -> Result<T, GitError> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| GitError::io(e.to_string()))?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    root: String,
    name: String,
    branch: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Environment {
    git_version: Option<String>,
    os: String,
    app_version: String,
}

#[tauri::command]
pub async fn open_repository(state: State<'_, AppState>, path: String) -> Result<RepoInfo, GitError> {
    let g = blocking(move || Git::discover(std::path::Path::new(&path))).await?;
    let root = g.root().to_path_buf();
    state.open.lock().map_err(|_| GitError::io("state poisoned"))?.insert(root.clone());
    let probe = g.clone();
    let branch = blocking(move || status::status(&probe)).await.ok().and_then(|s| s.branch);
    Ok(RepoInfo { name: root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| root.to_string_lossy().into_owned()), root: root.to_string_lossy().into_owned(), branch })
}

#[tauri::command]
pub async fn clone_repository(url: String, destination: String) -> Result<Executed, GitError> {
    blocking(move || remote::clone(&url, std::path::Path::new(&destination))).await
}

#[tauri::command]
pub async fn repo_status(state: State<'_, AppState>, root: String) -> Result<status::RepoStatus, GitError> {
    let g = state.git(&root)?;
    blocking(move || status::status(&g)).await
}

#[tauri::command]
pub async fn history(state: State<'_, AppState>, root: String, query: log::LogQuery) -> Result<Vec<log::Commit>, GitError> {
    let g = state.git(&root)?;
    blocking(move || log::log(&g, &query)).await
}

#[tauri::command]
pub async fn commit_details(state: State<'_, AppState>, root: String, hash: String) -> Result<log::CommitDetails, GitError> {
    let g = state.git(&root)?;
    blocking(move || log::commit_details(&g, &hash)).await
}

#[tauri::command]
pub async fn commit_diff(state: State<'_, AppState>, root: String, hash: String) -> Result<String, GitError> {
    let g = state.git(&root)?;
    blocking(move || log::commit_diff(&g, &hash)).await
}

#[tauri::command]
pub async fn file_diff(state: State<'_, AppState>, root: String, path: String, staged: bool, untracked: bool) -> Result<String, GitError> {
    let g = state.git(&root)?;
    blocking(move || diff::file_diff(&g, &path, staged, untracked)).await
}

#[tauri::command]
pub async fn apply_patch(state: State<'_, AppState>, root: String, patch: String, mode: diff::PatchMode) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || diff::apply_patch(&g, &patch, mode)).await
}

#[tauri::command]
pub async fn stage_paths(state: State<'_, AppState>, root: String, paths: Vec<String>) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || index::stage(&g, &paths)).await
}

#[tauri::command]
pub async fn unstage_paths(state: State<'_, AppState>, root: String, paths: Vec<String>) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || index::unstage(&g, &paths)).await
}

#[tauri::command]
pub async fn discard_paths(state: State<'_, AppState>, root: String, paths: Vec<String>, untracked: bool) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || if untracked { index::clean(&g, &paths) } else { index::discard(&g, &paths) }).await
}

#[tauri::command]
pub async fn staged_summary(state: State<'_, AppState>, root: String) -> Result<commit::StagedSummary, GitError> {
    let g = state.git(&root)?;
    blocking(move || commit::staged_summary(&g)).await
}

#[tauri::command]
pub async fn create_commit(state: State<'_, AppState>, root: String, summary: String, description: String, amend: bool) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || commit::commit(&g, &summary, &description, amend)).await
}

#[tauri::command]
pub async fn cherry_pick(state: State<'_, AppState>, root: String, hash: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || commit::cherry_pick(&g, &hash)).await
}

#[tauri::command]
pub async fn revert_commit(state: State<'_, AppState>, root: String, hash: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || commit::revert(&g, &hash)).await
}

#[tauri::command]
pub async fn list_branches(state: State<'_, AppState>, root: String) -> Result<Vec<branch::Branch>, GitError> {
    let g = state.git(&root)?;
    blocking(move || branch::list(&g)).await
}

#[tauri::command]
pub async fn create_branch(state: State<'_, AppState>, root: String, name: String, start: Option<String>) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || branch::create(&g, &name, start.as_deref())).await
}

#[tauri::command]
pub async fn validate_branch_name(state: State<'_, AppState>, root: String, name: String) -> Result<(), GitError> {
    let g = state.git(&root)?;
    blocking(move || branch::check_name(&g, &name)).await
}

#[tauri::command]
pub async fn checkout_branch(state: State<'_, AppState>, root: String, name: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || branch::checkout(&g, &name)).await
}

#[tauri::command]
pub async fn checkout_commit(state: State<'_, AppState>, root: String, hash: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || branch::checkout_commit(&g, &hash)).await
}

#[tauri::command]
pub async fn rename_branch(state: State<'_, AppState>, root: String, old: String, new: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || branch::rename(&g, &old, &new)).await
}

#[tauri::command]
pub async fn delete_branch(state: State<'_, AppState>, root: String, name: String, force: bool) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || branch::delete(&g, &name, force)).await
}

#[tauri::command]
pub async fn merge_branch(state: State<'_, AppState>, root: String, name: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || branch::merge(&g, &name)).await
}

#[tauri::command]
pub async fn rebase_onto(state: State<'_, AppState>, root: String, name: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || branch::rebase_onto(&g, &name)).await
}

#[tauri::command]
pub async fn list_remotes(state: State<'_, AppState>, root: String) -> Result<Vec<remote::Remote>, GitError> {
    let g = state.git(&root)?;
    blocking(move || remote::list(&g)).await
}

#[tauri::command]
pub async fn fetch_remote(state: State<'_, AppState>, root: String, remote: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || remote::fetch(&g, &remote)).await
}

#[tauri::command]
pub async fn pull_remote(state: State<'_, AppState>, root: String, remote: String, rebase: bool) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || remote::pull(&g, &remote, rebase)).await
}

#[tauri::command]
pub async fn push_remote(state: State<'_, AppState>, root: String, remote: String, branch: String, set_upstream: bool) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || remote::push(&g, &remote, &branch, set_upstream)).await
}

#[tauri::command]
pub async fn list_stashes(state: State<'_, AppState>, root: String) -> Result<Vec<stash::Stash>, GitError> {
    let g = state.git(&root)?;
    blocking(move || stash::list(&g)).await
}

#[tauri::command]
pub async fn stash_push(state: State<'_, AppState>, root: String, message: String, include_untracked: bool) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || stash::push(&g, &message, include_untracked)).await
}

#[tauri::command]
pub async fn stash_apply(state: State<'_, AppState>, root: String, name: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || stash::apply(&g, &name)).await
}

#[tauri::command]
pub async fn stash_pop(state: State<'_, AppState>, root: String, name: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || stash::pop(&g, &name)).await
}

#[tauri::command]
pub async fn stash_drop(state: State<'_, AppState>, root: String, name: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || stash::drop(&g, &name)).await
}

#[tauri::command]
pub async fn list_tags(state: State<'_, AppState>, root: String) -> Result<Vec<tag::Tag>, GitError> {
    let g = state.git(&root)?;
    blocking(move || tag::list(&g)).await
}

#[tauri::command]
pub async fn create_tag(state: State<'_, AppState>, root: String, name: String, target: Option<String>, message: Option<String>) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || tag::create(&g, &name, target.as_deref(), message.as_deref())).await
}

#[tauri::command]
pub async fn delete_tag(state: State<'_, AppState>, root: String, name: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || tag::delete(&g, &name)).await
}

#[tauri::command]
pub async fn push_tag(state: State<'_, AppState>, root: String, remote: String, name: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || tag::push(&g, &remote, &name)).await
}

#[tauri::command]
pub async fn list_worktrees(state: State<'_, AppState>, root: String, with_status: bool) -> Result<Vec<worktree::Worktree>, GitError> {
    let g = state.git(&root)?;
    blocking(move || worktree::list(&g, with_status)).await
}

#[tauri::command]
pub async fn add_worktree(state: State<'_, AppState>, root: String, path: String, branch: String, create: bool) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || worktree::add(&g, &path, &branch, create)).await
}

#[tauri::command]
pub async fn remove_worktree(state: State<'_, AppState>, root: String, path: String, force: bool) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || worktree::remove(&g, &path, force)).await
}

#[tauri::command]
pub async fn prune_worktrees(state: State<'_, AppState>, root: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || worktree::prune(&g)).await
}

#[tauri::command]
pub async fn reflog_entries(state: State<'_, AppState>, root: String, limit: u32) -> Result<Vec<reflog::ReflogEntry>, GitError> {
    let g = state.git(&root)?;
    blocking(move || reflog::reflog(&g, limit)).await
}

#[tauri::command]
pub async fn rebase_commits(state: State<'_, AppState>, root: String, base: String) -> Result<Vec<log::Commit>, GitError> {
    let g = state.git(&root)?;
    blocking(move || rebase::commits_since(&g, &base)).await
}

#[tauri::command]
pub async fn rebase_start(state: State<'_, AppState>, root: String, base: String, items: Vec<rebase::TodoItem>) -> Result<rebase::RebaseOutcome, GitError> {
    let g = state.git(&root)?;
    blocking(move || rebase::start(&g, &base, &items)).await
}

#[tauri::command]
pub async fn operation_state(state: State<'_, AppState>, root: String) -> Result<conflict::Operation, GitError> {
    let g = state.git(&root)?;
    blocking(move || conflict::operation(&g)).await
}

#[tauri::command]
pub async fn operation_continue(state: State<'_, AppState>, root: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || conflict::continue_operation(&g)).await
}

#[tauri::command]
pub async fn operation_abort(state: State<'_, AppState>, root: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || {
        let r = conflict::abort_operation(&g);
        rebase::cleanup(&g);
        r
    })
    .await
}

#[tauri::command]
pub async fn conflict_read(state: State<'_, AppState>, root: String, path: String) -> Result<conflict::ConflictFile, GitError> {
    let g = state.git(&root)?;
    blocking(move || conflict::read(&g, &path)).await
}

#[tauri::command]
pub async fn conflict_write(state: State<'_, AppState>, root: String, path: String, content: String) -> Result<(), GitError> {
    let g = state.git(&root)?;
    blocking(move || conflict::write_result(&g, &path, &content)).await
}

#[tauri::command]
pub async fn conflict_resolve(state: State<'_, AppState>, root: String, path: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || conflict::mark_resolved(&g, &path)).await
}

#[tauri::command]
pub async fn repository_health(state: State<'_, AppState>, root: String) -> Result<health::Health, GitError> {
    let g = state.git(&root)?;
    blocking(move || health::analyze(&g)).await
}

#[tauri::command]
pub async fn config_get(state: State<'_, AppState>, root: String, keys: Vec<String>) -> Result<Vec<config::ConfigValue>, GitError> {
    let g = state.git(&root)?;
    blocking(move || {
        let refs: Vec<&str> = keys.iter().map(String::as_str).collect();
        config::get(&g, &refs)
    })
    .await
}

#[tauri::command]
pub async fn config_set(state: State<'_, AppState>, root: String, scope: config::Scope, key: String, value: String) -> Result<Executed, GitError> {
    let g = state.git(&root)?;
    blocking(move || config::set(&g, scope, &key, &value)).await
}

#[tauri::command]
pub async fn signing_status(state: State<'_, AppState>, root: String) -> Result<config::SigningStatus, GitError> {
    let g = state.git(&root)?;
    blocking(move || config::signing(&g)).await
}

#[tauri::command]
pub async fn ssh_diagnostics() -> Result<ssh::SshStatus, GitError> {
    blocking(|| Ok(ssh::diagnose())).await
}

#[tauri::command]
pub async fn ssh_public_key(file: String) -> Result<String, GitError> {
    blocking(move || ssh::read_public_key(&file).map_err(GitError::invalid)).await
}

#[tauri::command]
pub async fn environment() -> Result<Environment, GitError> {
    blocking(|| {
        let git_version = std::process::Command::new("git").arg("--version").output().ok().filter(|o| o.status.success()).map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());
        let os = std::fs::read_to_string("/etc/os-release")
            .ok()
            .and_then(|s| s.lines().find_map(|l| l.strip_prefix("PRETTY_NAME=").map(|v| v.trim_matches('"').to_string())))
            .unwrap_or_else(|| std::env::consts::OS.to_string());
        Ok(Environment { git_version, os, app_version: env!("CARGO_PKG_VERSION").into() })
    })
    .await
}

#[tauri::command]
pub async fn list_terminals() -> Vec<launch::Tool> {
    launch::terminals()
}

#[tauri::command]
pub async fn list_editors() -> Vec<launch::Tool> {
    launch::editors()
}

#[tauri::command]
pub async fn open_terminal(state: State<'_, AppState>, root: String, terminal: Option<String>) -> Result<(), GitError> {
    let g = state.git(&root)?;
    launch::open_terminal(g.root(), terminal.as_deref()).map_err(GitError::io)
}

#[tauri::command]
pub async fn open_in_editor(state: State<'_, AppState>, root: String, editor: Option<String>, path: Option<String>, line: Option<u32>) -> Result<(), GitError> {
    let g = state.git(&root)?;
    let target = match path {
        Some(p) => safe_join(g.root(), &p)?,
        None => g.root().to_path_buf(),
    };
    launch::open_editor(editor.as_deref(), g.root(), &target, line).map_err(GitError::io)
}

#[tauri::command]
pub async fn reveal_in_file_manager(state: State<'_, AppState>, root: String, path: Option<String>) -> Result<(), GitError> {
    let g = state.git(&root)?;
    let target = match path {
        Some(p) => safe_join(g.root(), &p)?,
        None => g.root().to_path_buf(),
    };
    let dir = if target.is_dir() { target } else { target.parent().unwrap_or(g.root()).to_path_buf() };
    std::process::Command::new("xdg-open").arg(dir).spawn().map(|_| ()).map_err(|e| GitError::io(e.to_string()))
}

#[tauri::command]
pub async fn load_state() -> Result<String, GitError> {
    store::load().map_err(GitError::io)
}

#[tauri::command]
pub async fn save_state(json: String) -> Result<(), GitError> {
    store::save(&json).map_err(GitError::io)
}


#[tauri::command]
pub async fn watch_repository(app: tauri::AppHandle, state: State<'_, AppState>, watcher: State<'_, watcher::WatcherState>, root: String) -> Result<(), GitError> {
    let g = state.git(&root)?;
    let gd = blocking({
        let g = g.clone();
        move || g.text(&["rev-parse", "--path-format=absolute", "--git-dir"])
    })
    .await?;
    let git_dir = PathBuf::from(gd.trim());
    let path = g.root().to_path_buf();
    let payload = root.clone();
    let handle = watcher::start(path, git_dir, move || {
        let _ = app.emit("repo-changed", payload.clone());
    })
    .map_err(GitError::io)?;
    // Replacing the previous handle stops the old watcher thread.
    *watcher.0.lock().map_err(|_| GitError::io("watcher state poisoned"))? = Some(handle);
    Ok(())
}

#[tauri::command]
pub async fn unwatch_repository(watcher: State<'_, watcher::WatcherState>) -> Result<(), GitError> {
    *watcher.0.lock().map_err(|_| GitError::io("watcher state poisoned"))? = None;
    Ok(())
}

/// A folder passed on the command line (`imperial-terminal /path/to/repo`).
#[tauri::command]
pub fn initial_repository() -> Option<String> {
    std::env::args().nth(1).filter(|a| !a.starts_with('-') && std::path::Path::new(a).is_dir())
}
