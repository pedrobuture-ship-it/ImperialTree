/** Builds the exact git command lines the UI will run, for the command preview. */

function q(arg: string): string {
  return /^[A-Za-z0-9_\-./@:=,+%{}~^]+$/.test(arg) ? arg : `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function line(...args: string[]): string {
  return ["git", ...args.map(q)].join(" ");
}

export const preview = {
  createBranch: (name: string, start?: string) => line("switch", "-c", name || "<name>", ...(start ? [start] : [])),
  checkout: (name: string) => line("switch", name),
  deleteBranch: (name: string, force: boolean) => line("branch", force ? "-D" : "-d", name),
  renameBranch: (old: string, name: string) => line("branch", "-m", old, name || "<new-name>"),
  merge: (name: string) => line("merge", "--no-edit", name),
  rebase: (name: string) => line("rebase", name),
  commit: (summary: string, description: string, amend: boolean) => line("commit", "-m", summary || "<summary>", ...(description.trim() ? ["-m", description.trim()] : []), ...(amend ? ["--amend"] : [])),
  stash: (message: string, untracked: boolean) => line("stash", "push", ...(untracked ? ["--include-untracked"] : []), ...(message.trim() ? ["-m", message.trim()] : [])),
  addRemote: (name: string, url: string) => line("remote", "add", name || "<name>", url || "<url>"),
  fetch: (remote: string) => line("fetch", "--prune", remote),
  pull: (remote: string, rebase: boolean) => line("pull", rebase ? "--rebase" : "--ff-only", remote),
  push: (remote: string, branch: string, upstream: boolean) => line("push", ...(upstream ? ["--set-upstream"] : []), remote, branch),
  tag: (name: string, target: string, message: string) => line("tag", ...(message.trim() ? ["-a", "-m", message.trim()] : []), name || "<tag>", ...(target ? [target] : [])),
  worktreeAdd: (path: string, branch: string, create: boolean) => (create ? line("worktree", "add", "-b", branch || "<branch>", path || "<path>") : line("worktree", "add", path || "<path>", branch || "<branch>")),
  worktreeRemove: (path: string, force: boolean) => line("worktree", "remove", ...(force ? ["--force"] : []), path),
  clone: (url: string, dest: string) => line("clone", "--progress", "--", url || "<url>", dest || "<destination>"),
  discard: (paths: string[], untracked: boolean) => (untracked ? line("clean", "-f", "--", ...paths) : line("restore", "--", ...paths)),
  stage: (paths: string[]) => line("add", "--", ...paths),
  unstage: (paths: string[]) => line("restore", "--staged", "--", ...paths),
  rebaseInteractive: (base: string) => line("rebase", "-i", base),
  cherryPick: (hash: string) => line("cherry-pick", hash),
  revert: (hash: string) => line("revert", "--no-edit", hash),
};
