import type { Commit } from "@/types/git";

export interface GraphRow {
  commit: Commit;
  /** Lane of the commit node. */
  lane: number;
  /** Lanes that continue straight through this row (drawn as vertical lines). */
  through: number[];
  /** Edges from this node to its parents: target lane in the next row. */
  edges: { from: number; to: number; color: number }[];
  color: number;
  /** Lanes in use after this row, used for sizing. */
  width: number;
}

/**
 * Assigns each commit a lane. Commits arrive newest first (date order). A lane
 * "reserves" the hash of the commit it expects next; the first parent keeps the
 * lane, further parents open new lanes.
 */
export function layoutGraph(commits: Commit[]): GraphRow[] {
  const lanes: (string | null)[] = [];
  const laneColor: number[] = [];
  let nextColor = 0;
  const rows: GraphRow[] = [];

  const freeLane = (): number => {
    const i = lanes.indexOf(null);
    if (i !== -1) return i;
    lanes.push(null);
    return lanes.length - 1;
  };

  for (const commit of commits) {
    let lane = lanes.indexOf(commit.hash);
    if (lane === -1) {
      lane = freeLane();
      laneColor[lane] = nextColor++ % 6;
    }
    const color = laneColor[lane];
    // Other lanes waiting for this same commit converge here and are freed.
    const converging: number[] = [];
    lanes.forEach((h, i) => {
      if (h === commit.hash && i !== lane) converging.push(i);
    });
    const through = lanes.map((h, i) => (h !== null && h !== commit.hash && i !== lane ? i : -1)).filter((i) => i !== -1);

    const edges: GraphRow["edges"] = [];
    for (const i of converging) {
      edges.push({ from: i, to: lane, color: laneColor[i] });
      lanes[i] = null;
    }

    const [first, ...rest] = commit.parents;
    if (first === undefined) {
      lanes[lane] = null;
    } else {
      const existing = lanes.indexOf(first);
      if (existing !== -1 && existing !== lane) {
        // First parent already tracked by another lane: merge into it.
        edges.push({ from: lane, to: existing, color });
        lanes[lane] = null;
      } else {
        lanes[lane] = first;
        edges.push({ from: lane, to: lane, color });
      }
    }
    for (const p of rest) {
      const existing = lanes.indexOf(p);
      if (existing !== -1) {
        edges.push({ from: lane, to: existing, color: laneColor[existing] });
      } else {
        const l = freeLane();
        lanes[l] = p;
        laneColor[l] = nextColor++ % 6;
        edges.push({ from: lane, to: l, color: laneColor[l] });
      }
    }
    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop();
    rows.push({ commit, lane, through, edges, color, width: Math.max(lanes.length, lane + 1) });
  }
  return rows;
}

export function maxLanes(rows: GraphRow[]): number {
  return rows.reduce((m, r) => Math.max(m, r.width, ...r.edges.map((e) => Math.max(e.from, e.to) + 1)), 1);
}
