import { ChevronDown, FolderOpen, GitBranch, MoreVertical, Search, SquareTerminal, Code2, Folder, Activity, X } from "lucide-react";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { useSettings } from "@/stores/settings";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Menu";
import { api } from "@/lib/api";
import { runAction } from "@/lib/ops";
import { tildePath } from "@/lib/format";
import { useOpenRepositoryDialog } from "@/hooks/useOpenRepository";

export function Header() {
  const repo = useRepo((s) => s.repo);
  const close = useRepo((s) => s.close);
  const status = useRepo((s) => s.status);
  const setPalette = useUi((s) => s.setPalette);
  const setView = useUi((s) => s.setView);
  const editor = useSettings((s) => s.editor);
  const terminal = useSettings((s) => s.terminal);
  const pickRepository = useOpenRepositoryDialog();
  if (!repo) return null;
  const branch = status?.detached ? `(detached ${status.oid?.slice(0, 7) ?? ""})` : (status?.branch ?? repo.branch ?? "—");

  return (
    <div className="flex h-14 shrink-0 items-center gap-4 border-b border-line px-4">
      <div className="flex items-center gap-2.5">
        <FolderOpen size={20} className="text-ink-dim" />
        <span className="text-[19px] font-semibold tracking-wide">{repo.name}</span>
      </div>
      <button
        type="button"
        onClick={() => setPalette("branches")}
        className="flex h-9 min-w-[168px] items-center gap-2 border border-line-strong bg-panel px-3 text-[13px] hover:border-cyan-dim"
        aria-label="Switch branch"
      >
        <GitBranch size={14} className="text-cyan" />
        <span className="flex-1 truncate text-left">{branch}</span>
        <ChevronDown size={14} className="text-ink-faint" />
      </button>
      <div className="mono flex min-w-0 items-center gap-2 text-[12px] text-ink-dim">
        <Folder size={14} className="shrink-0 text-ink-faint" />
        <span className="selectable truncate" title={repo.root}>{tildePath(repo.root)}</span>
      </div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => setPalette("commands")}
        className="flex h-9 w-[min(34vw,420px)] items-center gap-2 border border-line-strong bg-panel px-3 text-left text-[12px] text-ink-faint hover:border-cyan-dim"
      >
        <Search size={14} />
        <span className="flex-1">Search commits, files, branches…</span>
        <span className="kbd">Ctrl K</span>
      </button>
      <div className="flex items-center gap-1">
        <Button variant="ghost" icon tip="Open terminal here" onClick={() => void runAction(() => api.openTerminal(repo.root, terminal ?? undefined))}>
          <SquareTerminal size={16} />
        </Button>
        <Button variant="ghost" icon tip="Open repository in editor" onClick={() => void runAction(() => api.openInEditor(repo.root, editor ?? undefined))}>
          <Code2 size={16} />
        </Button>
        <Button variant="ghost" icon tip="Repository health" onClick={() => setView("health")}>
          <Activity size={16} />
        </Button>
        <Dropdown
          trigger={({ onClick }) => (
            <Button variant="ghost" icon tip="More" onClick={onClick}>
              <MoreVertical size={16} />
            </Button>
          )}
          items={[
            { label: "Open another repository…", onSelect: () => void pickRepository() },
            { label: "Reveal in file manager", onSelect: () => void runAction(() => api.reveal(repo.root)) },
            { label: "Keyboard shortcuts", onSelect: () => useUi.getState().openDialog({ kind: "shortcuts" }) },
            { label: "Close repository", icon: <X size={13} />, separatorBefore: true, onSelect: close },
          ]}
        />
      </div>
    </div>
  );
}
