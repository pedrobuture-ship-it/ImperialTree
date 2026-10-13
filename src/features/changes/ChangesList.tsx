import { useMemo, useState } from "react";
import { FileCode2, FileText, Image, MoreHorizontal } from "lucide-react";
import { CommandPanel, TerminalBadge } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { useContextMenu } from "@/components/ui/Menu";
import { useRepo } from "@/stores/repo";
import { baseName, dirName } from "@/lib/format";
import { groupEntries, statusLetter, statusTone } from "@/lib/files";
import { cn } from "@/lib/cn";
import { discardFiles, fileMenu, stageFiles, unstageFiles } from "./actions";
import type { FileEntry } from "@/types/git";

type Filter = "all" | "staged" | "unstaged" | "untracked";

function fileIcon(path: string) {
  if (/\.(png|jpe?g|gif|svg|webp)$/i.test(path)) return Image;
  if (/\.(tsx?|jsx?|rs|go|py|css|html|json|toml|ya?ml)$/i.test(path)) return FileCode2;
  return FileText;
}

export function ChangesList({ className, onOpenConflicts }: { className?: string; onOpenConflicts?: () => void }) {
  const root = useRepo((s) => s.repo?.root ?? "");
  const entries = useRepo((s) => s.status?.entries);
  const selection = useRepo((s) => s.selection);
  const select = useRepo((s) => s.select);
  const [filter, setFilter] = useState<Filter>("all");
  const menu = useContextMenu();
  const groups = useMemo(() => groupEntries(entries ?? []), [entries]);

  const tabs: { id: Filter; label: string; n: number }[] = [
    { id: "all", label: "All", n: (entries ?? []).length },
    { id: "staged", label: "Staged", n: groups.staged.length },
    { id: "unstaged", label: "Unstaged", n: groups.unstaged.length },
    { id: "untracked", label: "Untracked", n: groups.untracked.length },
  ];

  const section = (key: Filter, title: string, tone: "ok" | "alert" | "warn", list: FileEntry[], staged: boolean) => {
    if (list.length === 0 || (filter !== "all" && filter !== key)) return null;
    const color = { ok: "border-ok text-ok", alert: "border-alert text-alert", warn: "border-warn text-warn" }[tone];
    const paths = list.map((e) => e.path);
    return (
      <div key={key} className="anim-in">
        <div className={cn("flex items-center gap-2 border-l-[3px] bg-raised/40 px-3 py-1.5", color)}>
          <span className="text-[11px] font-bold uppercase tracking-[0.14em]">{title}</span>
          <TerminalBadge tone={tone === "ok" ? "green" : tone === "alert" ? "red" : "warn"}>{list.length}</TerminalBadge>
          <span className="flex-1" />
          {key === "staged" ? (
            <Button variant="ghost" small onClick={() => void unstageFiles(root, paths)}>Unstage all</Button>
          ) : (
            <>
              <Button variant="ghost" small onClick={() => void stageFiles(root, paths)}>Stage all</Button>
              <Button variant="ghost" small className="!text-alert" onClick={() => discardFiles(root, paths, key === "untracked")}>Discard all</Button>
            </>
          )}
        </div>
        {list.map((e) => {
          const letter = statusLetter(e, staged);
          const Icon = fileIcon(e.path);
          const selected = selection?.path === e.path && selection.staged === staged && selection.untracked === e.untracked;
          return (
            <div
              key={`${key}:${e.path}`}
              className="row group"
              data-selected={selected}
              onClick={() => select({ path: e.path, staged, untracked: e.untracked })}
              onContextMenu={(ev) => menu.open(ev, fileMenu(root, e, staged))}
            >
              <input
                type="checkbox"
                className="check size-3.5"
                checked={staged}
                aria-label={staged ? `Unstage ${e.path}` : `Stage ${e.path}`}
                onClick={(ev) => ev.stopPropagation()}
                onChange={() => void (staged ? unstageFiles(root, [e.path]) : stageFiles(root, [e.path]))}
              />
              <Icon size={15} className={tone === "ok" ? "text-ok" : tone === "alert" ? "text-alert" : "text-warn"} />
              <div className="min-w-0 flex-1">
                <div className="selectable truncate text-[13px]">{baseName(e.path)}</div>
                {dirName(e.path) && <div className="mono truncate text-[10px] text-ink-faint">{e.origPath ? `${e.origPath} → ` : ""}{dirName(e.path)}</div>}
              </div>
              <TerminalBadge tone={statusTone(letter)} className="!border-transparent !bg-transparent">{letter}</TerminalBadge>
              <button type="button" aria-label="File actions" className="text-ink-faint opacity-0 hover:text-ink group-hover:opacity-100" onClick={(ev) => menu.open(ev, fileMenu(root, e, staged))}>
                <MoreHorizontal size={15} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <CommandPanel title="Changes" badge={<TerminalBadge tone="solid">{(entries ?? []).length}</TerminalBadge>} className={className} bodyClassName="flex min-h-0 flex-col">
      <div className="flex gap-1 border-b border-line px-3 py-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={cn("flex h-6 items-center gap-1.5 border px-2.5 text-[11px]", filter === t.id ? "border-cyan-dim bg-cyan/10 text-cyan" : "border-transparent text-ink-dim hover:text-ink")}
          >
            {t.label} <span className="mono text-[10px] opacity-70">{t.n}</span>
          </button>
        ))}
      </div>
      {groups.conflicted.length > 0 && (
        <button type="button" onClick={onOpenConflicts} className="flex items-center gap-2 border-b border-alert-dim bg-alert/10 px-3 py-2 text-left text-[12px] text-alert hover:bg-alert/15">
          <span className="size-1.5 bg-alert anim-pulse" />
          CONFLICT DETECTED — {groups.conflicted.length} file{groups.conflicted.length === 1 ? "" : "s"} require resolution
        </button>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {section("staged", "Staged changes", "ok", groups.staged, true)}
        {section("unstaged", "Unstaged changes", "alert", groups.unstaged, false)}
        {section("untracked", "Untracked files", "warn", groups.untracked, false)}
        {(entries ?? []).length === 0 && <div className="mono p-6 text-center text-[11px] tracking-wider text-ink-faint">WORKING TREE CLEAN</div>}
      </div>
      {menu.element}
    </CommandPanel>
  );
}
