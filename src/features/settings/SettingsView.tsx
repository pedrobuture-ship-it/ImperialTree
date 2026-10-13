import { useCallback, useEffect, useState } from "react";
import { Page } from "@/components/ui/Page";
import { Button, Input } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DataRow, TechnicalLabel, TerminalBadge } from "@/components/ui/Panel";
import { useRepo } from "@/stores/repo";
import { useSettings } from "@/stores/settings";
import { api } from "@/lib/api";
import { runAction, runOp } from "@/lib/ops";
import { line } from "@/lib/commands";
import { CommandLine } from "@/features/dialogs/CommandLine";
import type { ConfigValue, SigningStatus, SshStatus } from "@/types/git";

const KEYS = ["user.name", "user.email", "init.defaultBranch"];

function ConfigRow({ cfg, root, hasRepo, onSaved }: { cfg: ConfigValue; root: string; hasRepo: boolean; onSaved: () => void }) {
  const [scope, setScope] = useState<"global" | "local">(cfg.local !== null ? "local" : "global");
  const current = scope === "global" ? cfg.global : cfg.local;
  const [value, setValue] = useState(current ?? "");
  useEffect(() => setValue(current ?? ""), [current]);
  const cmd = value.trim() ? line("config", `--${scope}`, cfg.key, value.trim()) : line("config", `--${scope}`, "--unset", cfg.key);
  const save = async () => {
    await runOp(cmd, () => api.configSet(root, scope, cfg.key, value), { success: `${cfg.key} updated (${scope})` });
    onSaved();
  };
  return (
    <div className="space-y-2 border-b border-line py-3 last:border-0">
      <div className="flex items-center gap-3">
        <span className="mono w-44 shrink-0 text-[12px] text-cyan">{cfg.key}</span>
        <div className="flex border border-line-strong text-[11px] uppercase tracking-wider">
          {(["global", "local"] as const).map((s) => (
            <button key={s} type="button" disabled={s === "local" && !hasRepo} onClick={() => setScope(s)} className={`px-3 py-1 ${scope === s ? "bg-cyan/15 text-cyan" : "text-ink-dim hover:text-ink"} disabled:opacity-40`}>{s === "local" ? "this repository" : "global"}</button>
          ))}
        </div>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={scope === "local" ? (cfg.global ?? "not set") : "not set"} className="mono" aria-label={cfg.key} />
        <Button variant="primary" disabled={value.trim() === (current ?? "")} onClick={() => void save()}>Save</Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[188px] text-[11px] text-ink-faint">
        <span className="whitespace-nowrap">Writes to <b className="text-ink-dim">{scope === "global" ? "~/.gitconfig" : ".git/config"}</b></span>
        <span className="mono">{cmd}</span>
        {cfg.effective && <TerminalBadge>effective: {cfg.effective}</TerminalBadge>}
      </div>
    </div>
  );
}

export function SettingsView() {
  const root = useRepo((s) => s.repo?.root ?? "");
  const hasRepo = !!root;
  const { showCommand, patch } = useSettings();
  const [cfg, setCfg] = useState<ConfigValue[]>([]);
  const [signing, setSigning] = useState<SigningStatus | null>(null);
  const [ssh, setSsh] = useState<SshStatus | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    if (hasRepo) {
      void api.configGet(root, KEYS).then(setCfg).catch(() => undefined);
      void api.signing(root).then(setSigning).catch(() => undefined);
    }
    void api.ssh().then(setSsh).catch(() => undefined);
  }, [root, hasRepo]);
  useEffect(load, [load]);

  const copyKey = async (file: string) => {
    const key = await runAction(() => api.sshPublicKey(file));
    if (key) {
      await navigator.clipboard.writeText(key);
      setCopied(file);
      window.setTimeout(() => setCopied(null), 1500);
    }
  };

  return (
    <Page title="Settings">
      <div className="max-w-3xl space-y-8 p-5">
        <section>
          <TechnicalLabel>Interface</TechnicalLabel>
          <label className="mt-3 flex items-start gap-3">
            <input type="checkbox" className="check mt-1" checked={showCommand} onChange={(e) => patch({ showCommand: e.target.checked })} />
            <span>
              <span className="text-[13px]">Always show Git command</span>
              <span className="block text-[12px] text-ink-faint">Shows the exact git command in the Command Preview panel and in every form that runs one.</span>
            </span>
          </label>
        </section>

        <section>
          <TechnicalLabel>Git identity & defaults</TechnicalLabel>
          {hasRepo ? <div className="mt-2">{cfg.map((c) => <ConfigRow key={c.key} cfg={c} root={root} hasRepo onSaved={load} />)}</div> : <Alert tone="info" className="mt-3">Open a repository to edit its Git configuration.</Alert>}
          <div className="mt-3"><CommandLine label="Inspect from a terminal" command="git config --show-origin --list" /></div>
        </section>

        {hasRepo && signing && (
          <section>
            <TechnicalLabel>Commit signing</TechnicalLabel>
            <div className="mt-2 max-w-md">
              <DataRow label="Commit signing">{signing.enabled ? <span className="text-ok">Enabled</span> : <span className="text-ink-dim">Disabled</span>}</DataRow>
              <DataRow label="Format" mono>{signing.format}</DataRow>
              <DataRow label="Signing key" mono>{signing.key ?? "not set"}</DataRow>
              {signing.program && <DataRow label="Program" mono>{signing.program}</DataRow>}
            </div>
            <p className="mt-2 text-[12px] text-ink-faint">Only references are shown. Private keys are never read or copied by this app.</p>
          </section>
        )}

        <section>
          <TechnicalLabel>SSH diagnostics</TechnicalLabel>
          {ssh && (
            <div className="mt-2 space-y-3">
              <div className="max-w-md">
                <DataRow label="~/.ssh directory">{ssh.dirExists ? <span className="text-ok">present</span> : <span className="text-warn">missing</span>}</DataRow>
                <DataRow label="ssh-agent">{ssh.agentRunning ? <span className="text-ok">running · {ssh.agentKeys} key(s) loaded</span> : <span className="text-warn">not reachable</span>}</DataRow>
              </div>
              {ssh.keys.length === 0 ? <div className="text-[12px] text-ink-faint">No public keys found.</div> : (
                <ul className="divide-y divide-line border border-line">
                  {ssh.keys.map((k) => (
                    <li key={k.file} className="flex items-center gap-3 px-3 py-2">
                      <span className="mono text-[12px]">{k.file}</span>
                      <span className="mono min-w-0 flex-1 truncate text-[11px] text-ink-faint">{k.fingerprint}</span>
                      <Button small onClick={() => void copyKey(k.file)}>{copied === k.file ? "Copied" : "Copy public key"}</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
