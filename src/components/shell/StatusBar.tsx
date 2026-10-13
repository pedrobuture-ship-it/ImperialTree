import { GitBranch, ArrowUp, ArrowDown, FileText } from "lucide-react";
import { StatusIndicator } from "@/components/ui/Panel";
import { useCommandLog } from "@/stores/commandLog";
import { useRepo } from "@/stores/repo";

export function StatusBar() {
  const status = useRepo((s) => s.status);
  const repo = useRepo((s) => s.repo);
  const last = useCommandLog((s) => s.entries[0]);
  const running = last?.state === "running";

  return (
    <footer className="mono flex h-7 shrink-0 items-center gap-5 border-t border-line bg-base px-4 text-[11px] text-ink-dim">
      {repo ? (
        <>
          <span className="flex items-center gap-1.5">
            <GitBranch size={12} className="text-cyan" />
            {status?.detached ? "(detached)" : (status?.branch ?? repo.branch ?? "—")}
          </span>
          <span className="flex items-center gap-1 text-ok">
            <ArrowUp size={11} />
            {status?.ahead ?? 0}
          </span>
          <span className="flex items-center gap-1">
            <ArrowDown size={11} />
            {status?.behind ?? 0}
          </span>
          <span className="flex items-center gap-1.5">
            <FileText size={12} />
            {status?.entries.length ?? 0} changes
          </span>
        </>
      ) : (
        <span>NO REPOSITORY</span>
      )}
      <span className="flex-1" />
      {last && <span className="max-w-[46%] truncate text-ink-faint">{last.state === "failed" ? "FAILED" : "LAST"} › {last.command}</span>}
      <StatusIndicator tone={running ? "warn" : "ok"} pulse={running} label={running ? "EXECUTING" : "READY"} />
    </footer>
  );
}
