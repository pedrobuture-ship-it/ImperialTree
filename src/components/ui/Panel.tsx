import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function TechnicalLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("tech-label", className)}>{children}</span>;
}

export function CommandPanel({
  title,
  actions,
  badge,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel bracketed flex min-h-0 min-w-0 flex-col", className)}>
      {title !== undefined && (
        <header className="panel-head">
          <span className="tech-title">{title}</span>
          {badge}
          <span className="flex-1" />
          {actions}
        </header>
      )}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

export function DangerPanel({ title = "Destructive operation", children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("border border-alert-dim bg-alert/[0.07]", className)}>
      <div className="flex items-center gap-2 border-b border-alert-dim px-3 py-1.5">
        <span className="size-1.5 bg-alert anim-pulse" />
        <span className="tech-label !text-alert">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export function DataRow({ label, children, mono }: { label: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-1.5 last:border-0">
      <TechnicalLabel>{label}</TechnicalLabel>
      <span className={cn("selectable truncate text-right text-ink", mono && "mono text-[12px]")}>{children}</span>
    </div>
  );
}

export function HudDivider({ className }: { className?: string }) {
  return <div className={cn("hud-divider", className)} />;
}

type Tone = "ok" | "alert" | "warn" | "cyan" | "idle";
const toneColor: Record<Tone, string> = { ok: "bg-ok", alert: "bg-alert", warn: "bg-warn", cyan: "bg-cyan", idle: "bg-ink-faint" };

export function StatusIndicator({ tone = "idle", label, pulse }: { tone?: Tone; label?: ReactNode; pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", toneColor[tone], pulse && "anim-pulse")} />
      {label !== undefined && <span className="mono text-[11px] uppercase tracking-wider text-ink-dim">{label}</span>}
    </span>
  );
}

export function TerminalBadge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "cyan" | "red" | "green" | "warn" | "solid"; className?: string }) {
  const cls = { neutral: "", cyan: "badge-cyan", red: "badge-red", green: "badge-green", warn: "badge-warn", solid: "badge-solid-cyan" }[tone];
  return <span className={cn("badge", cls, className)}>{children}</span>;
}
