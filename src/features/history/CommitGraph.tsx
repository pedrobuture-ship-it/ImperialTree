import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { layoutGraph, maxLanes, type GraphRow } from "@/lib/graph";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Commit, RefLabel } from "@/types/git";

const LANE_W = 14;
const PAD = 12;
const colors = ["var(--lane-0)", "var(--lane-1)", "var(--lane-2)", "var(--lane-3)", "var(--lane-4)", "var(--lane-5)"];
const laneX = (l: number) => PAD + l * LANE_W;

export function RefBadge({ r }: { r: RefLabel }) {
  const tone =
    r.kind === "head" ? "border-alert/70 bg-alert/10 text-alert" : r.kind === "remote" ? "border-alert-dim text-alert/80" : r.kind === "tag" ? "border-cyan-dim bg-cyan/5 text-cyan" : "border-[#2c4a8a] bg-[#4f8cff]/10 text-[#7aa7ff]";
  return <span className={cn("mono inline-flex h-[18px] max-w-[160px] shrink-0 items-center truncate border px-1.5 text-[10px]", tone)}>{r.kind === "tag" ? `⌂ ${r.name}` : r.name}</span>;
}

const GraphCell = memo(function GraphCell({ row, prev, height, width, selected }: { row: GraphRow; prev?: GraphRow; height: number; width: number; selected: boolean }) {
  const mid = height / 2;
  const incoming = new Set(prev?.edges.map((e) => e.to) ?? []);
  const lines: React.ReactNode[] = [];
  row.through.forEach((l) => {
    lines.push(<line key={`t${l}`} x1={laneX(l)} x2={laneX(l)} y1={0} y2={height} stroke={colors[prevColor(prev, l)]} strokeWidth={1.6} />);
  });
  if (incoming.has(row.lane)) lines.push(<line key="in" x1={laneX(row.lane)} x2={laneX(row.lane)} y1={0} y2={mid} stroke={colors[row.color]} strokeWidth={1.6} />);
  row.edges.forEach((e, i) => {
    if (e.from !== row.lane) {
      // converging side lane
      lines.push(<path key={`c${i}`} d={`M${laneX(e.from)} 0 C${laneX(e.from)} ${mid * 0.9} ${laneX(row.lane)} ${mid * 0.4} ${laneX(row.lane)} ${mid}`} stroke={colors[e.color]} strokeWidth={1.6} fill="none" />);
    } else if (e.to === row.lane) {
      lines.push(<line key={`p${i}`} x1={laneX(row.lane)} x2={laneX(row.lane)} y1={mid} y2={height} stroke={colors[e.color]} strokeWidth={1.6} />);
    } else {
      lines.push(<path key={`p${i}`} d={`M${laneX(row.lane)} ${mid} C${laneX(row.lane)} ${mid + height * 0.5} ${laneX(e.to)} ${mid} ${laneX(e.to)} ${height}`} stroke={colors[e.color]} strokeWidth={1.6} fill="none" />);
    }
  });
  const merge = row.commit.parents.length > 1;
  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden>
      {lines}
      <circle cx={laneX(row.lane)} cy={mid} r={merge ? 3.5 : 4.5} fill={merge ? "var(--color-void)" : colors[row.color]} stroke={colors[row.color]} strokeWidth={merge ? 2 : 0} />
      {selected && <circle cx={laneX(row.lane)} cy={mid} r={7} fill="none" stroke="var(--color-cyan)" strokeWidth={1} />}
    </svg>
  );
});

function prevColor(prev: GraphRow | undefined, lane: number): number {
  const e = prev?.edges.find((x) => x.to === lane);
  return e ? e.color : 0;
}

export interface CommitGraphProps {
  commits: Commit[];
  selected?: string | null;
  onSelect?: (c: Commit) => void;
  onContextMenu?: (e: React.MouseEvent, c: Commit) => void;
  onNearEnd?: () => void;
  rowHeight?: number;
  showAuthor?: boolean;
  loadingMore?: boolean;
}

export function CommitGraph({ commits, selected, onSelect, onContextMenu, onNearEnd, rowHeight = 30, showAuthor, loadingMore }: CommitGraphProps) {
  const rows = useMemo(() => layoutGraph(commits), [commits]);
  const lanes = useMemo(() => Math.min(maxLanes(rows), 12), [rows]);
  const graphW = PAD * 2 + (lanes - 1) * LANE_W;
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, height: 400 });
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setView({ top: el.scrollTop, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const start = Math.max(0, Math.floor(view.top / rowHeight) - 8);
  const end = Math.min(rows.length, Math.ceil((view.top + view.height) / rowHeight) + 8);

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      setView({ top: el.scrollTop, height: el.clientHeight });
      if (onNearEnd && el.scrollTop + el.clientHeight > el.scrollHeight - rowHeight * 40) onNearEnd();
    },
    [onNearEnd, rowHeight],
  );

  // Keep the selected commit in view (keyboard navigation).
  useEffect(() => {
    const el = box.current;
    if (!el || !selected) return;
    const i = rows.findIndex((r) => r.commit.hash === selected);
    if (i < 0) return;
    const y = i * rowHeight;
    if (y < el.scrollTop) el.scrollTop = y;
    else if (y + rowHeight > el.scrollTop + el.clientHeight) el.scrollTop = y + rowHeight - el.clientHeight;
  }, [selected, rows, rowHeight]);

  return (
    <div ref={box} onScroll={onScroll} className="relative h-full overflow-y-auto overflow-x-hidden" role="listbox" aria-label="Commit graph">
      <div style={{ height: rows.length * rowHeight, position: "relative" }}>
        {rows.slice(start, end).map((row, k) => {
          const i = start + k;
          const c = row.commit;
          const isSel = selected === c.hash;
          return (
            <div
              key={c.hash}
              role="option"
              aria-selected={isSel}
              data-selected={isSel}
              onClick={() => onSelect?.(c)}
              onContextMenu={(e) => onContextMenu?.(e, c)}
              onMouseEnter={() => setHover(c.hash)}
              onMouseLeave={() => setHover(null)}
              className={cn("absolute inset-x-0 flex items-center gap-2 border-l-2 pr-3 text-[12px] transition-colors", isSel ? "border-cyan bg-cyan/[0.08]" : "border-transparent", hover === c.hash && !isSel && "bg-white/[0.03]")}
              style={{ top: i * rowHeight, height: rowHeight }}
            >
              <GraphCell row={row} prev={rows[i - 1]} height={rowHeight} width={graphW} selected={isSel} />
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {c.refs.map((r) => (
                  <RefBadge key={r.kind + r.name} r={r} />
                ))}
                <span className="selectable truncate text-ink">{c.subject}</span>
              </div>
              {showAuthor && <span className="w-32 shrink-0 truncate text-ink-dim">{c.author}</span>}
              <span className="mono w-16 shrink-0 text-right text-[11px] text-ink-faint">{c.short}</span>
              <span className="w-24 shrink-0 text-right text-[11px] text-ink-faint">{relativeTime(c.timestamp)}</span>
            </div>
          );
        })}
      </div>
      {loadingMore && <div className="mono sticky bottom-0 bg-panel/90 py-1 text-center text-[10px] tracking-wider text-ink-faint">LOADING MORE COMMITS…</div>}
      {rows.length === 0 && <div className="mono p-8 text-center text-[11px] tracking-wider text-ink-faint">NO COMMITS</div>}
    </div>
  );
}
