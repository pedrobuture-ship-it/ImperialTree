import { useEffect, useState } from "react";
import { Code2, FolderOpen, SquareTerminal } from "lucide-react";
import { Page } from "@/components/ui/Page";
import { Button, Select } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { TechnicalLabel } from "@/components/ui/Panel";
import { useRepo } from "@/stores/repo";
import { useSettings } from "@/stores/settings";
import { api } from "@/lib/api";
import { runAction } from "@/lib/ops";
import type { Tool } from "@/types/git";

export function TerminalView() {
  const root = useRepo((s) => s.repo?.root ?? "");
  const { terminal, editor, patch } = useSettings();
  const [terms, setTerms] = useState<Tool[]>([]);
  const [eds, setEds] = useState<Tool[]>([]);

  useEffect(() => {
    void api.terminals().then(setTerms);
    void api.editors().then(setEds);
  }, []);

  return (
    <Page title="Terminal">
      <div className="max-w-2xl space-y-6 p-5">
        <Alert tone="info" title="External terminal">
          Imperial Terminal does not embed a shell. It opens your own terminal emulator in the repository, so the interactive terminal never shares a code path with the Git commands this app runs.
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" className="!h-10" onClick={() => void runAction(() => api.openTerminal(root, terminal ?? undefined))}><SquareTerminal size={15} /> Open terminal here</Button>
          <Button className="!h-10" onClick={() => void runAction(() => api.openInEditor(root, editor ?? undefined))}><Code2 size={15} /> Open in editor</Button>
          <Button className="!h-10" onClick={() => void runAction(() => api.reveal(root))}><FolderOpen size={15} /> Reveal in file manager</Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <TechnicalLabel>Terminal</TechnicalLabel>
            <Select value={terminal ?? ""} onChange={(e) => patch({ terminal: e.target.value || null })}>
              <option value="">Auto-detect {terms[0] ? `(${terms[0].name})` : ""}</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </label>
          <label className="space-y-1.5">
            <TechnicalLabel>Editor</TechnicalLabel>
            <Select value={editor ?? ""} onChange={(e) => patch({ editor: e.target.value || null })}>
              <option value="">Auto-detect {eds[0] ? `(${eds[0].name})` : ""}</option>
              {eds.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </label>
        </div>
        {terms.length === 0 && <Alert tone="warn">No supported terminal emulator was found in PATH.</Alert>}
      </div>
    </Page>
  );
}
