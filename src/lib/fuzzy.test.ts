import { describe, expect, it } from "vitest";
import { fuzzyFilter, fuzzyScore } from "./fuzzy";

describe("fuzzy", () => {
  it("matches subsequences only", () => {
    expect(fuzzyScore("fte", "feature/editor")).not.toBeNull();
    expect(fuzzyScore("xyz", "feature/editor")).toBeNull();
  });

  it("ranks tighter matches first", () => {
    const out = fuzzyFilter(["bugfix/parser", "feature/canvas", "feature/editor"], "fed", (s) => s);
    expect(out[0]).toBe("feature/editor");
  });

  it("returns everything for an empty query", () => {
    expect(fuzzyFilter(["a", "b"], "  ", (s) => s)).toEqual(["a", "b"]);
  });
});
