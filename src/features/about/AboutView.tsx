import { useEffect, useState } from "react";
import { Page } from "@/components/ui/Page";
import { Logo } from "@/components/Logo";
import { DataRow } from "@/components/ui/Panel";
import { api } from "@/lib/api";
import type { Environment } from "@/types/git";

export function AboutView() {
  const [env, setEnv] = useState<Environment | null>(null);
  useEffect(() => void api.environment().then(setEnv).catch(() => undefined), []);
  return (
    <Page title="About">
      <div className="mx-auto max-w-xl space-y-6 p-8">
        <div className="flex items-center gap-5">
          <Logo size={64} />
          <div>
            <h2 className="text-[22px] font-semibold tracking-[0.26em]">IMPERIAL TERMINAL</h2>
            <div className="mono text-[12px] text-ink-dim">version {env?.appVersion ?? "…"}</div>
          </div>
        </div>
        <p className="text-[15px] italic text-ink">“Git without the abstraction wall.”</p>
        <div>
          <DataRow label="Stack">React · TypeScript · Tauri 2 · Rust</DataRow>
          <DataRow label="Git backend">system git CLI</DataRow>
          <DataRow label="Git version detected" mono>{env?.gitVersion ?? "not found"}</DataRow>
          <DataRow label="Operating system">{env?.os ?? "…"}</DataRow>
        </div>
        <div className="mono space-y-1 border border-line bg-base p-4 text-[12px] tracking-wide text-ink-dim">
          <div>No analytics.</div>
          <div>No tracking.</div>
          <div>No cloud required.</div>
        </div>
      </div>
    </Page>
  );
}
