import { invoke } from "@tauri-apps/api/core";
import type * as T from "@/types/git";

export function isGitError(e: unknown): e is T.GitError {
  return typeof e === "object" && e !== null && "message" in e && "kind" in e && "command" in e;
}

/** Normalises anything thrown by `invoke` into the typed Git error shape. */
export function toGitError(e: unknown): T.GitError {
  if (isGitError(e)) return e;
  const message = typeof e === "string" ? e : e instanceof Error ? e.message : "Unexpected error";
  return { kind: "io", command: "", message, stderr: "", code: null };
}

type PatchMode = "stage" | "unstage" | "discard";

export const api = {
  openRepository: (path: string) => invoke<T.RepoInfo>("open_repository", { path }),
  cloneRepository: (url: string, destination: string) => invoke<T.Executed>("clone_repository", { url, destination }),
  status: (root: string) => invoke<T.RepoStatus>("repo_status", { root }),
  history: (root: string, query: T.LogQuery) => invoke<T.Commit[]>("history", { root, query }),
  commitDetails: (root: string, hash: string) => invoke<T.CommitDetails>("commit_details", { root, hash }),
  commitDiff: (root: string, hash: string) => invoke<string>("commit_diff", { root, hash }),
  fileDiff: (root: string, path: string, staged: boolean, untracked: boolean) => invoke<string>("file_diff", { root, path, staged, untracked }),
  applyPatch: (root: string, patch: string, mode: PatchMode) => invoke<T.Executed>("apply_patch", { root, patch, mode }),
  stage: (root: string, paths: string[]) => invoke<T.Executed>("stage_paths", { root, paths }),
  unstage: (root: string, paths: string[]) => invoke<T.Executed>("unstage_paths", { root, paths }),
  discard: (root: string, paths: string[], untracked: boolean) => invoke<T.Executed>("discard_paths", { root, paths, untracked }),
  stagedSummary: (root: string) => invoke<T.StagedSummary>("staged_summary", { root }),
  commit: (root: string, summary: string, description: string, amend: boolean) => invoke<T.Executed>("create_commit", { root, summary, description, amend }),
  cherryPick: (root: string, hash: string) => invoke<T.Executed>("cherry_pick", { root, hash }),
  revert: (root: string, hash: string) => invoke<T.Executed>("revert_commit", { root, hash }),
  branches: (root: string) => invoke<T.Branch[]>("list_branches", { root }),
  createBranch: (root: string, name: string, start?: string) => invoke<T.Executed>("create_branch", { root, name, start: start ?? null }),
  validateBranchName: (root: string, name: string) => invoke<void>("validate_branch_name", { root, name }),
  checkout: (root: string, name: string) => invoke<T.Executed>("checkout_branch", { root, name }),
  checkoutCommit: (root: string, hash: string) => invoke<T.Executed>("checkout_commit", { root, hash }),
  renameBranch: (root: string, old: string, name: string) => invoke<T.Executed>("rename_branch", { root, old, new: name }),
  deleteBranch: (root: string, name: string, force: boolean) => invoke<T.Executed>("delete_branch", { root, name, force }),
  merge: (root: string, name: string) => invoke<T.Executed>("merge_branch", { root, name }),
  rebaseOnto: (root: string, name: string) => invoke<T.Executed>("rebase_onto", { root, name }),
  remotes: (root: string) => invoke<T.Remote[]>("list_remotes", { root }),
  fetch: (root: string, remote: string) => invoke<T.Executed>("fetch_remote", { root, remote }),
  pull: (root: string, remote: string, rebase: boolean) => invoke<T.Executed>("pull_remote", { root, remote, rebase }),
  push: (root: string, remote: string, branch: string, setUpstream: boolean) => invoke<T.Executed>("push_remote", { root, remote, branch, setUpstream }),
  stashes: (root: string) => invoke<T.Stash[]>("list_stashes", { root }),
  stashPush: (root: string, message: string, includeUntracked: boolean) => invoke<T.Executed>("stash_push", { root, message, includeUntracked }),
  stashApply: (root: string, name: string) => invoke<T.Executed>("stash_apply", { root, name }),
  stashPop: (root: string, name: string) => invoke<T.Executed>("stash_pop", { root, name }),
  stashDrop: (root: string, name: string) => invoke<T.Executed>("stash_drop", { root, name }),
  tags: (root: string) => invoke<T.Tag[]>("list_tags", { root }),
  createTag: (root: string, name: string, target?: string, message?: string) => invoke<T.Executed>("create_tag", { root, name, target: target ?? null, message: message ?? null }),
  deleteTag: (root: string, name: string) => invoke<T.Executed>("delete_tag", { root, name }),
  pushTag: (root: string, remote: string, name: string) => invoke<T.Executed>("push_tag", { root, remote, name }),
  worktrees: (root: string, withStatus = false) => invoke<T.Worktree[]>("list_worktrees", { root, withStatus }),
  addWorktree: (root: string, path: string, branch: string, create: boolean) => invoke<T.Executed>("add_worktree", { root, path, branch, create }),
  removeWorktree: (root: string, path: string, force: boolean) => invoke<T.Executed>("remove_worktree", { root, path, force }),
  pruneWorktrees: (root: string) => invoke<T.Executed>("prune_worktrees", { root }),
  reflog: (root: string, limit: number) => invoke<T.ReflogEntry[]>("reflog_entries", { root, limit }),
  rebaseCommits: (root: string, base: string) => invoke<T.Commit[]>("rebase_commits", { root, base }),
  rebaseStart: (root: string, base: string, items: T.TodoItem[]) => invoke<T.RebaseOutcome>("rebase_start", { root, base, items }),
  operationState: (root: string) => invoke<T.Operation>("operation_state", { root }),
  operationContinue: (root: string) => invoke<T.Executed>("operation_continue", { root }),
  operationAbort: (root: string) => invoke<T.Executed>("operation_abort", { root }),
  conflictRead: (root: string, path: string) => invoke<T.ConflictFile>("conflict_read", { root, path }),
  conflictWrite: (root: string, path: string, content: string) => invoke<void>("conflict_write", { root, path, content }),
  conflictResolve: (root: string, path: string) => invoke<T.Executed>("conflict_resolve", { root, path }),
  health: (root: string) => invoke<T.Health>("repository_health", { root }),
  configGet: (root: string, keys: string[]) => invoke<T.ConfigValue[]>("config_get", { root, keys }),
  configSet: (root: string, scope: "global" | "local", key: string, value: string) => invoke<T.Executed>("config_set", { root, scope, key, value }),
  signing: (root: string) => invoke<T.SigningStatus>("signing_status", { root }),
  ssh: () => invoke<T.SshStatus>("ssh_diagnostics"),
  sshPublicKey: (file: string) => invoke<string>("ssh_public_key", { file }),
  environment: () => invoke<T.Environment>("environment"),
  terminals: () => invoke<T.Tool[]>("list_terminals"),
  editors: () => invoke<T.Tool[]>("list_editors"),
  openTerminal: (root: string, terminal?: string) => invoke<void>("open_terminal", { root, terminal: terminal ?? null }),
  openInEditor: (root: string, editor?: string, path?: string, line?: number) => invoke<void>("open_in_editor", { root, editor: editor ?? null, path: path ?? null, line: line ?? null }),
  reveal: (root: string, path?: string) => invoke<void>("reveal_in_file_manager", { root, path: path ?? null }),
  initialRepository: () => invoke<string | null>("initial_repository"),
  loadState: () => invoke<string>("load_state"),
  saveState: (json: string) => invoke<void>("save_state", { json }),
};
