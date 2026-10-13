import type { ReactNode } from "react";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "warn" | "danger"; title?: ReactNode; children?: ReactNode; className?: string }) {
  const Icon = { info: Info, warn: AlertTriangle, danger: OctagonAlert }[tone];
  const color = { info: "text-cyan", warn: "text-warn", danger: "text-alert" }[tone];
  return (
    <div className={cn("alert", `alert-${tone}`, className)} role={tone === "danger" ? "alert" : "status"}>
      <Icon size={16} className={cn("mt-0.5 shrink-0", color)} />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <div className="text-[12px] font-semibold text-ink">{title}</div>}
        {children && <div className="text-[12px] text-ink-dim">{children}</div>}
      </div>
    </div>
  );
}
