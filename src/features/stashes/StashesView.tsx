import { Plus } from "lucide-react";
import { Page, Empty } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { TerminalBadge } from "@/components/ui/Panel";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { api } from "@/lib/api";
import { confirmDestructive, runOp } from "@/lib/ops";
import { relativeTime } from "@/lib/format";
import { line } from "@/lib/commands";

export function StashesView() {
  const root = useRepo((s) => s.repo?.root ?? "");
  const stashes = useRepo((s) => s.stashes);
  const openDialog = useUi((s) => s.openDialog);

  return (
    <Page title="Stashes" badge={<TerminalBadge tone="solid">{stashes.length}</TerminalBadge>} actions={<Button variant="primary" small onClick={() => openDialog({ kind: "createStash" })}><Plus size={13} /> Create stash</Button>}>
      {stashes.length === 0 && <Empty>NO STASHES</Empty>}
      {stashes.map((s) => (
        <div key={s.name} className="row !min-h-[48px]">
          <span className="mono w-24 shrink-0 text-[12px] text-cyan">{s.name}</span>
          <div className="min-w-0 flex-1">
            <div className="selectable truncate text-[13px]">{s.message}</div>
            <div className="mono text-[10px] text-ink-faint">{s.branch || "—"} · {relativeTime(s.timestamp)}</div>
          </div>
          <Button small onClick={() => void runOp(line("stash", "apply", s.name), () => api.stashApply(root, s.name), { success: `Applied ${s.name}` })}>Apply</Button>
          <Button small onClick={() => void runOp(line("stash", "pop", s.name), () => api.stashPop(root, s.name), { success: `Popped ${s.name}` })}>Pop</Button>
          <Button small variant="danger" onClick={() => confirmDestructive({ title: "Drop stash", command: line("stash", "drop", s.name), impact: `${s.name} “${s.message}” will be deleted. Its changes can only be recovered with git fsck.`, confirmLabel: "Drop stash", onConfirm: () => void runOp(line("stash", "drop", s.name), () => api.stashDrop(root, s.name), { success: `Dropped ${s.name}` }) })}>Drop</Button>
        </div>
      ))}
    </Page>
  );
}
