import { ArrowDown, ArrowUp, Cloud, FileText, GitBranch } from "lucide-react";
import { CommandPanel, StatusIndicator, TechnicalLabel } from "@/components/ui/Panel";
import { ChangesList } from "@/features/changes/ChangesList";
import { FileDiffPanel } from "@/features/diff/FileDiffPanel";
import { CommitComposer } from "@/features/commit/CommitComposer";
import { CommandPreview } from "@/features/command/CommandPreview";
import { CommitGraph } from "@/features/history/CommitGraph";
import { useHistory } from "@/hooks/useHistory";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { describeWorkingTree } from "@/lib/files";
import { MiniTabs } from "./MiniTabs";
import { useCommitMenu } from "@/features/history/useCommitMenu";

function Stat({ icon, label, children, tone }: { icon?: React.ReactNode; label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1 border-l border-dashed border-line-strong px-6 first:border-0 first:pl-2">
      <TechnicalLabel>{label}</TechnicalLabel>
      <div className={`flex items-center gap-2 text-[17px] font-medium ${tone ?? ""}`}>
        {icon}
        {children}
      </div>
    </div>
  );
}

export function Overview() {
  const status = useRepo((s) => s.status);
  const setView = useUi((s) => s.setView);
  const { commits } = useHistory({ branch: "--all" }, 60);
  const dirty = (status?.entries.length ?? 0) > 0;
  const conflicts = status?.entries.some((e) => e.conflicted);
  const cm = useCommitMenu();

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_minmax(0,0.78fr)] gap-3 p-3">
      <CommandPanel title="Repository Overview" bodyClassName="flex items-stretch gap-0 px-4 py-3">
        <div className="mr-8 flex items-center gap-4">
          <GitBranch size={34} className="text-ink-faint" strokeWidth={1.4} />
          <div>
            <TechnicalLabel>Current branch</TechnicalLabel>
            <div className="text-[26px] font-semibold leading-tight">{status?.detached ? "detached" : (status?.branch ?? "—")}</div>
          </div>
        </div>
        <Stat label="Ahead" tone="text-ok" icon={<ArrowUp size={17} />}>{status?.ahead ?? 0}</Stat>
        <Stat label="Behind" icon={<ArrowDown size={17} />}>{status?.behind ?? 0}</Stat>
        <Stat label="Working tree" icon={<FileText size={16} className="text-ink-dim" />}>{describeWorkingTree(status?.entries ?? [])}</Stat>
        <Stat label="Upstream" icon={<Cloud size={17} className="text-ink-dim" />}>{status?.upstream ?? "none"}</Stat>
        <Stat label="Status">
          <StatusIndicator tone={conflicts ? "alert" : dirty ? "alert" : "ok"} />
          <span className={conflicts ? "text-alert" : dirty ? "text-alert" : "text-ok"}>{conflicts ? "Conflicted" : dirty ? "Modified" : "Clean"}</span>
        </Stat>
      </CommandPanel>

      <div className="grid min-h-0 grid-cols-[minmax(380px,0.82fr)_minmax(0,1.18fr)] gap-3">
        <ChangesList onOpenConflicts={() => setView("conflicts")} />
        <FileDiffPanel />
      </div>

      <div className="grid min-h-0 grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(300px,0.8fr)] gap-3">
        <CommandPanel title="Commit Graph" actions={<button type="button" className="text-[10px] uppercase tracking-wider text-ink-faint hover:text-cyan" onClick={() => setView("history")}>open history</button>} bodyClassName="min-h-0">
          <CommitGraph commits={commits} rowHeight={28} selected={cm.selected} onSelect={cm.select} onContextMenu={cm.onContextMenu} />
          {cm.element}
        </CommandPanel>
        <CommitComposer />
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,0.8fr)] gap-3">
          <CommandPreview />
          <MiniTabs />
        </div>
      </div>
    </div>
  );
}
