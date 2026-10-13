import { useUi } from "@/stores/ui";
import { cn } from "@/lib/cn";

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-[80] flex flex-col items-end gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cn("anim-in min-w-[220px] max-w-[360px] border bg-raised px-4 py-2.5 shadow-lg", t.tone === "ok" ? "border-ok-dim" : t.tone === "warn" ? "border-warn-dim" : "border-cyan-dim")}>
          <div className={cn("mono text-[10px] font-bold tracking-[0.2em]", t.tone === "ok" ? "text-ok" : t.tone === "warn" ? "text-warn" : "text-cyan")}>{t.title}</div>
          {t.detail && <div className="mt-0.5 truncate text-[12px] text-ink-dim">{t.detail}</div>}
        </div>
      ))}
    </div>
  );
}
