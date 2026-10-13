import { FolderOpen, GitFork, X } from "lucide-react";
import { CommandPanel, TechnicalLabel, TerminalBadge } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";
import { useSettings } from "@/stores/settings";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { relativeTime, tildePath } from "@/lib/format";
import { useOpenRepositoryDialog } from "@/hooks/useOpenRepository";

export function Home() {
  const recents = useSettings((s) => s.recents);
  const remove = useSettings((s) => s.removeRecent);
  const openRepo = useRepo((s) => s.open);
  const openDialog = useUi((s) => s.openDialog);
  const pick = useOpenRepositoryDialog();

  return (
    <div className="app-grid h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[860px] flex-col gap-6 px-6 py-12">
        <div className="flex items-center gap-5">
          <Logo size={56} />
          <div>
            <h1 className="text-[28px] font-semibold tracking-[0.28em]">IMPERIAL TERMINAL</h1>
            <p className="mt-1 text-[13px] text-ink-dim">A Linux-first Git client that doesn’t hide Git.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" className="!h-10 !px-5" onClick={() => void pick()}>
            <FolderOpen size={15} /> Open repository <span className="kbd ml-1">Ctrl O</span>
          </Button>
          <Button className="!h-10 !px-5" onClick={() => openDialog({ kind: "clone" })}>
            <GitFork size={15} /> Clone repository
          </Button>
        </div>
        <CommandPanel title="Recent repositories" badge={<TerminalBadge>{recents.length}</TerminalBadge>}>
          {recents.length === 0 ? (
            <div className="mono p-8 text-center text-[11px] tracking-wider text-ink-faint">NO RECENT REPOSITORIES — OPEN OR CLONE ONE TO BEGIN</div>
          ) : (
            <ul>
              {recents.map((r) => (
                <li key={r.path} className="group flex items-center gap-4 border-b border-line px-4 py-3 last:border-0 hover:bg-raised">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-4 text-left" onClick={() => void openRepo(r.path)}>
                    <FolderOpen size={18} className="shrink-0 text-ink-faint" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium">{r.name}</div>
                      <div className="mono truncate text-[11px] text-ink-faint">{tildePath(r.path)}</div>
                    </div>
                    {r.branch && <TerminalBadge tone="cyan">{r.branch}</TerminalBadge>}
                    <div className="w-28 text-right">
                      <TechnicalLabel>Last opened</TechnicalLabel>
                      <div className="text-[12px] text-ink-dim">{relativeTime(Math.floor(r.lastOpened / 1000))}</div>
                    </div>
                  </button>
                  <button type="button" aria-label={`Remove ${r.name} from recents`} className="text-ink-faint opacity-0 hover:text-alert group-hover:opacity-100" onClick={() => remove(r.path)}>
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CommandPanel>
        <p className="mono text-[11px] tracking-wide text-ink-faint">No account. No telemetry. Uses the Git installed on this machine.</p>
      </div>
    </div>
  );
}
