import { create } from "zustand";
import { api, toGitError } from "@/lib/api";
import { useSettings } from "./settings";
import { useUi } from "./ui";
import type { Branch, Operation, Remote, RepoInfo, RepoStatus, Stash, StagedSummary, Tag, Worktree } from "@/types/git";

export interface Selection {
  path: string;
  staged: boolean;
  untracked: boolean;
}

interface RepoState {
  repo: RepoInfo | null;
  status: RepoStatus | null;
  branches: Branch[];
  remotes: Remote[];
  stashes: Stash[];
  tags: Tag[];
  worktrees: Worktree[];
  operation: Operation;
  summary: StagedSummary;
  selection: Selection | null;
  busy: number;
  revision: number;
  open: (path: string) => Promise<boolean>;
  close: () => void;
  refresh: () => Promise<void>;
  select: (s: Selection | null) => void;
}

const EMPTY_SUMMARY: StagedSummary = { files: 0, added: 0, removed: 0 };

export const useRepo = create<RepoState>((set, get) => ({
  repo: null,
  status: null,
  branches: [],
  remotes: [],
  stashes: [],
  tags: [],
  worktrees: [],
  operation: "none",
  summary: EMPTY_SUMMARY,
  selection: null,
  busy: 0,
  revision: 0,

  open: async (path) => {
    try {
      const info = await api.openRepository(path);
      set({ repo: info, status: null, branches: [], remotes: [], stashes: [], tags: [], worktrees: [], selection: null, operation: "none", summary: EMPTY_SUMMARY });
      useSettings.getState().touchRecent({ path: info.root, name: info.name, branch: info.branch, lastOpened: Date.now() });
      useUi.getState().setView("overview");
      await get().refresh();
      return true;
    } catch (e) {
      useUi.getState().openDialog({ kind: "error", error: toGitError(e) });
      return false;
    }
  },

  close: () => {
    set({ repo: null, status: null, selection: null });
    useUi.getState().setView("home");
  },

  refresh: async () => {
    const root = get().repo?.root;
    if (!root) return;
    const settle = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
    const [status, branches, remotes, stashes, tags, worktrees, operation, summary] = await Promise.all([
      settle(api.status(root), null),
      settle(api.branches(root), [] as Branch[]),
      settle(api.remotes(root), [] as Remote[]),
      settle(api.stashes(root), [] as Stash[]),
      settle(api.tags(root), [] as Tag[]),
      settle(api.worktrees(root), [] as Worktree[]),
      settle(api.operationState(root), "none" as Operation),
      settle(api.stagedSummary(root), EMPTY_SUMMARY),
    ]);
    if (get().repo?.root !== root) return; // repository changed while loading
    const sel = get().selection;
    const stillThere = sel && status?.entries.some((e) => e.path === sel.path);
    set((s) => ({
      status,
      branches,
      remotes,
      stashes,
      tags,
      worktrees,
      operation,
      summary,
      selection: stillThere ? sel : null,
      revision: s.revision + 1,
      repo: s.repo && status ? { ...s.repo, branch: status.branch } : s.repo,
    }));
  },

  select: (selection) => set({ selection }),
}));
