export type Segment = { type: "text"; text: string } | { type: "conflict"; ours: string; theirs: string; base?: string; oursLabel: string; theirsLabel: string };

/** Splits merged file content into plain text and conflict blocks. */
export function parseConflicts(content: string): Segment[] {
  const lines = content.split("\n");
  const segs: Segment[] = [];
  let buf: string[] = [];
  let i = 0;
  const flush = () => {
    if (buf.length) segs.push({ type: "text", text: buf.join("\n") });
    buf = [];
  };
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("<<<<<<< ") || l === "<<<<<<<") {
      const end = findEnd(lines, i);
      if (end === -1) {
        buf.push(l);
        i++;
        continue;
      }
      flush();
      const oursLabel = l.slice(8);
      const ours: string[] = [];
      const base: string[] = [];
      const theirs: string[] = [];
      let part: "ours" | "base" | "theirs" = "ours";
      let theirsLabel = "";
      let hasBase = false;
      for (let k = i + 1; k <= end; k++) {
        const c = lines[k];
        if (c.startsWith("||||||| ")) {
          part = "base";
          hasBase = true;
        } else if (c === "=======") {
          part = "theirs";
        } else if (k === end) {
          theirsLabel = c.slice(8);
        } else if (part === "ours") ours.push(c);
        else if (part === "base") base.push(c);
        else theirs.push(c);
      }
      segs.push({ type: "conflict", ours: ours.join("\n"), theirs: theirs.join("\n"), base: hasBase ? base.join("\n") : undefined, oursLabel, theirsLabel });
      i = end + 1;
    } else {
      buf.push(l);
      i++;
    }
  }
  flush();
  return segs;
}

function findEnd(lines: string[], start: number): number {
  let sawSep = false;
  for (let k = start + 1; k < lines.length; k++) {
    if (lines[k] === "=======") sawSep = true;
    if (lines[k].startsWith(">>>>>>> ") || lines[k] === ">>>>>>>") return sawSep ? k : -1;
  }
  return -1;
}

export type Resolution = "ours" | "theirs" | "both";

export function resolveSegments(segs: Segment[], choices: Record<number, Resolution | undefined>): string {
  const parts: string[] = [];
  let conflictIdx = 0;
  for (const s of segs) {
    if (s.type === "text") {
      parts.push(s.text);
      continue;
    }
    const c = choices[conflictIdx++];
    if (c === "ours") parts.push(s.ours);
    else if (c === "theirs") parts.push(s.theirs);
    else if (c === "both") parts.push([s.ours, s.theirs].join("\n"));
    else parts.push(`<<<<<<< ${s.oursLabel}\n${s.ours}\n=======\n${s.theirs}\n>>>>>>> ${s.theirsLabel}`);
  }
  return parts.join("\n");
}

export function hasMarkers(content: string): boolean {
  return /^<<<<<<< /m.test(content) && /^=======$/m.test(content) && /^>>>>>>> /m.test(content);
}
