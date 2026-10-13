import { Plus, Tag as TagIcon } from "lucide-react";
import { Page, Empty } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { TerminalBadge } from "@/components/ui/Panel";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { api } from "@/lib/api";
import { confirmDestructive, runOp } from "@/lib/ops";
import { relativeTime } from "@/lib/format";
import { line } from "@/lib/commands";

export function TagsView() {
  const root = useRepo((s) => s.repo?.root ?? "");
  const tags = useRepo((s) => s.tags);
  const remotes = useRepo((s) => s.remotes);
  const openDialog = useUi((s) => s.openDialog);
  const origin = remotes.find((r) => r.name === "origin")?.name ?? remotes[0]?.name;

  return (
    <Page title="Tags" badge={<TerminalBadge tone="solid">{tags.length}</TerminalBadge>} actions={<Button variant="primary" small onClick={() => openDialog({ kind: "createTag" })}><Plus size={13} /> Create tag</Button>}>
      {tags.length === 0 && <Empty>NO TAGS</Empty>}
      {tags.map((t) => (
        <div key={t.name} className="row !min-h-[44px]">
          <TagIcon size={15} className="text-cyan" />
          <span className="selectable w-44 shrink-0 truncate text-[13px] font-medium">{t.name}</span>
          <TerminalBadge tone={t.annotated ? "cyan" : "neutral"}>{t.annotated ? "annotated" : "lightweight"}</TerminalBadge>
          <span className="mono w-20 shrink-0 text-[11px] text-ink-dim">{t.commit}</span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-ink-faint">{t.message}</span>
          <span className="text-[11px] text-ink-faint">{relativeTime(t.timestamp)}</span>
          <Button small onClick={() => void runOp(line("switch", "--detach", t.name), () => api.checkoutCommit(root, t.name), { success: `HEAD at ${t.name}` })}>Checkout</Button>
          <Button small disabled={!origin} onClick={() => origin && void runOp(line("push", origin, `refs/tags/${t.name}`), () => api.pushTag(root, origin, t.name), { success: `Pushed ${t.name}` })}>Push</Button>
          <Button small variant="danger" onClick={() => confirmDestructive({ title: "Delete tag", command: line("tag", "-d", t.name), impact: `The local tag ${t.name} will be deleted. A tag already pushed to a remote is not removed there.`, confirmLabel: "Delete tag", onConfirm: () => void runOp(line("tag", "-d", t.name), () => api.deleteTag(root, t.name), { success: `Deleted ${t.name}` }) })}>Delete</Button>
        </div>
      ))}
    </Page>
  );
}
