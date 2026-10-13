import { Dialog } from "@/components/ui/Dialog";
import { useUi } from "@/stores/ui";

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Ctrl + K", action: "Command palette" },
  { keys: "Ctrl + Shift + P", action: "Branch quick switcher" },
  { keys: "Ctrl + O", action: "Open repository" },
  { keys: "Ctrl + Enter", action: "Commit (when the composer is focused)" },
  { keys: "Ctrl + F", action: "Search commits (History)" },
  { keys: "J / K", action: "Next / previous commit (History)" },
  { keys: "Esc", action: "Close dialog or panel" },
  { keys: "?", action: "Show this screen" },
];

export function ShortcutsDialog() {
  const close = useUi((s) => s.closeDialog);
  return (
    <Dialog title="Keyboard shortcuts" onClose={close}>
      <ul className="divide-y divide-line">
        {SHORTCUTS.map((s) => (
          <li key={s.keys} className="flex items-center justify-between py-2 text-[13px]">
            <span>{s.action}</span>
            <span className="flex gap-1">{s.keys.split(" ").map((k, i) => (k === "+" || k === "/" ? <span key={i} className="text-ink-faint">{k}</span> : <span key={i} className="kbd">{k}</span>))}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
