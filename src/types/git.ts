export interface FileEntry {
  path: string;
  origPath: string | null;
  index: string;
  worktree: string;
  untracked: boolean;
  conflicted: boolean;
}

export interface RepoStatus {
  branch: string | null;
  oid: string | null;
  detached: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  entries: FileEntry[];
}

export type RefKind = "head" | "local" | "remote" | "tag";
export interface RefLabel {
  name: string;
  kind: RefKind;
}

export interface Commit {
  hash: string;
  short: string;
  parents: string[];
  author: string;
  email: string;
  timestamp: number;
  refs: RefLabel[];
  subject: string;
}

export interface FileStat {
  path: string;
  added: number | null;
  removed: number | null;
}

export interface CommitDetails {
  commit: Commit;
  body: string;
  branches: string[];
  files: FileStat[];
  insertions: number;
  deletions: number;
}

export interface LogQuery {
  skip?: number;
  limit?: number;
  search?: string;
  author?: string;
  branch?: string;
  since?: string;
  until?: string;
}

export interface Branch {
  name: string;
  fullName: string;
  remote: boolean;
  current: boolean;
  hash: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  timestamp: number;
  subject: string;
}

export interface Remote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface Stash {
  index: number;
  name: string;
  message: string;
  branch: string;
  timestamp: number;
}

export interface Tag {
  name: string;
  annotated: boolean;
  commit: string;
  timestamp: number;
  message: string;
}

export interface Worktree {
  path: string;
  head: string;
  branch: string | null;
  detached: boolean;
  bare: boolean;
  locked: boolean;
  prunable: boolean;
  main: boolean;
  dirty: number | null;
}

export interface ReflogEntry {
  hash: string;
  short: string;
  selector: string;
  timestamp: number;
  action: string;
  message: string;
}

export interface StagedSummary {
  files: number;
  added: number;
  removed: number;
}

export interface Executed {
  command: string;
  stdout: string;
  stderr: string;
}

export interface RebaseOutcome {
  executed: Executed;
  stopped: boolean;
  todo: string;
}

export interface TodoItem {
  action: "pick" | "reword" | "edit" | "squash" | "fixup" | "drop";
  hash: string;
  message?: string;
}

export type Operation = "none" | "merge" | "rebase" | "cherryPick" | "revert";

export interface ConflictFile {
  path: string;
  base: string | null;
  ours: string | null;
  theirs: string | null;
  merged: string;
}

export interface ConfigValue {
  key: string;
  global: string | null;
  local: string | null;
  effective: string | null;
}

export interface SigningStatus {
  enabled: boolean;
  format: string;
  key: string | null;
  program: string | null;
}

export interface Health {
  repoBytes: number;
  gitBytes: number;
  looseObjects: number;
  packedObjects: number;
  packs: number;
  garbage: number;
  branches: number;
  staleBranches: string[];
  largeFiles: { path: string; bytes: number }[];
  dangling: number;
  uncommitted: number;
  warnings: string[];
  suggestions: string[];
}

export interface SshStatus {
  dirExists: boolean;
  keys: { file: string; fingerprint: string }[];
  agentRunning: boolean;
  agentKeys: number | null;
}

export interface Tool {
  id: string;
  name: string;
}

export interface RepoInfo {
  root: string;
  name: string;
  branch: string | null;
}

export interface Environment {
  gitVersion: string | null;
  os: string;
  appVersion: string;
}

export type GitErrorKind = "git-not-found" | "not-a-repository" | "invalid-input" | "timeout" | "failed" | "io";

export interface GitError {
  kind: GitErrorKind;
  command: string;
  message: string;
  stderr: string;
  code: number | null;
}
