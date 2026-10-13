import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Logo } from "@/components/Logo";
import { StatusIndicator } from "@/components/ui/Panel";
import { useRepo } from "@/stores/repo";

const win = () => getCurrentWindow();

export function Titlebar() {
  const operation = useRepo((s) => s.operation);
  const status = useRepo((s) => s.status);
  const conflicts = status?.entries.filter((e) => e.conflicted).length ?? 0;
  const alert = conflicts > 0;
  const busy = operation !== "none";

  return (
    <div data-tauri-drag-region className="flex h-14 shrink-0 items-center border-b border-line bg-base pl-4" onDoubleClick={() => void win().toggleMaximize()}>
      <div data-tauri-drag-region className="flex items-center gap-3">
        <Logo />
        <div data-tauri-drag-region className="leading-tight">
          <div data-tauri-drag-region className="text-[15px] font-semibold tracking-[0.3em] text-ink">
            IMPERIAL TERMINAL
          </div>
        </div>
        <div data-tauri-drag-region className="mono ml-3 flex gap-5 text-[10px] tracking-[0.18em] text-ink-faint">
          <span>VERSION 0.1.0</span>
          <span>LINUX FIRST // GIT NATIVE // NO ACCOUNT</span>
        </div>
      </div>
      <div data-tauri-drag-region className="flex-1" />
      <div className="mr-4">
        <StatusIndicator tone={alert ? "alert" : busy ? "warn" : "ok"} pulse={alert || busy} label={alert ? "CONFLICT DETECTED" : busy ? `${operation} IN PROGRESS` : "ALL SYSTEMS NOMINAL"} />
      </div>
      <div className="flex h-full">
        <WinButton label="Minimize" onClick={() => void win().minimize()}>
          <Minus size={14} />
        </WinButton>
        <WinButton label="Maximize" onClick={() => void win().toggleMaximize()}>
          <Square size={11} />
        </WinButton>
        <WinButton label="Close" danger onClick={() => void win().close()}>
          <X size={15} />
        </WinButton>
      </div>
    </div>
  );
}

function WinButton({ children, label, onClick, danger }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={`grid w-11 place-items-center text-ink-dim transition-colors hover:text-ink ${danger ? "hover:bg-alert" : "hover:bg-raised"}`}>
      {children}
    </button>
  );
}
