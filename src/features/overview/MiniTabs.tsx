import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { CommandPanel, StatusIndicator } from "@/components/ui/Panel";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { api } from "@/lib/api";
import { clockTime, tildePath } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ReflogEntry } from "@/types/git";

/** Compact Worktrees / Reflog tabs shown at the bottom right of the overview. */
export function MiniTabs({ className }: { className?: string }) {
  const [tab, setTab] = useState<"worktrees" | "reflog">("worktrees");
  const worktrees = useRepo((s) => s.worktrees);
  const root = useRepo((s) => s.repo?.root ?? "");
  const revision = useRepo((s) => s.revision);
  const openDialog = useUi((s) => s.openDialog);
  const setView = useUi((s) => s.setView);
  const [reflog, setReflog] = useState<ReflogEntry[]>([]);

  useEffect(() => {
    if (tab === "reflog") api.reflog(root, 8).then(setReflog).catch(() => setReflog([]));
  }, [tab, root, revision]);

  return (
    <CommandPanel className={className} bodyClassName="flex min-h-0 flex-col">
      <div className="flex h-9 items-center border-b border-line px-2">
        {(["worktrees", "reflog"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn("h-full px-3 text-[11px] font-bold uppercase tracking-[0.14em]", tab === t ? "border-b-2 border-cyan text-ink" : "text-ink-faint hover:text-ink-dim")}>
            {t} {t === "worktrees" && <span className="mono ml-1 text-ink-dim">{worktrees.length}</span>}
          </button>
        ))}
        <span className="flex-1" />
        <button type="button" className="text-[10px] uppercase tracking-wider text-ink-faint hover:text-cyan" onClick={() => setView(tab)}>open</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "worktrees" ? (
          <>
            {worktrees.map((w) => (
              <div key={w.path} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
                <StatusIndicator tone={w.main ? "ok" : "idle"} />
                <span className="w-24 shrink-0 truncate">{w.path.split("/").pop()}</span>
                <span className="mono min-w-0 flex-1 truncate text-[11px] text-ink-faint" title={w.path}>{tildePath(w.path)}</span>
                <span className="mono text-[11px] text-ink-dim">{w.branch ?? "detached"}</span>
              </div>
            ))}
            <button type="button" onClick={() => openDialog({ kind: "createWorktree" })} className="flex items-center gap-2 px-3 py-2 text-[12px] text-cyan hover:bg-cyan/10">
              <Plus size={13} /> New Worktree
            </button>
          </>
        ) : (
          reflog.map((r) => (
            <div key={r.selector} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
              <span className="mono text-[11px] text-ink-faint">{clockTime(r.timestamp)}</span>
              <span className="mono w-16 shrink-0 text-[11px] uppercase text-cyan">{r.action}</span>
              <span className="min-w-0 flex-1 truncate text-ink-dim">{r.message}</span>
            </div>
          ))
        )}
      </div>
    </CommandPanel>
  );
}
