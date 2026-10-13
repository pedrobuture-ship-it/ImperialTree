import { useEffect, useMemo, useState } from "react";
import { CommandPanel, DangerPanel, StatusIndicator, TechnicalLabel } from "@/components/ui/Panel";
import { Button, TextArea } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { api } from "@/lib/api";
import { runAction, runOp } from "@/lib/ops";
import { hasMarkers, parseConflicts, resolveSegments, type Resolution } from "@/lib/conflicts";
import { cn } from "@/lib/cn";
import type { ConflictFile } from "@/types/git";

const opLabel = { none: "", merge: "MERGE", rebase: "REBASE", cherryPick: "CHERRY-PICK", revert: "REVERT" } as const;

export function ConflictsView() {
  const root = useRepo((s) => s.repo?.root ?? "");
  const entries = useRepo((s) => s.status?.entries);
  const operation = useRepo((s) => s.operation);
  const revision = useRepo((s) => s.revision);
  const conflicted = useMemo(() => (entries ?? []).filter((e) => e.conflicted), [entries]);
  const [path, setPath] = useState<string | null>(null);
  const [file, setFile] = useState<ConflictFile | null>(null);
  const [choices, setChoices] = useState<Record<number, Resolution | undefined>>({});
  const [result, setResult] = useState("");
  const [edited, setEdited] = useState(false);

  const setView = useUi((s) => s.setView);
  const finished = operation === "none" && conflicted.length === 0;
  useEffect(() => {
    if (finished) setView("overview");
  }, [finished, setView]);

  useEffect(() => {
    if (!path || !conflicted.some((c) => c.path === path)) setPath(conflicted[0]?.path ?? null);
  }, [conflicted, path]);

  useEffect(() => {
    if (!path) return setFile(null);
    let live = true;
    void runAction(() => api.conflictRead(root, path)).then((f) => {
      if (!live || !f) return;
      setFile(f);
      setResult(f.merged);
      setChoices({});
      setEdited(false);
    });
    return () => {
      live = false;
    };
  }, [root, path, revision]);

  const segs = useMemo(() => parseConflicts(file?.merged ?? ""), [file]);
  const blocks = segs.filter((s) => s.type === "conflict");

  const choose = (i: number | "all", r: Resolution) => {
    const next = i === "all" ? Object.fromEntries(blocks.map((_, k) => [k, r])) : { ...choices, [i]: r };
    setChoices(next);
    setResult(resolveSegments(segs, next));
    setEdited(false);
  };

  const unresolved = hasMarkers(result);
  const markResolved = async () => {
    if (!path) return;
    const saved = await runAction(async () => {
      await api.conflictWrite(root, path, result);
      return true;
    });
    if (saved) await runOp(`git add ${path}`, () => api.conflictResolve(root, path), { success: `${path} marked resolved` });
  };

  const finish = () => void runOp(operation === "merge" ? "git commit --no-edit" : `git ${operation === "cherryPick" ? "cherry-pick" : operation} --continue`, () => api.operationContinue(root), { success: "Operation continued" });
  const abort = () => void runOp(`git ${operation === "cherryPick" ? "cherry-pick" : operation} --abort`, () => api.operationAbort(root), { success: "Operation aborted" });

  return (
    <div className="grid h-full min-h-0 grid-cols-[300px_minmax(0,1fr)] gap-3 p-3">
      <div className="flex min-h-0 flex-col gap-3">
        <CommandPanel title="Conflicts" bodyClassName="min-h-0 overflow-y-auto">
          {conflicted.length > 0 && (
            <div className="border-b border-alert-dim bg-alert/10 p-3">
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-alert"><StatusIndicator tone="alert" pulse />CONFLICT DETECTED</div>
              <div className="mt-1 text-[12px] text-ink-dim">{conflicted.length} file{conflicted.length === 1 ? "" : "s"} require resolution.</div>
            </div>
          )}
          {conflicted.map((c) => (
            <div key={c.path} className="row" data-selected={c.path === path} onClick={() => setPath(c.path)}>
              <span className="size-1.5 bg-alert" />
              <span className="mono selectable min-w-0 flex-1 truncate text-[12px]">{c.path}</span>
              <span className="mono text-[10px] text-alert">{c.index}{c.worktree}</span>
            </div>
          ))}
          {conflicted.length === 0 && <div className="mono p-6 text-center text-[11px] tracking-wider text-ink-faint">NO CONFLICTED FILES</div>}
        </CommandPanel>
        {operation !== "none" && (
          <DangerPanel title={`${opLabel[operation]} IN PROGRESS`}>
            <div className="space-y-2">
              <div className="text-[12px] text-ink-dim">{conflicted.length === 0 ? "All conflicts are resolved. Continue to finish the operation." : "Resolve every file, then continue."}</div>
              <div className="flex gap-2">
                <Button variant="primary" disabled={conflicted.length > 0} onClick={finish}>Continue</Button>
                <Button variant="danger" onClick={abort}>Abort</Button>
              </div>
            </div>
          </DangerPanel>
        )}
      </div>

      <CommandPanel title={path ? <span className="mono normal-case tracking-normal">{path}</span> : "Merge conflict editor"} bodyClassName="flex min-h-0 flex-col" actions={path && file ? (
        <>
          <Button small onClick={() => choose("all", "ours")} disabled={blocks.length === 0}>All ours</Button>
          <Button small onClick={() => choose("all", "theirs")} disabled={blocks.length === 0}>All theirs</Button>
          <Button small variant="primary" disabled={unresolved} onClick={() => void markResolved()}>Mark resolved</Button>
        </>
      ) : undefined}>
        {!file ? (
          <div className="mono grid h-full place-items-center text-[11px] tracking-wider text-ink-faint">SELECT A CONFLICTED FILE</div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3 p-3">
            <div className="grid min-h-0 grid-cols-2 gap-3">
              <SidePanel label="Ours" tone="text-cyan" text={file.ours} />
              <SidePanel label="Theirs" tone="text-warn" text={file.theirs} />
            </div>
            <div className="flex min-h-0 flex-col gap-2">
              {blocks.length > 0 && (
                <div className="flex max-h-24 flex-wrap items-center gap-2 overflow-y-auto">
                  {blocks.map((_, i) => (
                    <span key={i} className="flex items-center gap-1 border border-line px-2 py-1 text-[11px]">
                      <span className="mono text-ink-faint">#{i + 1}</span>
                      {(["ours", "theirs", "both"] as const).map((r) => (
                        <button key={r} type="button" onClick={() => choose(i, r)} className={cn("px-1.5 uppercase tracking-wider", choices[i] === r ? "bg-cyan/20 text-cyan" : "text-ink-dim hover:text-ink")}>{r === "ours" ? "Accept ours" : r === "theirs" ? "Accept theirs" : "Accept both"}</button>
                      ))}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2"><TechnicalLabel>Result</TechnicalLabel>{unresolved && <span className="text-[11px] text-alert">conflict markers remain</span>}{edited && <span className="text-[11px] text-ink-faint">edited manually</span>}</div>
              <TextArea value={result} onChange={(e) => { setResult(e.target.value); setEdited(true); }} className="mono selectable min-h-0 flex-1 !text-[12px]" aria-label="Result" wrap="off" />
              {unresolved && <Alert tone="warn">Markers are shown as-is so nothing is hidden. Pick a resolution or edit the result, then mark it resolved.</Alert>}
            </div>
          </div>
        )}
      </CommandPanel>
    </div>
  );
}

function SidePanel({ label, tone, text }: { label: string; tone: string; text: string | null }) {
  return (
    <div className="flex min-h-0 flex-col border border-line">
      <div className={cn("border-b border-line px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em]", tone)}>{label}</div>
      <pre className="mono selectable min-h-0 flex-1 overflow-auto p-3 text-[12px] leading-[20px]">{text ?? "(file does not exist on this side)"}</pre>
    </div>
  );
}
