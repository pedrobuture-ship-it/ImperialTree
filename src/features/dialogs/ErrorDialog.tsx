import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { TechnicalLabel } from "@/components/ui/Panel";
import { useUi } from "@/stores/ui";
import type { GitError } from "@/types/git";

const TITLES: Record<GitError["kind"], string> = {
  "git-not-found": "Git is not installed",
  "not-a-repository": "Not a Git repository",
  "invalid-input": "Invalid input",
  timeout: "Git command timed out",
  failed: "Git command failed",
  io: "Operation failed",
};

export function ErrorDialog({ error }: { error: GitError }) {
  const close = useUi((s) => s.closeDialog);
  const setView = useUi((s) => s.setView);
  const [open, setOpen] = useState(false);
  const conflict = /conflict|could not apply|automatic merge failed/i.test(error.stderr + error.message);

  return (
    <Dialog
      title={TITLES[error.kind]}
      onClose={close}
      footer={
        <>
          {conflict && (
            <Button
              variant="primary"
              onClick={() => {
                close();
                setView("conflicts");
              }}
            >
              Resolve conflicts
            </Button>
          )}
          <Button onClick={close} autoFocus>Close</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error.command && (
          <div>
            <TechnicalLabel>Command</TechnicalLabel>
            <div className="mono selectable mt-1 break-all text-[12px]"><span className="text-cyan">$ </span>{error.command}</div>
          </div>
        )}
        <Alert tone="danger" title="Reason">{error.message}</Alert>
        {error.stderr && (
          <div>
            <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-ink-dim hover:text-ink">
              {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Git output (stderr)
            </button>
            {open && <pre className="mono selectable mt-2 max-h-56 overflow-auto whitespace-pre-wrap border border-line bg-base p-3 text-[11px] text-ink-dim">{error.stderr}</pre>}
          </div>
        )}
      </div>
    </Dialog>
  );
}
