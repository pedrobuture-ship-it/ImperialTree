import { describe, expect, it } from "vitest";
import { line, preview } from "./commands";

describe("command previews", () => {
  it("matches the documented examples", () => {
    expect(preview.createBranch("feature/example", "main")).toBe("git switch -c feature/example main");
    expect(preview.fetch("origin")).toBe("git fetch --prune origin");
    expect(preview.worktreeAdd("../feature-auth", "feature/auth", false)).toBe("git worktree add ../feature-auth feature/auth");
  });

  it("quotes unsafe characters for display", () => {
    expect(preview.commit("feat(board): add note", "", false)).toBe('git commit -m "feat(board): add note"');
    expect(line("add", "--", "my file.txt")).toBe('git add -- "my file.txt"');
    expect(preview.stash("WIP", true)).toBe("git stash push --include-untracked -m WIP");
  });

  it("falls back to placeholders while a form is incomplete", () => {
    expect(preview.createBranch("")).toBe('git switch -c "<name>"');
  });
});
