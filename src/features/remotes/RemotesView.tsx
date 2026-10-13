import { useState } from "react";
import { Cloud, Download, Upload, ArrowDownToLine, Plus } from "lucide-react";
import { Page, Empty } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { DataRow, TerminalBadge, TechnicalLabel } from "@/components/ui/Panel";
import { CommandLine } from "@/features/dialogs/CommandLine";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import { api } from "@/lib/api";
import { preview } from "@/lib/commands";
import { runOp } from "@/lib/ops";

export function RemotesView() {
  const root = useRepo((s) => s.repo?.root ?? "");
  const remotes = useRepo((s) => s.remotes);
  const branches = useRepo((s) => s.branches);
  const status = useRepo((s) => s.status);
  const openDialog = useUi((s) => s.openDialog);
  const [busy, setBusy] = useState<string | null>(null);
  const current = status?.branch ?? "";
  const hasUpstream = !!status?.upstream;

  const go = async (key: string, cmd: string, fn: () => ReturnType<typeof api.fetch>, ok: string) => {
    setBusy(key);
    await runOp(cmd, fn, { success: ok });
    setBusy(null);
  };

  return (
    <Page title="Remotes" badge={<TerminalBadge tone="solid">{remotes.length}</TerminalBadge>} actions={<Button variant="primary" small onClick={() => openDialog({ kind: "addRemote" })}><Plus size={13} /> Add remote</Button>}>
      {remotes.length === 0 && <Empty>NO REMOTES CONFIGURED — git remote add origin &lt;url&gt;</Empty>}
      {remotes.map((r) => {
        const remoteBranches = branches.filter((b) => b.remote && b.name.startsWith(`${r.name}/`));
        const key = (a: string) => `${r.name}:${a}`;
        return (
          <section key={r.name} className="border-b border-line p-4">
            <div className="flex items-center gap-3">
              <Cloud size={18} className="text-cyan" />
              <span className="text-[16px] font-semibold">{r.name}</span>
              <span className="flex-1" />
              <Button disabled={!!busy} onClick={() => void go(key("fetch"), preview.fetch(r.name), () => api.fetch(root, r.name), `Fetched ${r.name}`)}><Download size={13} /> Fetch</Button>
              <Button disabled={!!busy || !current} onClick={() => void go(key("pull"), preview.pull(r.name, false), () => api.pull(root, r.name, false), `Pulled ${r.name}`)}><ArrowDownToLine size={13} /> Pull</Button>
              <Button variant="primary" disabled={!!busy || !current} onClick={() => void go(key("push"), preview.push(r.name, current, !hasUpstream), () => api.push(root, r.name, current, !hasUpstream), `Pushed ${current}`)}><Upload size={13} /> Push</Button>
            </div>
            {busy?.startsWith(r.name + ":") && <div className="relative mt-3 h-0.5 overflow-hidden bg-line anim-sweep" role="progressbar" aria-label="Running" />}
            <div className="mt-3 max-w-2xl">
              <DataRow label="Fetch URL" mono>{r.fetchUrl}</DataRow>
              <DataRow label="Push URL" mono>{r.pushUrl || r.fetchUrl}</DataRow>
            </div>
            <div className="mt-3 max-w-2xl space-y-2">
              <CommandLine label="Equivalent commands" command={[preview.fetch(r.name), preview.pull(r.name, false), preview.push(r.name, current || "<branch>", !hasUpstream)].join("\n")} />
            </div>
            <div className="mt-4"><TechnicalLabel>Remote branches · {remoteBranches.length}</TechnicalLabel></div>
            <div className="mono mt-1.5 flex flex-wrap gap-1.5">{remoteBranches.map((b) => <TerminalBadge key={b.name}>{b.name}</TerminalBadge>)}</div>
          </section>
        );
      })}
    </Page>
  );
}
