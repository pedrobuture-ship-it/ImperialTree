import { memo, useMemo } from "react";
import type { Hunk, ParsedDiff } from "@/lib/diff";
import { splitRows } from "@/lib/diff";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export interface HunkAction {
  label: string;
  danger?: boolean;
  run: (index: number) => void;
}

const bg = { add: "bg-ok/[0.12]", del: "bg-alert/[0.14]", context: "", meta: "" } as const;
const gutter = { add: "text-ok/80", del: "text-alert/80", context: "text-ink-faint", meta: "text-ink-faint" } as const;
const sign = { add: "+", del: "-", context: " ", meta: "" } as const;

const HunkBlock = memo(function HunkBlock({ hunk, index, mode, actions }: { hunk: Hunk; index: number; mode: "split" | "unified"; actions?: HunkAction[] }) {
  const rows = useMemo(() => (mode === "split" ? splitRows(hunk.lines) : []), [hunk, mode]);
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-y border-line bg-panel/95 px-3 py-1 backdrop-blur-sm">
        <span className="mono flex-1 truncate text-[11px] text-cyan/80">{hunk.header}</span>
        {actions?.map((a) => (
          <Button key={a.label} small variant={a.danger ? "danger" : "default"} onClick={() => a.run(index)}>
            {a.label}
          </Button>
        ))}
      </div>
      {mode === "unified" ? (
        hunk.lines.map((l, i) => (
          <div key={i} className={cn("mono flex text-[12px] leading-[20px]", bg[l.kind])}>
            <span className={cn("w-10 shrink-0 select-none pr-2 text-right", gutter[l.kind])}>{l.oldNo ?? ""}</span>
            <span className={cn("w-10 shrink-0 select-none pr-2 text-right", gutter[l.kind])}>{l.newNo ?? ""}</span>
            <span className={cn("w-4 shrink-0 select-none text-center", gutter[l.kind])}>{sign[l.kind]}</span>
            <span className="selectable whitespace-pre pr-4">{l.text}</span>
          </div>
        ))
      ) : (
        rows.map((r, i) => (
          <div key={i} className="mono grid grid-cols-2 text-[12px] leading-[20px]">
            {[r.left, r.right].map((l, side) => (
              <div key={side} className={cn("flex min-w-0", l ? bg[l.kind] : "bg-black/20", side === 0 && "border-r border-line")}>
                <span className={cn("w-10 shrink-0 select-none pr-2 text-right", l ? gutter[l.kind] : "")}>{(side === 0 ? l?.oldNo : l?.newNo) ?? ""}</span>
                <span className={cn("w-4 shrink-0 select-none text-center", l ? gutter[l.kind] : "")}>{l ? sign[l.kind] : ""}</span>
                <span className="selectable overflow-hidden whitespace-pre pr-2">{l?.text}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
});

export function DiffView({ diff, mode, actions, empty }: { diff: ParsedDiff; mode: "split" | "unified"; actions?: HunkAction[]; empty?: string }) {
  if (diff.binary) return <div className="mono p-6 text-center text-[11px] tracking-wider text-ink-faint">BINARY FILE — NO TEXT DIFF</div>;
  if (diff.hunks.length === 0) return <div className="mono p-6 text-center text-[11px] tracking-wider text-ink-faint">{empty ?? "NO TEXTUAL CHANGES"}</div>;
  return (
    <div className="min-w-0">
      {diff.hunks.map((h, i) => (
        <HunkBlock key={i} hunk={h} index={i} mode={mode} actions={actions} />
      ))}
    </div>
  );
}
