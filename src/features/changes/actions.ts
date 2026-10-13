import type { MenuEntry } from "@/components/ui/Menu";
import { api } from "@/lib/api";
import { preview } from "@/lib/commands";
import { confirmDestructive, runAction, runOp } from "@/lib/ops";
import { useSettings } from "@/stores/settings";
import type { FileEntry } from "@/types/git";

export const stageFiles = (root: string, paths: string[]) => runOp(preview.stage(paths), () => api.stage(root, paths));
export const unstageFiles = (root: string, paths: string[]) => runOp(preview.unstage(paths), () => api.unstage(root, paths));

export function discardFiles(root: string, paths: string[], untracked: boolean) {
  const cmd = preview.discard(paths, untracked);
  confirmDestructive({
    title: untracked ? "Delete untracked files" : "Discard changes",
    command: cmd,
    impact: untracked
      ? `${paths.length} untracked file${paths.length === 1 ? "" : "s"} will be permanently deleted. They are not in Git, so this cannot be undone.`
      : `Uncommitted changes in ${paths.length} file${paths.length === 1 ? "" : "s"} will be permanently discarded.`,
    confirmLabel: untracked ? "Delete files" : "Discard changes",
    onConfirm: () => void runOp(cmd, () => api.discard(root, paths, untracked), { success: "Changes discarded" }),
  });
}

export function fileMenu(root: string, e: FileEntry, staged: boolean): MenuEntry[] {
  const editor = useSettings.getState().editor ?? undefined;
  const items: MenuEntry[] = [];
  if (staged) items.push({ label: "Unstage", onSelect: () => void unstageFiles(root, [e.path]) });
  else items.push({ label: "Stage", onSelect: () => void stageFiles(root, [e.path]) });
  if (!staged) items.push({ label: e.untracked ? "Delete file…" : "Discard changes…", danger: true, onSelect: () => discardFiles(root, [e.path], e.untracked) });
  items.push(
    { label: "Open in editor", separatorBefore: true, onSelect: () => void runAction(() => api.openInEditor(root, editor, e.path)) },
    { label: "Reveal in file manager", onSelect: () => void runAction(() => api.reveal(root, e.path)) },
    { label: "Copy path", onSelect: () => void navigator.clipboard.writeText(e.path) },
  );
  return items;
}
