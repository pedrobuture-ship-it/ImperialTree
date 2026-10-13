import { useEffect, useRef, useState } from "react";
import { ChevronsRight, Sparkles } from "lucide-react";
import { CommandPanel } from "@/components/ui/Panel";
import { Input, TextArea, Select } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Menu";
import { useRepo } from "@/stores/repo";
import { useSettings } from "@/stores/settings";
import { api } from "@/lib/api";
import { preview } from "@/lib/commands";
import { runOp } from "@/lib/ops";
import { cn } from "@/lib/cn";

const TYPES = ["feat", "fix", "docs", "refactor", "test", "build", "chore"];

export function CommitComposer({ className }: { className?: string }) {
  const root = useRepo((s) => s.repo?.root ?? "");
  const summaryInfo = useRepo((s) => s.summary);
  const conflicts = useRepo((s) => s.status?.entries.some((e) => e.conflicted) ?? false);
  const conventional = useSettings((s) => s.conventional);
  const patch = useSettings((s) => s.patch);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [amend, setAmend] = useState(false);
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);
  const summaryRef = useRef<HTMLInputElement>(null);

  const applyType = (t: string) => {
    setType(t);
    if (!t) return;
    setSummary((s) => `${t}: ${s.replace(/^(feat|fix|docs|refactor|test|build|chore)(\([^)]*\))?!?:\s*/, "")}`);
    summaryRef.current?.focus();
  };

  const canCommit = (summaryInfo.files > 0 || amend) && summary.trim().length > 0 && !conflicts && !busy;

  const submit = async () => {
    if (!canCommit) return;
    setBusy(true);
    const out = await runOp(preview.commit(summary.trim(), description, amend), () => api.commit(root, summary, description, amend), { success: summary.trim() });
    setBusy(false);
    if (out) {
      setSummary("");
      setDescription("");
      setAmend(false);
      setType("");
    }
  };

  useEffect(() => {
    // Lets the command palette focus the composer.
    const f = () => summaryRef.current?.focus();
    window.addEventListener("it:focus-commit", f);
    return () => window.removeEventListener("it:focus-commit", f);
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submit();
    }
  };

  const n = summaryInfo.files;
  return (
    <CommandPanel title="Commit" className={className} actions={<span className="mono text-[11px] text-ink-dim">{n} file{n === 1 ? "" : "s"} staged <span className="text-ok">+{summaryInfo.added}</span> <span className="text-alert">−{summaryInfo.removed}</span></span>} bodyClassName="flex min-h-0 flex-col gap-2 p-3" >
      <div onKeyDown={onKey} className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="relative">
          <Input ref={summaryRef} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Summary (required)" maxLength={200} className="mono !h-9 pr-9" aria-label="Commit summary" />
          <Sparkles size={15} className={cn("absolute right-3 top-2.5", summary.length > 72 ? "text-warn" : "text-cyan/70")} aria-hidden />
        </div>
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="min-h-0 flex-1" aria-label="Commit description" />
        <div className="flex items-center gap-3">
          <Dropdown
            trigger={({ onClick }) => (
              <button type="button" onClick={onClick} className="flex h-9 w-14 items-center justify-center gap-1 border border-line-strong text-ink-dim hover:border-cyan-dim" aria-label="Conventional Commits helper" title="Conventional Commits helper (optional)">
                <Sparkles size={14} />
              </button>
            )}
            items={[
              ...TYPES.map((t) => ({ label: `${t}:`, onSelect: () => applyType(t) })),
              { label: conventional ? "Hide helper default" : "Suggest on open", separatorBefore: true, onSelect: () => patch({ conventional: !conventional }) },
            ]}
          />
          <label className="flex items-center gap-2 text-[12px] text-ink-dim">
            <input type="checkbox" className="check" checked={amend} onChange={(e) => setAmend(e.target.checked)} /> Amend last commit
          </label>
          <span className="flex-1" />
          {type && <Select className="!w-24" value={type} onChange={(e) => applyType(e.target.value)} aria-label="Commit type">{TYPES.map((t) => <option key={t}>{t}</option>)}</Select>}
          <button
            type="button"
            disabled={!canCommit}
            onClick={() => void submit()}
            className={cn("flex h-10 items-stretch border text-[12px] font-bold tracking-[0.14em] transition-colors", canCommit ? "border-cyan bg-cyan/10 text-cyan hover:bg-cyan/20" : "cursor-not-allowed border-line-strong text-ink-faint opacity-60")}
          >
            <span className="grid place-items-center px-5">{amend ? "AMEND COMMIT" : `COMMIT ${n} FILE${n === 1 ? "" : "S"}`}</span>
            <span className={cn("grid w-10 place-items-center border-l", canCommit ? "border-cyan/50 bg-cyan/20" : "border-line-strong")}><ChevronsRight size={16} /></span>
          </button>
        </div>
        {conflicts && <div className="text-[11px] text-alert">Resolve conflicts before committing.</div>}
      </div>
    </CommandPanel>
  );
}
