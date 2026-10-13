import { create } from "zustand";
import type { GitError } from "@/types/git";

export type View =
  | "home"
  | "overview"
  | "changes"
  | "history"
  | "branches"
  | "remotes"
  | "stashes"
  | "tags"
  | "worktrees"
  | "terminal"
  | "reflog"
  | "health"
  | "conflicts"
  | "settings"
  | "about";

export type Dialog =
  | { kind: "createBranch"; start?: string }
  | { kind: "createTag"; target?: string }
  | { kind: "createStash" }
  | { kind: "createWorktree"; branch?: string }
  | { kind: "clone" }
  | { kind: "addRemote" }
  | { kind: "shortcuts" }
  | { kind: "rebase"; base?: string }
  | { kind: "error"; error: GitError }
  | {
      kind: "confirm";
      title: string;
      command: string;
      impact: string;
      confirmLabel: string;
      /** When set, the user must type this exact text to enable the button. */
      typeToConfirm?: string;
      onConfirm: () => void;
    }
  | { kind: "renameBranch"; name: string };

export interface Toast {
  id: number;
  tone: "ok" | "info" | "warn";
  title: string;
  detail?: string;
}

interface UiState {
  view: View;
  dialog: Dialog | null;
  palette: "commands" | "branches" | null;
  toasts: Toast[];
  historyFocus: string | null;
  setView: (v: View) => void;
  openDialog: (d: Dialog) => void;
  closeDialog: () => void;
  setPalette: (p: UiState["palette"]) => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  focusCommit: (hash: string) => void;
}

let toastId = 0;

export const useUi = create<UiState>((set) => ({
  view: "home",
  dialog: null,
  palette: null,
  toasts: [],
  historyFocus: null,
  setView: (view) => set({ view }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  setPalette: (palette) => set({ palette }),
  toast: (t) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  focusCommit: (hash) => set({ historyFocus: hash, view: "history" }),
}));
