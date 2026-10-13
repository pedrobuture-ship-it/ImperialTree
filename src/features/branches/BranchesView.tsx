import { useState } from "react";
import { ArrowDown, ArrowUp, GitBranch, Plus } from "lucide-react";
import { Page, Empty } from "@/components/ui/Page";
import { Button, Input } from "@/components/ui/Button";
import { TerminalBadge, TechnicalLabel } from "@/components/ui/Panel";
import { useContextMenu } from "@/components/ui/Menu";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { relativeTime } from "@/lib/format";
import { branchMenu } from "./menu";
import type { Branch } from "@/types/git";

export function BranchesView() {
  const root = useRepo((s) => s.repo?.root ?? "");
  const branches = useRepo((s) => s.branches);
  const openDialog = useUi((s) => s.openDialog);
  const focusCommit = useUi((s) => s.focusCommit);
  const menu = useContextMenu();
  const [filter, setFilter] = useState("");
  const match = (b: Branch) => b.name.toLowerCase().includes(filter.toLowerCase());
  const local = branches.filter((b) => !b.remote && match(b));
  const remote = branches.filter((b) => b.remote && match(b));

  const row = (b: Branch) => (
    <div key={b.fullName} className="row group" data-selected={b.current} onContextMenu={(e) => menu.open(e, branchMenu(b, root))} onDoubleClick={() => branchMenu(b, root)[0].onSelect()}>
      <GitBranch size={15} className={b.current ? "text-cyan" : "text-ink-faint"} />
      <span className="selectable min-w-[200px] text-[13px]">{b.name}</span>
      {b.current && <TerminalBadge tone="cyan">HEAD</TerminalBadge>}
      {!b.remote && b.upstream && <span className="mono text-[11px] text-ink-faint">→ {b.upstream}</span>}
      {(b.ahead > 0 || b.behind > 0) && (
        <span className="mono flex items-center gap-2 text-[11px]">
          {b.ahead > 0 && <span className="flex items-center text-ok"><ArrowUp size={11} />{b.ahead}</span>}
          {b.behind > 0 && <span className="flex items-center text-warn"><ArrowDown size={11} />{b.behind}</span>}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-faint">{b.subject}</span>
      <span className="text-[11px] text-ink-faint">{relativeTime(b.timestamp)}</span>
      <Button variant="ghost" small onClick={() => focusCommit(b.hash)}>History</Button>
      <Button variant="ghost" small onClick={(e) => menu.open(e, branchMenu(b, root))}>Actions</Button>
    </div>
  );

  return (
    <Page title="Branches" badge={<TerminalBadge tone="solid">{local.length}</TerminalBadge>} actions={<Button variant="primary" small onClick={() => openDialog({ kind: "createBranch" })}><Plus size={13} /> Create branch</Button>}>
      <div className="border-b border-line p-3"><Input placeholder="Filter branches" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter branches" /></div>
      <div className="px-3 pb-1 pt-3"><TechnicalLabel>Local</TechnicalLabel></div>
      {local.map(row)}
      {local.length === 0 && <Empty>NO LOCAL BRANCHES</Empty>}
      <div className="px-3 pb-1 pt-4"><TechnicalLabel>Remote</TechnicalLabel></div>
      {remote.map(row)}
      {remote.length === 0 && <Empty>NO REMOTE BRANCHES — FETCH FROM A REMOTE FIRST</Empty>}
      {menu.element}
    </Page>
  );
}
