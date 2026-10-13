import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { CommandPanel, DataRow, TechnicalLabel } from "@/components/ui/Panel";
import { Button, Input, Select } from "@/components/ui/Button";
import { CommitGraph, RefBadge } from "./CommitGraph";
import { useCommitMenu, commitMenu } from "./useCommitMenu";
import { DiffView } from "@/features/diff/DiffView";
import { useHistory } from "@/hooks/useHistory";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { api, toGitError } from "@/lib/api";
import { parseDiff, type ParsedDiff } from "@/lib/diff";
import { useContextMenu } from "@/components/ui/Menu";
import { relativeTime } from "@/lib/format";
import type { Commit, CommitDetails } from "@/types/git";

export function HistoryView() {
  const root = useRepo((s) => s.repo?.root ?? "");
  const branches = useRepo((s) => s.branches);
  const focus = useUi((s) => s.historyFocus);
  const [search, setSearch] = useState("");
  const [author, setAuthor] = useState("");
  const [branch, setBranch] = useState("--all");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [q, setQ] = useState({ search: "", author: "", branch: "--all", since: "", until: "" });
  const searchRef = useRef<HTMLInputElement>(null);
  const cm = useCommitMenu();
  const { commits, loading, error, more } = useHistory(q);
  const [details, setDetails] = useState<CommitDetails | null>(null);
  const [diff, setDiff] = useState<ParsedDiff | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const filesMenu = useContextMenu();

  // Debounce text filters so typing does not spawn a git process per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => setQ({ search, author, branch, since, until }), 300);
    return () => window.clearTimeout(t);
  }, [search, author, branch, since, until]);

  const { setSelected } = cm;
  useEffect(() => {
    if (focus) setSelected(focus);
  }, [focus, setSelected]);

  const selected: Commit | undefined = useMemo(() => commits.find((c) => c.hash === cm.selected), [commits, cm.selected]);

  useEffect(() => {
    if (!cm.selected) return setDetails(null);
    let live = true;
    setDetailError(null);
    Promise.all([api.commitDetails(root, cm.selected), api.commitDiff(root, cm.selected)])
      .then(([d, text]) => {
        if (!live) return;
        setDetails(d);
        setDiff(parseDiff(text));
      })
      .catch((e) => live && setDetailError(toGitError(e).message));
    return () => {
      live = false;
    };
  }, [root, cm.selected]);

  // Keyboard: J/K to move between commits, Ctrl+F to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
      if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== "j" && e.key !== "k") return;
      const i = commits.findIndex((c) => c.hash === cm.selected);
      const next = commits[e.key === "j" ? Math.min(commits.length - 1, i + 1) : Math.max(0, i - 1)];
      if (next) cm.setSelected(next.hash);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commits, cm]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.25fr)_minmax(380px,1fr)] gap-3 p-3">
      <CommandPanel title="History" bodyClassName="flex min-h-0 flex-col" actions={<span className="mono text-[11px] text-ink-faint">{commits.length}{loading ? "…" : ""} commits</span>}>
        <div className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr_0.9fr] gap-2 border-b border-line p-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-[9px] text-ink-faint" />
            <Input ref={searchRef} className="!pl-8" placeholder="Search messages (Ctrl F)" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search commits" />
          </div>
          <Input placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} aria-label="Author filter" />
          <Select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch filter">
            <option value="--all">All branches</option>
            {branches.map((b) => <option key={b.fullName} value={b.name}>{b.name}</option>)}
          </Select>
          <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} aria-label="Since" title="Since" />
          <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} aria-label="Until" title="Until" />
        </div>
        {error ? <div className="p-4 text-[12px] text-alert">{error}</div> : (
          <div className="min-h-0 flex-1">
            <CommitGraph commits={commits} selected={cm.selected} onSelect={cm.select} onContextMenu={cm.onContextMenu} onNearEnd={more} showAuthor loadingMore={loading && commits.length > 0} />
          </div>
        )}
        {cm.element}
      </CommandPanel>

      <CommandPanel title="Commit details" bodyClassName="flex min-h-0 flex-col" actions={selected && (
        <Button small onClick={(e) => filesMenu.open(e, commitMenu(root, selected))}>Actions</Button>
      )}>
        {detailError ? <div className="p-4 text-[12px] text-alert">{detailError}</div> : !details || !selected ? (
          <div className="mono grid h-full place-items-center text-[11px] tracking-wider text-ink-faint">SELECT A COMMIT <span className="kbd ml-2">J</span><span className="kbd ml-1">K</span></div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-3 border-b border-line p-4">
              <div className="selectable text-[15px] font-semibold leading-snug">{details.commit.subject}</div>
              {details.body && <pre className="selectable whitespace-pre-wrap font-sans text-[12px] text-ink-dim">{details.body}</pre>}
              <div className="flex flex-wrap gap-1.5">{details.commit.refs.map((r) => <RefBadge key={r.kind + r.name} r={r} />)}</div>
              <div>
                <DataRow label="Hash" mono>{details.commit.hash}</DataRow>
                <DataRow label="Author">{details.commit.author}</DataRow>
                <DataRow label="Email">{details.commit.email}</DataRow>
                <DataRow label="Date">{new Date(details.commit.timestamp * 1000).toLocaleString()} · {relativeTime(details.commit.timestamp)}</DataRow>
                <DataRow label="Parents" mono>{details.commit.parents.map((p) => p.slice(0, 7)).join(" ") || "root commit"}</DataRow>
                <DataRow label="Branches">{details.branches.join(", ") || "—"}</DataRow>
                <DataRow label="Changed">{details.files.length} files · <span className="text-ok">+{details.insertions}</span> <span className="text-alert">−{details.deletions}</span></DataRow>
              </div>
              <div>
                <TechnicalLabel>Files</TechnicalLabel>
                <ul className="mt-1.5 space-y-0.5">
                  {details.files.map((f) => (
                    <li key={f.path} className="mono flex gap-3 text-[11px]"><span className="min-w-0 flex-1 truncate text-ink-dim">{f.path}</span><span className="text-ok">{f.added === null ? "bin" : `+${f.added}`}</span><span className="text-alert">{f.removed === null ? "" : `−${f.removed}`}</span></li>
                  ))}
                </ul>
              </div>
            </div>
            {diff && <DiffView diff={diff} mode="unified" empty="NO TEXTUAL CHANGES IN THIS COMMIT" />}
          </div>
        )}
        {filesMenu.element}
      </CommandPanel>
    </div>
  );
}
