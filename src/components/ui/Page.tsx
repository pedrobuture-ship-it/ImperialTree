import type { ReactNode } from "react";
import { CommandPanel } from "./Panel";

/** Standard full-height manager page: one panel with a title, actions and scrolling body. */
export function Page({ title, badge, actions, children, className }: { title: string; badge?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className="h-full p-3">
      <CommandPanel title={title} badge={badge} actions={actions} className={`h-full ${className ?? ""}`} bodyClassName="overflow-y-auto">
        {children}
      </CommandPanel>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="mono p-10 text-center text-[11px] tracking-wider text-ink-faint">{children}</div>;
}
