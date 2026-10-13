import { useEffect, useMemo, useState } from "react";
import { GripVertical } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button, Input, Select } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DangerPanel } from "@/components/ui/Panel";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { api, toGitError } from "@/lib/api";
import { preview } from "@/lib/commands";
import { cn } from "@/lib/cn";
import { CommandLine } from "@/features/dialogs/CommandLine";
import type { Commit, TodoItem } from "@/types/git";

const ACTIONS: TodoItem["action"][] = ["pick", "reword", "edit", "squash", "fixup", "drop"];
const tone: Record<TodoItem["action"], string> = { pick: "text-ink", reword: "text-cyan", edit: "text-warn", squash: "text-[#b073ff]", fixup: "text-[#b073ff]", drop: "text-alert" };

interface Row {
  commit: Commit;
  action: TodoItem["action"];
  message: string;
}

export function summarize(rows: Row[]): string[] {
  return rows.map((r) => `${r.action.padEnd(6)} ${r.commit.short} ${r.commit.subject}`);
}

export function RebaseDialog({ base: initial }: { base?: string }) {
  const root = useRepo((s) => s.repo?.root ?? "");
  const dirty = useRepo((s) => s.status?.entries.some((e) => !e.untracked) ?? false);
  const close = useUi((s) => s.closeDialog);
  const setView = useUi((s) => s.setView);
  const [base, setBase] = useState(initial ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [step, setStep] = useState<"edit" | "review">("edit");

  useEffect(() => {
    if (!base) return setRows([]);
    let live = true;
    const t = window.setTimeout(() => {
      api
        .rebaseCommits(root, base)
        .then((cs) => {
          if (!live) return;
          setRows(cs.map((commit) => ({ commit, action: "pick" as const, message: commit.subject })));
          setError(null);
        })
        .catch((e) => live && (setRows([]), setError(toGitError(e).message)));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [base, root]);

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const move = (from: number, to: number) =>
    setRows((rs) => {
      if (to < 0 || to >= rs.length || from === to) return rs;
      const next = [...rs];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });

  const problem = useMemo(() => {
    if (rows.length === 0) return "No commits in range.";
    if (rows[0].action === "squash" || rows[0].action === "fixup") return "The first commit cannot be squash or fixup.";
    if (rows.every((r) => r.action === "drop")) return "At least one commit must be kept.";
    if (rows.some((r) => r.action === "reword" && !r.message.trim())) return "A reworded commit needs a message.";
    return null;
  }, [rows]);

  const start = async () => {
    const items: TodoItem[] = rows.map((r) => ({ action: r.action, hash: r.commit.hash, message: r.action === "reword" ? r.message : undefined }));
    close();
    try {
      const out = await api.rebaseStart(root, base, items);
      useUi.getState().toast({ tone: out.stopped ? "warn" : "ok", title: out.stopped ? "REBASE PAUSED" : "OPERATION COMPLETE", detail: out.stopped ? "Resolve the stop to continue" : "Interactive rebase finished" });
      await useRepo.getState().refresh();
      if (out.stopped) setView("conflicts");
    } catch (e) {
      useUi.getState().openDialog({ kind: "error", error: toGitError(e) });
    }
  };

  return (
    <Dialog
      wide
      title="Interactive rebase"
      onClose={close}
      footer={
        step === "edit" ? (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" disabled={!!problem || dirty} onClick={() => setStep("review")}>Review operation</Button>
          </>
        ) : (
          <>
            <Button onClick={() => setStep("edit")}>Back</Button>
            <Button variant="danger" onClick={() => void start()}>Run rebase</Button>
          </>
        )
      }
    >
      {step === "edit" ? (
        <div className="space-y-4">
          {dirty && <Alert tone="warn" title="Working tree has changes">Commit or stash your changes before rebasing.</Alert>}
          <div className="flex items-center gap-3">
            <span className="tech-label shrink-0">Base</span>
            <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="main, a tag or a commit" className="mono" />
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <ul className="border border-line">
            {rows.map((r, i) => (
              <li
                key={r.commit.hash}
                draggable
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drag !== null && (move(drag, i), setDrag(null))}
                className={cn("flex items-center gap-2 border-b border-line px-2 py-1.5 last:border-0", drag === i && "opacity-40", r.action === "drop" && "bg-alert/5")}
              >
                <GripVertical size={14} className="cursor-grab text-ink-faint" aria-hidden />
                <Select className={cn("!h-7 !w-24 mono", tone[r.action])} value={r.action} onChange={(e) => update(i, { action: e.target.value as TodoItem["action"] })} aria-label={`Action for ${r.commit.short}`}>
                  {ACTIONS.map((a) => <option key={a}>{a}</option>)}
                </Select>
                <span className="mono w-14 shrink-0 text-[11px] text-ink-faint">{r.commit.short}</span>
                {r.action === "reword" ? (
                  <Input className="!h-7" value={r.message} onChange={(e) => update(i, { message: e.target.value })} aria-label="New message" />
                ) : (
                  <span className={cn("min-w-0 flex-1 truncate text-[12px]", r.action === "drop" && "text-ink-faint line-through")}>{r.commit.subject}</span>
                )}
                <Button variant="ghost" small onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up">↑</Button>
                <Button variant="ghost" small onClick={() => move(i, i + 1)} disabled={i === rows.length - 1} aria-label="Move down">↓</Button>
              </li>
            ))}
          </ul>
          {problem && base && !error && <div className="text-[11px] text-warn">{problem}</div>}
          <div className="text-[11px] text-ink-faint">Oldest commit first, as in Git’s todo list. Drag rows or use the arrows to reorder.</div>
        </div>
      ) : (
        <div className="space-y-4">
          <DangerPanel title="History rewrite">
            <div className="text-[13px]">This rewrites the commits listed below. If they were already pushed you will need to force-push. Recover with <span className="mono">git reflog</span> if needed.</div>
          </DangerPanel>
          <CommandLine command={preview.rebaseInteractive(base)} />
          <pre className="mono selectable max-h-64 overflow-auto border border-line bg-base p-3 text-[12px] leading-relaxed">{summarize(rows).join("\n")}</pre>
        </div>
      )}
    </Dialog>
  );
}
