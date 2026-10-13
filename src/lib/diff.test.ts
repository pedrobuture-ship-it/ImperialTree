import { describe, expect, it } from "vitest";
import { countChanges, hunkPatch, parseDiff, splitRows } from "./diff";

const SAMPLE = `diff --git a/f.txt b/f.txt
index 111..222 100644
--- a/f.txt
+++ b/f.txt
@@ -1,3 +1,3 @@
 a
-b
+B
 c
@@ -20,2 +20,3 @@ ctx
 x
+y
 z
\\ No newline at end of file
`;

describe("parseDiff", () => {
  const d = parseDiff(SAMPLE);

  it("splits header and hunks", () => {
    expect(d.hunks).toHaveLength(2);
    expect(d.header.startsWith("diff --git")).toBe(true);
    expect(d.header).toContain("+++ b/f.txt");
  });

  it("numbers lines on both sides", () => {
    const lines = d.hunks[0].lines;
    expect(lines.map((l) => [l.kind, l.oldNo, l.newNo])).toEqual([
      ["context", 1, 1],
      ["del", 2, null],
      ["add", null, 2],
      ["context", 3, 3],
    ]);
    expect(d.hunks[1].lines[1]).toMatchObject({ kind: "add", newNo: 21 });
  });

  it("builds a patch containing only the chosen hunk", () => {
    const p = hunkPatch(d, 1);
    expect(p.startsWith("diff --git")).toBe(true);
    expect(p).toContain("@@ -20,2 +20,3 @@");
    expect(p).not.toContain("@@ -1,3");
    expect(p.endsWith("\n")).toBe(true);
  });

  it("counts additions and removals", () => {
    expect(countChanges(d)).toEqual({ added: 2, removed: 1 });
  });

  it("detects binary diffs", () => {
    expect(parseDiff("diff --git a/x b/x\nBinary files a/x and b/x differ\n").binary).toBe(true);
  });
});

describe("splitRows", () => {
  it("pairs deletions with additions", () => {
    const rows = splitRows(parseDiff(SAMPLE).hunks[0].lines);
    expect(rows).toHaveLength(3);
    expect(rows[1].left?.text).toBe("b");
    expect(rows[1].right?.text).toBe("B");
  });

  it("leaves gaps for unbalanced changes", () => {
    const rows = splitRows(parseDiff(SAMPLE).hunks[1].lines);
    expect(rows[1].left).toBeNull();
    expect(rows[1].right?.text).toBe("y");
  });
});
