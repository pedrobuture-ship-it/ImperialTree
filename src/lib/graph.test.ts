import { describe, expect, it } from "vitest";
import { layoutGraph } from "./graph";
import type { Commit } from "@/types/git";

const c = (hash: string, ...parents: string[]): Commit => ({ hash, short: hash, parents, author: "", email: "", timestamp: 0, refs: [], subject: hash });

describe("layoutGraph", () => {
  it("keeps a linear history in one lane", () => {
    const rows = layoutGraph([c("c", "b"), c("b", "a"), c("a")]);
    expect(rows.map((r) => r.lane)).toEqual([0, 0, 0]);
    expect(rows[0].edges).toEqual([{ from: 0, to: 0, color: 0 }]);
  });

  it("opens a second lane for a side branch and rejoins the fork point", () => {
    // d (feature) and c (main) both descend from b
    const rows = layoutGraph([c("d", "b"), c("c", "b"), c("b", "a"), c("a")]);
    expect(rows[0].lane).toBe(0);
    expect(rows[1].lane).toBe(1);
    expect(rows[1].through).toEqual([0]);
    // The side lane rejoins the fork point's lane right away (its first parent is already tracked).
    expect(rows[1].edges).toEqual([{ from: 1, to: 0, color: 1 }]);
    expect(rows[2].lane).toBe(0);
  });

  it("draws merge commits with an edge per parent", () => {
    const rows = layoutGraph([c("m", "a", "b"), c("a", "r"), c("b", "r"), c("r")]);
    expect(rows[0].edges).toHaveLength(2);
    expect(rows[0].edges.map((e) => e.to).sort()).toEqual([0, 1]);
    expect(rows[3].lane).toBe(0);
  });

  it("handles thousands of commits quickly", () => {
    const many = Array.from({ length: 20000 }, (_, i) => c(`h${i}`, `h${i + 1}`));
    const t = performance.now();
    expect(layoutGraph(many)).toHaveLength(20000);
    expect(performance.now() - t).toBeLessThan(500);
  });
});
