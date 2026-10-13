import { describe, expect, it } from "vitest";
import { describeWorkingTree, groupEntries, statusLetter, statusTone } from "./files";
import type { FileEntry } from "@/types/git";

const e = (path: string, index: string, worktree: string, extra: Partial<FileEntry> = {}): FileEntry => ({ path, origPath: null, index, worktree, untracked: false, conflicted: false, ...extra });

describe("groupEntries", () => {
  it("puts a file with staged and unstaged edits in both lists", () => {
    const g = groupEntries([e("a.ts", "M", "M"), e("b.ts", "A", "."), e("c.ts", ".", "M"), e("d.md", ".", "?", { untracked: true }), e("x.ts", "U", "U", { conflicted: true })]);
    expect(g.staged.map((f) => f.path)).toEqual(["a.ts", "b.ts"]);
    expect(g.unstaged.map((f) => f.path)).toEqual(["a.ts", "c.ts"]);
    expect(g.untracked.map((f) => f.path)).toEqual(["d.md"]);
    expect(g.conflicted.map((f) => f.path)).toEqual(["x.ts"]);
  });
});

describe("status helpers", () => {
  it("picks the letter for the requested side", () => {
    const f = e("a.ts", "A", "M");
    expect(statusLetter(f, true)).toBe("A");
    expect(statusLetter(f, false)).toBe("M");
    expect(statusLetter(e("n", ".", "?", { untracked: true }), false)).toBe("U");
  });

  it("maps letters to tones and describes the tree", () => {
    expect(statusTone("A")).toBe("green");
    expect(statusTone("D")).toBe("red");
    expect(describeWorkingTree([])).toBe("clean");
    expect(describeWorkingTree([e("a", "M", ".")])).toBe("1 change");
    expect(describeWorkingTree([e("a", "M", "."), e("b", "M", ".")])).toBe("2 changes");
  });
});
