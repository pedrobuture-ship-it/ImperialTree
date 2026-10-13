import { useEffect } from "react";
import { useUi } from "@/stores/ui";
import { useOpenRepositoryDialog } from "./useOpenRepository";

function isEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

/** App-wide keyboard shortcuts. They never override standard text-editing keys. */
export function useGlobalShortcuts() {
  const pick = useOpenRepositoryDialog();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && !e.shiftKey && k === "k") {
        e.preventDefault();
        ui.setPalette(ui.palette === "commands" ? null : "commands");
      } else if (mod && e.shiftKey && k === "p") {
        e.preventDefault();
        ui.setPalette(ui.palette === "branches" ? null : "branches");
      } else if (mod && !e.shiftKey && k === "o") {
        e.preventDefault();
        void pick();
      } else if (e.key === "?" && !mod && !isEditable(e.target) && !ui.dialog && !ui.palette) {
        ui.openDialog({ kind: "shortcuts" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick]);
}
