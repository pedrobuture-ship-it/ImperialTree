import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button, Input } from "@/components/ui/Button";
import { DangerPanel, TechnicalLabel } from "@/components/ui/Panel";
import { useUi } from "@/stores/ui";

export function ConfirmDialog({ title, command, impact, confirmLabel, typeToConfirm, onConfirm }: { title: string; command: string; impact: string; confirmLabel: string; typeToConfirm?: string; onConfirm: () => void }) {
  const close = useUi((s) => s.closeDialog);
  const [typed, setTyped] = useState("");
  const ok = !typeToConfirm || typed === typeToConfirm;
  return (
    <Dialog
      title={title}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="danger"
            disabled={!ok}
            autoFocus
            onClick={() => {
              close();
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <DangerPanel>
        <div className="space-y-3">
          <div>
            <TechnicalLabel>Command</TechnicalLabel>
            <div className="mono selectable mt-1 break-all text-[12px]"><span className="text-alert">$ </span>{command}</div>
          </div>
          <div>
            <TechnicalLabel>Impact</TechnicalLabel>
            <div className="mt-1 text-[13px] text-ink">{impact}</div>
          </div>
        </div>
      </DangerPanel>
      {typeToConfirm && (
        <div className="mt-4 space-y-1.5">
          <TechnicalLabel>Type “{typeToConfirm}” to confirm</TechnicalLabel>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Confirmation text" />
        </div>
      )}
    </Dialog>
  );
}
