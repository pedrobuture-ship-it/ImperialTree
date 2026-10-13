import { Activity, Clock, FolderGit2, GitBranch, Home, Settings, SquareTerminal, History, Cloud, GitCompare, type LucideIcon } from "lucide-react";
import { useRepo } from "@/stores/repo";
import { useUi, type View } from "@/stores/ui";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/Logo";
import { TerminalBadge } from "@/components/ui/Panel";
import { useContextMenu } from "@/components/ui/Menu";
import { branchMenu } from "@/features/branches/menu";

function NavItem({ icon: Icon, label, view, count, danger }: { icon: LucideIcon; label: string; view: View; count?: number; danger?: boolean }) {
  const current = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const active = current === view;
  return (
    <button
      type="button"
      onClick={() => setView(view)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 w-full items-center gap-3 border-l-2 px-4 text-left text-[13px] transition-colors",
        active ? "border-cyan bg-cyan/10 text-ink" : "border-transparent text-ink-dim hover:bg-raised hover:text-ink",
      )}
    >
      <Icon size={16} className={active ? "text-cyan" : "text-ink-faint"} />
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={cn("mono grid min-w-5 place-items-center border px-1.5 text-[10px]", danger ? "border-alert-dim text-alert" : "border-line-strong text-ink-dim")}>{count}</span>
      )}
    </button>
  );
}

function SectionHeader({ label, view, count }: { label: string; view: View; count?: number }) {
  const setView = useUi((s) => s.setView);
  const active = useUi((s) => s.view) === view;
  return (
    <button type="button" onClick={() => setView(view)} className={cn("flex w-full items-center justify-between px-4 pb-1 pt-4 text-left", active && "text-cyan")}>
      <span className="tech-label !text-inherit">{label}</span>
      {count !== undefined && <span className="mono text-[10px] text-ink-faint">{count}</span>}
    </button>
  );
}

export function Sidebar() {
  const repo = useRepo((s) => s.repo);
  const status = useRepo((s) => s.status);
  const branches = useRepo((s) => s.branches);
  const remotes = useRepo((s) => s.remotes);
  const stashes = useRepo((s) => s.stashes);
  const tags = useRepo((s) => s.tags);
  const worktrees = useRepo((s) => s.worktrees);
  const setView = useUi((s) => s.setView);
  const menu = useContextMenu();
  const local = branches.filter((b) => b.remote === false);
  const changes = status?.entries.length ?? 0;
  const conflicts = status?.entries.filter((e) => e.conflicted).length ?? 0;

  return (
    <aside className="flex w-[246px] shrink-0 flex-col border-r border-line bg-base">
      <nav className="min-h-0 flex-1 overflow-y-auto pb-2">
        <NavItem icon={Home} label="Home" view="home" />
        {repo && (
          <>
            <div className="tech-label px-4 pb-1 pt-4">▸ Repository</div>
            <NavItem icon={FolderGit2} label="Overview" view="overview" />
            <NavItem icon={GitCompare} label="Changes" view="changes" count={changes} />
            {conflicts > 0 && <NavItem icon={Activity} label="Conflicts" view="conflicts" count={conflicts} danger />}
            <NavItem icon={History} label="History" view="history" />

            <SectionHeader label="Branches" view="branches" count={local.length} />
            {local.slice(0, 8).map((b) => (
              <button
                key={b.name}
                type="button"
                onDoubleClick={() => branchMenu(b, repo.root)[0]?.onSelect()}
                onContextMenu={(e) => menu.open(e, branchMenu(b, repo.root))}
                onClick={() => setView("branches")}
                className="flex h-8 w-full items-center gap-3 px-4 text-left text-[13px] text-ink-dim hover:bg-raised hover:text-ink"
                title="Double-click to checkout"
              >
                <GitBranch size={15} className={b.current ? "text-cyan" : "text-ink-faint"} />
                <span className={cn("flex-1 truncate", b.current && "text-ink")}>{b.name}</span>
                {b.current && <TerminalBadge tone="cyan">HEAD</TerminalBadge>}
              </button>
            ))}
            {local.length > 8 && (
              <button type="button" onClick={() => setView("branches")} className="px-4 py-1 text-[11px] text-ink-faint hover:text-cyan">
                + {local.length - 8} more
              </button>
            )}

            <SectionHeader label="Remotes" view="remotes" count={remotes.length} />
            {remotes.map((r) => (
              <button key={r.name} type="button" onClick={() => setView("remotes")} className="flex h-8 w-full items-center gap-3 px-4 text-left text-[13px] text-ink-dim hover:bg-raised hover:text-ink">
                <Cloud size={15} className="text-ink-faint" />
                <span className="truncate">{r.name}</span>
              </button>
            ))}
            <SectionHeader label="Stashes" view="stashes" count={stashes.length} />
            <SectionHeader label="Tags" view="tags" count={tags.length} />
            <SectionHeader label="Worktrees" view="worktrees" count={worktrees.length} />

            <div className="tech-label px-4 pb-1 pt-5">Tools</div>
            <NavItem icon={SquareTerminal} label="Terminal" view="terminal" />
            <NavItem icon={Clock} label="Reflog" view="reflog" />
            <NavItem icon={Activity} label="Repository Health" view="health" />
          </>
        )}
      </nav>
      <div className="border-t border-line">
        <NavItem icon={Settings} label="Settings" view="settings" />
        <button type="button" onClick={() => setView("about")} className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left hover:bg-raised">
          <Logo size={24} />
          <div className="leading-tight">
            <div className="mono text-[10px] tracking-[0.2em] text-ink-dim">IMPERIAL TERMINAL</div>
            <div className="mono text-[9px] tracking-[0.14em] text-ink-faint">GIT WITHOUT THE ABSTRACTION WALL.</div>
          </div>
        </button>
      </div>
      {menu.element}
    </aside>
  );
}
