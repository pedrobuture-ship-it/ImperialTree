export type LineKind = "context" | "add" | "del" | "meta";

export interface DiffLine {
  kind: LineKind;
  text: string;
  oldNo: number | null;
  newNo: number | null;
}

export interface Hunk {
  header: string;
  lines: DiffLine[];
  /** Raw text of the hunk including its header, as Git printed it. */
  raw: string;
}

export interface ParsedDiff {
  /** Everything before the first hunk (diff --git, index, ---, +++ ...). */
  header: string;
  hunks: Hunk[];
  binary: boolean;
}

const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseDiff(text: string): ParsedDiff {
  const rows = text.split("\n");
  if (rows.length && rows[rows.length - 1] === "") rows.pop();
  const headerLines: string[] = [];
  const hunks: Hunk[] = [];
  let cur: Hunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  let binary = false;

  for (const row of rows) {
    const m = HUNK_RE.exec(row);
    if (m) {
      cur = { header: row, lines: [], raw: row + "\n" };
      hunks.push(cur);
      oldNo = Number(m[1]);
      newNo = Number(m[2]);
      continue;
    }
    if (!cur) {
      if (row.startsWith("Binary files") || row.startsWith("GIT binary patch")) binary = true;
      headerLines.push(row);
      continue;
    }
    cur.raw += row + "\n";
    if (row.startsWith("+")) {
      cur.lines.push({ kind: "add", text: row.slice(1), oldNo: null, newNo: newNo++ });
    } else if (row.startsWith("-")) {
      cur.lines.push({ kind: "del", text: row.slice(1), oldNo: oldNo++, newNo: null });
    } else if (row.startsWith("\\")) {
      cur.lines.push({ kind: "meta", text: row, oldNo: null, newNo: null });
    } else {
      cur.lines.push({ kind: "context", text: row.startsWith(" ") ? row.slice(1) : row, oldNo: oldNo++, newNo: newNo++ });
    }
  }
  return { header: headerLines.length ? headerLines.join("\n") + "\n" : "", hunks, binary };
}

/** Builds a single-hunk patch that `git apply` accepts. */
export function hunkPatch(diff: ParsedDiff, index: number): string {
  const h = diff.hunks[index];
  if (!h) throw new Error("hunk out of range");
  return diff.header + h.raw;
}

export function countChanges(diff: ParsedDiff): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const h of diff.hunks) {
    for (const l of h.lines) {
      if (l.kind === "add") added++;
      else if (l.kind === "del") removed++;
    }
  }
  return { added, removed };
}

export interface SplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

/** Pairs deletions with additions so the split view lines them up. */
export function splitRows(lines: DiffLine[]): SplitRow[] {
  const out: SplitRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.kind === "context") {
      out.push({ left: l, right: l });
      i++;
    } else if (l.kind === "meta") {
      i++;
    } else {
      const dels: DiffLine[] = [];
      const adds: DiffLine[] = [];
      while (i < lines.length && (lines[i].kind === "del" || lines[i].kind === "add" || lines[i].kind === "meta")) {
        if (lines[i].kind === "del") dels.push(lines[i]);
        else if (lines[i].kind === "add") adds.push(lines[i]);
        i++;
      }
      const n = Math.max(dels.length, adds.length);
      for (let k = 0; k < n; k++) out.push({ left: dels[k] ?? null, right: adds[k] ?? null });
    }
  }
  return out;
}
