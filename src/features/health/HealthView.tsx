import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Page } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DataRow, TechnicalLabel } from "@/components/ui/Panel";
import { useRepo } from "@/stores/repo";
import { api } from "@/lib/api";
import { runAction } from "@/lib/ops";
import { formatBytes } from "@/lib/format";
import type { Health } from "@/types/git";

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="border border-line bg-panel p-4">
      <TechnicalLabel>{label}</TechnicalLabel>
      <div className={`mono mt-1 text-[24px] font-medium ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

export function HealthView() {
  const root = useRepo((s) => s.repo?.root ?? "");
  const [h, setH] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    const r = await runAction(() => api.health(root));
    if (r) setH(r);
    setLoading(false);
  }, [root]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <Page title="Repository Health" actions={<Button small onClick={() => void run()} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Analyze</Button>}>
      {!h ? (
        <div className="mono p-10 text-center text-[11px] tracking-wider text-ink-faint">{loading ? "ANALYZING REPOSITORY…" : "NO DATA"}</div>
      ) : (
        <div className="space-y-5 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric label="Repository" value={formatBytes(h.repoBytes)} />
            <Metric label=".git" value={formatBytes(h.gitBytes)} />
            <Metric label="Branches" value={h.branches} />
            <Metric label="Stale" value={h.staleBranches.length} tone={h.staleBranches.length ? "text-warn" : ""} />
            <Metric label="Large files" value={h.largeFiles.length} tone={h.largeFiles.length ? "text-alert" : ""} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <TechnicalLabel>Object database</TechnicalLabel>
              <div className="mt-2">
                <DataRow label="Loose objects" mono>{h.looseObjects}</DataRow>
                <DataRow label="Packed objects" mono>{h.packedObjects}</DataRow>
                <DataRow label="Packs" mono>{h.packs}</DataRow>
                <DataRow label="Dangling objects" mono>{h.dangling}</DataRow>
                <DataRow label="Uncommitted changes" mono>{h.uncommitted}</DataRow>
              </div>
            </div>
            <div>
              <TechnicalLabel>Warnings</TechnicalLabel>
              <div className="mt-2 space-y-2">
                {h.warnings.length === 0 ? <Alert tone="info" title="No issues detected">Nothing here needs attention.</Alert> : h.warnings.map((w) => <Alert key={w} tone="warn">{w}</Alert>)}
              </div>
            </div>
          </div>
          {h.largeFiles.length > 0 && (
            <div>
              <TechnicalLabel>Large tracked files</TechnicalLabel>
              <ul className="mono mt-2 divide-y divide-line border border-line text-[12px]">{h.largeFiles.map((f) => <li key={f.path} className="flex justify-between gap-4 px-3 py-1.5"><span className="selectable truncate">{f.path}</span><span className="text-alert">{formatBytes(f.bytes)}</span></li>)}</ul>
            </div>
          )}
          {h.staleBranches.length > 0 && (
            <div>
              <TechnicalLabel>Stale branches (90+ days)</TechnicalLabel>
              <div className="mono mt-2 text-[12px] text-ink-dim">{h.staleBranches.join(", ")}</div>
            </div>
          )}
          {h.suggestions.length > 0 && (
            <div>
              <TechnicalLabel>Suggested commands · never run automatically</TechnicalLabel>
              <pre className="mono selectable mt-2 whitespace-pre-wrap border border-line bg-base p-3 text-[12px] leading-relaxed"><span className="text-cyan">$ </span>{h.suggestions.join("\n$ ")}</pre>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
