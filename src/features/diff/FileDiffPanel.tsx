import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CommandPanel, TerminalBadge } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { useRepo } from "@/stores/repo";
import { api, toGitError } from "@/lib/api";
import { hunkPatch, parseDiff, type ParsedDiff } from "@/lib/diff";
import { confirmDestructive, runOp } from "@/lib/ops";
import { statusLetter, statusTone } from "@/lib/files";
import { cn } from "@/lib/cn";
import { DiffView, type HunkAction } from "./DiffView";

const EMPTY: ParsedDiff = { header: "", hunks: [], binary: false };

export function FileDiffPanel({ className }: { className?: string }) {
  const root = useRepo((s) => s.repo?.root ?? "");
  const selection = useRepo((s) => s.selection);
  const entries = useRepo((s) => s.status?.entries);
  const revision = useRepo((s) => s.revision);
  const select = useRepo((s) => s.select);
  const [mode, setMode] = useState<"split" | "unified">("split");
  const [diff, setDiff] = useState<ParsedDiff>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => (entries ?? []).filter((e) => !e.conflicted), [entries]);
  const entry = selection ? entries?.find((e) => e.path === selection.path) : undefined;

  useEffect(() => {
    if (!selection) {
      setDiff(EMPTY);
      return;
    }
    let live = true;
    api
      .fileDiff(root, selection.path, selection.staged, selection.untracked)
      .then((text) => {
        if (!live) return;
        setDiff(parseDiff(text));
        setError(null);
      })
      .catch((e) => live && setError(toGitError(e).message));
    return () => {
      live = false;
    };
  }, [root, selection, revision]);

  const hunkOp = useCallback(
    (index: number, mode: "stage" | "unstage" | "discard") => {
      const patch = hunkPatch(diff, index);
      const label = { stage: "git apply --cached --recount -", unstage: "git apply --cached --reverse --recount -", discard: "git apply --reverse --recount -" }[mode];
      const go = () => void runOp(label, () => api.applyPatch(root, patch, mode));
      if (mode === "discard") {
        confirmDestructive({ title: "Discard hunk", command: label, impact: "This hunk will be removed from your working tree. This cannot be undone.", confirmLabel: "Discard hunk", onConfirm: go });
      } else go();
    },
    [diff, root],
  );

  const actions: HunkAction[] | undefined = !selection || selection.untracked ? undefined : selection.staged ? [{ label: "Unstage hunk", run: (i) => hunkOp(i, "unstage") }] : [{ label: "Stage hunk", run: (i) => hunkOp(i, "stage") }, { label: "Discard hunk", danger: true, run: (i) => hunkOp(i, "discard") }];

  const idx = selection ? list.findIndex((e) => e.path === selection.path) : -1;
  const move = (d: number) => {
    const next = list[idx + d];
    if (!next) return;
    const staged = next.index !== "." && !(selection && !selection.staged && next.worktree !== ".");
    select({ path: next.path, staged: next.untracked ? false : staged, untracked: next.untracked });
  };
  const letter = entry && selection ? statusLetter(entry, selection.staged) : "";

  return (
    <CommandPanel
      className={className}
      bodyClassName="flex min-h-0 flex-col"
      title={selection ? <span className="mono normal-case tracking-normal">{selection.path}</span> : "Diff"}
      badge={selection && <TerminalBadge tone={statusTone(letter)}>{selection.staged ? `STAGED ${letter}` : letter}</TerminalBadge>}
      actions={
        <>
          {selection && idx >= 0 && (
            <span className="mono mr-1 flex items-center gap-1 text-[11px] text-ink-dim">
              {idx + 1} of {list.length}
              <Button variant="ghost" icon small onClick={() => move(-1)} disabled={idx <= 0} aria-label="Previous file"><ChevronUp size={14} /></Button>
              <Button variant="ghost" icon small onClick={() => move(1)} disabled={idx >= list.length - 1} aria-label="Next file"><ChevronDown size={14} /></Button>
            </span>
          )}
          {(["split", "unified"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cn("h-6 border px-2.5 text-[11px] capitalize", mode === m ? "border-cyan-dim bg-cyan/10 text-cyan" : "border-line-strong text-ink-dim hover:text-ink")}>{m}</button>
          ))}
        </>
      }
    >
      <div className="min-h-0 flex-1 overflow-auto bg-base/60">
        {error ? (
          <div className="p-4 text-[12px] text-alert">{error}</div>
        ) : !selection ? (
          <div className="mono grid h-full place-items-center p-6 text-[11px] tracking-wider text-ink-faint">SELECT A FILE TO INSPECT ITS DIFF</div>
        ) : (
          <DiffView diff={diff} mode={mode} actions={actions} empty={selection.untracked ? "EMPTY FILE" : "NO TEXTUAL CHANGES (MODE OR RENAME ONLY)"} />
        )}
      </div>
    </CommandPanel>
  );
}
