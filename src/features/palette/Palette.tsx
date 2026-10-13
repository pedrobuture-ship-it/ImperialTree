import { useEffect, useMemo, useRef, useState } from "react";
import { GitBranch, Search, Terminal } from "lucide-react";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { useSettings } from "@/stores/settings";
import { fuzzyFilter } from "@/lib/fuzzy";
import { api } from "@/lib/api";
import { preview } from "@/lib/commands";
import { runAction, runOp } from "@/lib/ops";
import { cn } from "@/lib/cn";
import { useOpenRepositoryDialog } from "@/hooks/useOpenRepository";

interface Item {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
  icon?: React.ReactNode;
}

export function Palette() {
  const mode = useUi((s) => s.palette);
  const setPalette = useUi((s) => s.setPalette);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const repo = useRepo((s) => s.repo);
  const branches = useRepo((s) => s.branches);
  const status = useRepo((s) => s.status);
  const hasUpstream = !!status?.upstream;
  const recentBranches = useSettings((s) => s.recentBranches);
  const pick = useOpenRepositoryDialog();

  useEffect(() => {
    if (mode) {
      setQuery("");
      setActive(0);
      window.setTimeout(() => input.current?.focus(), 0);
    }
  }, [mode]);

  const items = useMemo<Item[]>(() => {
    const close = () => useUi.getState().setPalette(null);
    const ui = useUi.getState();
    if (mode === "branches" && repo) {
      const rank = (n: string) => {
        const i = recentBranches.indexOf(n);
        return i === -1 ? 99 : i;
      };
      return [...branches]
        .sort((a, b) => Number(b.current) - Number(a.current) || rank(a.name) - rank(b.name))
        .map((b) => ({
          id: b.fullName,
          label: b.name,
          group: b.current ? "current" : recentBranches.includes(b.name) ? "recent" : b.remote ? "remote" : "local",
          hint: b.subject,
          icon: <GitBranch size={14} className={b.current ? "text-cyan" : "text-ink-faint"} />,
          run: () => {
            close();
            useSettings.getState().pushRecentBranch(b.name);
            void runOp(preview.checkout(b.name), () => api.checkout(repo.root, b.name), { success: `Switched to ${b.name}` });
          },
        }));
    }
    const base: Item[] = [{ id: "open", label: "Open Repository", group: "Repository", hint: "Ctrl O", run: () => { close(); void pick(); } }];
    if (!repo) return base;
    const go = (label: string, view: Parameters<typeof ui.setView>[0], hint?: string): Item => ({ id: `go-${view}`, label, group: "Navigate", hint, run: () => { close(); ui.setView(view); } });
    const remote = status?.upstream?.split("/")[0] ?? useRepo.getState().remotes[0]?.name ?? "origin";
    const branch = status?.branch ?? "";
    return [
      ...base,
      { id: "switch", label: "Switch Branch", group: "Branches", hint: "Ctrl Shift P", run: () => ui.setPalette("branches") },
      { id: "create-branch", label: "Create Branch", group: "Branches", run: () => { close(); ui.openDialog({ kind: "createBranch" }); } },
      { id: "fetch", label: "Fetch", group: "Remote", hint: preview.fetch(remote), run: () => { close(); void runOp(preview.fetch(remote), () => api.fetch(repo.root, remote), { success: `Fetched ${remote}` }); } },
      { id: "pull", label: "Pull", group: "Remote", hint: preview.pull(remote, false), run: () => { close(); void runOp(preview.pull(remote, false), () => api.pull(repo.root, remote, false), { success: "Pulled" }); } },
      { id: "push", label: "Push", group: "Remote", hint: preview.push(remote, branch, !hasUpstream), run: () => { close(); void runOp(preview.push(remote, branch, !hasUpstream), () => api.push(repo.root, remote, branch, !hasUpstream), { success: "Pushed" }); } },
      { id: "stash", label: "Stash", group: "Changes", run: () => { close(); ui.openDialog({ kind: "createStash" }); } },
      { id: "commit", label: "Commit", group: "Changes", hint: "Ctrl Enter", run: () => { close(); ui.setView("overview"); window.setTimeout(() => window.dispatchEvent(new Event("it:focus-commit")), 50); } },
      { id: "terminal", label: "Open Terminal", group: "Tools", icon: <Terminal size={14} />, run: () => { close(); void runAction(() => api.openTerminal(repo.root, useSettings.getState().terminal ?? undefined)); } },
      { id: "editor", label: "Open Editor", group: "Tools", run: () => { close(); void runAction(() => api.openInEditor(repo.root, useSettings.getState().editor ?? undefined)); } },
      { id: "search", label: "Search Commit", group: "Navigate", hint: "Ctrl F", run: () => { close(); ui.setView("history"); } },
      { id: "reflog", label: "View Reflog", group: "Navigate", run: () => { close(); ui.setView("reflog"); } },
      { id: "worktree", label: "Create Worktree", group: "Branches", run: () => { close(); ui.openDialog({ kind: "createWorktree" }); } },
      { id: "rebase", label: "Interactive Rebase…", group: "Branches", run: () => { close(); ui.openDialog({ kind: "rebase" }); } },
      go("Overview", "overview"),
      go("Changes", "changes"),
      go("History", "history"),
      go("Repository Health", "health"),
      go("Settings", "settings"),
      { id: "shortcuts", label: "Keyboard Shortcuts", group: "Help", hint: "?", run: () => { close(); ui.openDialog({ kind: "shortcuts" }); } },
    ];
  }, [mode, repo, branches, status, hasUpstream, recentBranches, pick]);

  const filtered = useMemo(() => fuzzyFilter(items, query, (i) => i.label).slice(0, 50), [items, query]);
  useEffect(() => setActive(0), [query, mode]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!mode) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setPalette(null);
    }
  };

  let lastGroup = "";
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPalette(null)}>
      <div className="dialog bracketed" role="dialog" aria-label={mode === "branches" ? "Switch branch" : "Command palette"} onKeyDown={onKey}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={15} className="text-ink-faint" />
          <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={mode === "branches" ? "Switch to branch…" : "Type a command…"} className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-faint" aria-label="Palette search" />
          <span className="kbd">Esc</span>
        </div>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1" role="listbox">
          {filtered.map((it, i) => {
            const header = !query && it.group !== lastGroup ? ((lastGroup = it.group), <div className="tech-label px-4 pb-1 pt-2.5">{it.group}</div>) : null;
            return (
              <div key={it.id}>
                {header}
                <button type="button" role="option" aria-selected={i === active} data-index={i} onMouseMove={() => setActive(i)} onClick={it.run} className={cn("flex h-9 w-full items-center gap-3 px-4 text-left text-[13px]", i === active ? "bg-cyan/10 text-cyan" : "text-ink")}>
                  {it.icon}
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.hint && <span className="mono max-w-[50%] truncate text-[11px] text-ink-faint">{it.hint}</span>}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="mono p-6 text-center text-[11px] tracking-wider text-ink-faint">NO MATCHES</div>}
        </div>
      </div>
    </div>
  );
}
