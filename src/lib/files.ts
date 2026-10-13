import type { FileEntry } from "@/types/git";

export interface Grouped {
  staged: FileEntry[];
  unstaged: FileEntry[];
  untracked: FileEntry[];
  conflicted: FileEntry[];
}

export function groupEntries(entries: FileEntry[]): Grouped {
  const g: Grouped = { staged: [], unstaged: [], untracked: [], conflicted: [] };
  for (const e of entries) {
    if (e.conflicted) g.conflicted.push(e);
    else if (e.untracked) g.untracked.push(e);
    else {
      if (e.index !== ".") g.staged.push(e);
      if (e.worktree !== ".") g.unstaged.push(e);
    }
  }
  return g;
}

export function statusLetter(e: FileEntry, staged: boolean): string {
  if (e.untracked) return "U";
  if (e.conflicted) return "!";
  const c = staged ? e.index : e.worktree;
  return c === "." ? "" : c;
}

export function statusTone(letter: string): "cyan" | "green" | "red" | "warn" | "neutral" {
  switch (letter) {
    case "A":
      return "green";
    case "D":
      return "red";
    case "U":
      return "warn";
    case "!":
      return "red";
    case "M":
    case "R":
    case "C":
    case "T":
      return "cyan";
    default:
      return "neutral";
  }
}

export function describeWorkingTree(entries: FileEntry[]): string {
  if (entries.length === 0) return "clean";
  return `${entries.length} change${entries.length === 1 ? "" : "s"}`;
}
