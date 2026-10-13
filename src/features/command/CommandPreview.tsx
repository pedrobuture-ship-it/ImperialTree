import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { CommandPanel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { useCommandLog } from "@/stores/commandLog";
import { useSettings } from "@/stores/settings";
import { cn } from "@/lib/cn";

/** Global command preview: every Git command the app runs, newest first. */
export function CommandPreview({ className }: { className?: string }) {
  const entries = useCommandLog((s) => s.entries);
  const show = useSettings((s) => s.showCommand);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const text = entries.slice(0, 10).map((e) => e.command).reverse().join("\n");
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <CommandPanel
      title="Command Preview"
      className={className}
      actions={
        <Button variant="ghost" icon small tip="Copy recent commands" onClick={copy} disabled={entries.length === 0}>
          {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
        </Button>
      }
      bodyClassName="overflow-y-auto p-3"
    >
      {!show ? (
        <div className="mono text-[11px] text-ink-faint">Command display is off. Enable “Always show Git command” in Settings.</div>
      ) : entries.length === 0 ? (
        <div className="mono space-y-2 text-[12px] leading-relaxed text-ink-faint">
          <div># Every action shows the real Git command.</div>
          <div className="text-ink-dim">$ git status --porcelain=v2 --branch</div>
        </div>
      ) : (
        <ul className="mono space-y-2.5 text-[12px] leading-snug">
          {entries.slice(0, 12).map((e) => (
            <li key={e.id} className="anim-in">
              <div className={cn("text-[10px] tracking-[0.12em]", e.state === "failed" ? "text-alert" : e.state === "running" ? "text-warn" : "text-ink-faint")}>
                # {e.state === "running" ? "COMMAND" : e.state === "failed" ? "FAILED" : "EXECUTED"}
              </div>
              <div className="selectable break-all text-ink">
                <span className="text-cyan">$ </span>
                {e.command}
              </div>
            </li>
          ))}
        </ul>
      )}
    </CommandPanel>
  );
}
