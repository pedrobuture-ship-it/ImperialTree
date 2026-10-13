import { FolderGit2, Lock, Plus } from "lucide-react";
import { Page, Empty } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { StatusIndicator, TechnicalLabel, TerminalBadge } from "@/components/ui/Panel";
import { CommandLine } from "@/features/dialogs/CommandLine";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { api } from "@/lib/api";
import { confirmDestructive, runOp } from "@/lib/ops";
import { preview } from "@/lib/commands";
import { tildePath } from "@/lib/format";

export function WorktreesView() {
  const root = useRepo((s) => s.repo?.root ?? "");
  const worktrees = useRepo((s) => s.worktrees);
  const openRepo = useRepo((s) => s.open);
  const openDialog = useUi((s) => s.openDialog);
  const hasPrunable = worktrees.some((w) => w.prunable);

  return (
    <Page
      title="Worktrees"
      badge={<TerminalBadge tone="solid">{worktrees.length}</TerminalBadge>}
      actions={
        <>
          <Button small disabled={!hasPrunable} onClick={() => void runOp("git worktree prune -v", () => api.pruneWorktrees(root), { success: "Pruned stale worktrees" })}>Prune</Button>
          <Button variant="primary" small onClick={() => openDialog({ kind: "createWorktree" })}><Plus size={13} /> Create worktree</Button>
        </>
      }
    >
      <div className="border-b border-line bg-cyan/[0.04] px-4 py-3 text-[12px] text-ink-dim">
        Check out several branches at once, each in its own folder, sharing one repository. Equivalent to <span className="mono text-cyan">git worktree add ../feature-auth feature/auth</span>.
      </div>
      {worktrees.length === 0 && <Empty>NO WORKTREES</Empty>}
      <div className="grid gap-3 p-4 [grid-template-columns:repeat(auto-fill,minmax(420px,1fr))]">
        {worktrees.map((w) => (
          <article key={w.path} className="panel bracketed anim-in p-4">
            <div className="flex items-start gap-3">
              <FolderGit2 size={20} className={w.main ? "text-ok" : "text-ink-dim"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold">{w.path.split("/").pop()}</span>
                  {w.main && <TerminalBadge tone="green">MAIN</TerminalBadge>}
                  {w.locked && <TerminalBadge tone="warn"><Lock size={10} /> locked</TerminalBadge>}
                  {w.prunable && <TerminalBadge tone="red">stale</TerminalBadge>}
                </div>
                <div className="mono selectable truncate text-[11px] text-ink-faint" title={w.path}>{tildePath(w.path)}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div><TechnicalLabel>Branch</TechnicalLabel><div className="mono mt-0.5 truncate text-[12px] text-cyan">{w.branch ?? (w.detached ? "detached" : "—")}</div></div>
              <div><TechnicalLabel>HEAD</TechnicalLabel><div className="mono mt-0.5 text-[12px]">{w.head.slice(0, 7)}</div></div>
              <div><TechnicalLabel>Status</TechnicalLabel><div className="mt-0.5"><StatusIndicator tone={w.dirty ? "alert" : "ok"} label={w.dirty === null ? "unknown" : w.dirty ? `${w.dirty} changes` : "clean"} /></div></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button small disabled={w.prunable} onClick={() => void openRepo(w.path)}>Open worktree</Button>
              <Button small disabled={w.main} variant="danger" onClick={() => confirmDestructive({
                title: "Remove worktree",
                command: preview.worktreeRemove(w.path, !!w.dirty),
                impact: w.dirty ? `${w.dirty} uncommitted change${w.dirty === 1 ? "" : "s"} in this worktree will be lost (--force).` : "The worktree folder is deleted. The branch and its commits are kept.",
                confirmLabel: "Remove worktree",
                onConfirm: () => void runOp(preview.worktreeRemove(w.path, !!w.dirty), () => api.removeWorktree(root, w.path, !!w.dirty), { success: "Worktree removed" }),
              })}>Remove</Button>
            </div>
          </article>
        ))}
      </div>
      <div className="px-4 pb-4"><CommandLine label="Create a worktree for a new branch" command={preview.worktreeAdd("../feature-auth", "feature/auth", true)} /></div>
    </Page>
  );
}
