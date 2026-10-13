import { describe, expect, it } from "vitest";
import { hasMarkers, parseConflicts, resolveSegments } from "./conflicts";

const FILE = `top
<<<<<<< HEAD
ours line
=======
theirs line
>>>>>>> feature
bottom`;

describe("conflict markers", () => {
  it("parses blocks and labels", () => {
    const segs = parseConflicts(FILE);
    expect(segs).toHaveLength(3);
    expect(segs[1]).toMatchObject({ type: "conflict", ours: "ours line", theirs: "theirs line", oursLabel: "HEAD", theirsLabel: "feature" });
  });

  it("resolves each choice", () => {
    const segs = parseConflicts(FILE);
    expect(resolveSegments(segs, { 0: "ours" })).toBe("top\nours line\nbottom");
    expect(resolveSegments(segs, { 0: "theirs" })).toBe("top\ntheirs line\nbottom");
    expect(resolveSegments(segs, { 0: "both" })).toBe("top\nours line\ntheirs line\nbottom");
  });

  it("keeps unresolved markers so nothing is silently dropped", () => {
    expect(resolveSegments(parseConflicts(FILE), {})).toBe(FILE);
  });

  it("supports diff3 base sections", () => {
    const f = "<<<<<<< HEAD\na\n||||||| base\nb\n=======\nc\n>>>>>>> x";
    const s = parseConflicts(f)[0];
    expect(s).toMatchObject({ type: "conflict", base: "b", ours: "a", theirs: "c" });
  });

  it("ignores unterminated markers", () => {
    expect(hasMarkers("<<<<<<< a\nx")).toBe(false);
    expect(parseConflicts("<<<<<<< a\nx")).toEqual([{ type: "text", text: "<<<<<<< a\nx" }]);
  });
});
