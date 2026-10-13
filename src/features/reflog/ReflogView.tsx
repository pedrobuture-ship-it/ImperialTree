import { useEffect, useState } from "react";
import { Page, Empty } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { TerminalBadge } from "@/components/ui/Panel";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { api } from "@/lib/api";
import { runAction } from "@/lib/ops";
import { clockTime, dayLabel } from "@/lib/format";
import type { ReflogEntry } from "@/types/git";

export function ReflogView() {
  const root = useRepo((s) => s.repo?.root ?? "");
  const revision = useRepo((s) => s.revision);
  const openDialog = useUi((s) => s.openDialog);
  const focusCommit = useUi((s) => s.focusCommit);
  const [entries, setEntries] = useState<ReflogEntry[]>([]);

  useEffect(() => {
    void runAction(() => api.reflog(root, 300)).then((e) => e && setEntries(e));
  }, [root, revision]);

  let lastDay = "";
  return (
    <Page title="Reflog" badge={<TerminalBadge tone="solid">{entries.length}</TerminalBadge>}>
      <div className="border-b border-line bg-cyan/[0.04] px-4 py-3 text-[12px] text-ink-dim">Every place HEAD has been. Nothing here resets or rewrites anything — use it to find a commit and branch from it. <span className="mono text-cyan">git reflog</span></div>
      {entries.length === 0 && <Empty>NO REFLOG ENTRIES</Empty>}
      <ol className="relative px-6 py-4">
        {entries.map((e) => {
          const day = dayLabel(e.timestamp);
          const header = day !== lastDay ? ((lastDay = day), <div className="tech-label -ml-2 pb-2 pt-3">{day}</div>) : null;
          return (
            <li key={e.selector}>
              {header}
              <div className="group relative flex gap-4 border-l border-line-strong pb-4 pl-5">
                <span className="absolute -left-[4px] top-1.5 size-[7px] bg-cyan" />
                <span className="mono w-12 shrink-0 pt-px text-[12px] text-ink-dim">{clockTime(e.timestamp)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><TerminalBadge tone={e.action === "reset" ? "red" : e.action === "commit" ? "green" : "cyan"}>{e.action}</TerminalBadge><span className="mono text-[11px] text-ink-faint">{e.selector}</span></div>
                  <div className="selectable mt-1 text-[13px]">{e.message}</div>
                  <div className="mono mt-0.5 text-[11px] text-ink-faint">{e.short}</div>
                </div>
                <div className="flex shrink-0 gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <Button small onClick={() => void navigator.clipboard.writeText(e.hash)}>Copy hash</Button>
                  <Button small onClick={() => focusCommit(e.hash)}>Inspect</Button>
                  <Button small onClick={() => openDialog({ kind: "createBranch", start: e.hash })}>Branch from here</Button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Page>
  );
}
