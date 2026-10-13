import type { MenuEntry } from "@/components/ui/Menu";
import { api } from "@/lib/api";
import { preview } from "@/lib/commands";
import { confirmDestructive, runOp } from "@/lib/ops";
import { useSettings } from "@/stores/settings";
import { useUi } from "@/stores/ui";
import type { Branch } from "@/types/git";

/** Shared context menu for a branch, used by the sidebar, branch manager and quick switcher. */
export function branchMenu(b: Branch, root: string): MenuEntry[] {
  const checkout = () => {
    useSettings.getState().pushRecentBranch(b.name);
    return runOp(preview.checkout(b.name), () => api.checkout(root, b.name), { success: `Switched to ${b.name}` });
  };
  const items: MenuEntry[] = [
    { label: "Checkout", disabled: b.current, onSelect: () => void checkout() },
    { label: "Create branch from here…", onSelect: () => useUi.getState().openDialog({ kind: "createBranch", start: b.name }) },
    { label: "Create worktree…", onSelect: () => useUi.getState().openDialog({ kind: "createWorktree", branch: b.name }) },
    { label: "Merge into current", disabled: b.current, separatorBefore: true, onSelect: () => void runOp(preview.merge(b.name), () => api.merge(root, b.name), { success: `Merged ${b.name}` }) },
    { label: "Rebase current onto this", disabled: b.current, onSelect: () => void runOp(preview.rebase(b.name), () => api.rebaseOnto(root, b.name), { success: `Rebased onto ${b.name}` }) },
    { label: "Copy branch name", separatorBefore: true, onSelect: () => void navigator.clipboard.writeText(b.name) },
  ];
  if (!b.remote) {
    items.push(
      { label: "Rename…", separatorBefore: true, onSelect: () => useUi.getState().openDialog({ kind: "renameBranch", name: b.name }) },
      {
        label: "Delete",
        danger: true,
        disabled: b.current,
        onSelect: () =>
          confirmDestructive({
            title: `Delete branch ${b.name}`,
            command: preview.deleteBranch(b.name, true),
            impact: b.ahead > 0 ? `Commits only on ${b.name} may become unreachable (recoverable through the reflog).` : `Deletes the local branch ${b.name}. Its commits stay in the repository until garbage collected.`,
            confirmLabel: "Delete branch",
            onConfirm: () => void runOp(preview.deleteBranch(b.name, true), () => api.deleteBranch(root, b.name, true), { success: `Deleted ${b.name}` }),
          }),
      },
    );
  }
  return items;
}
