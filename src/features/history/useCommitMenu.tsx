import { useState } from "react";
import { useContextMenu, type MenuEntry } from "@/components/ui/Menu";
import { api } from "@/lib/api";
import { preview } from "@/lib/commands";
import { confirmDestructive, runOp } from "@/lib/ops";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import type { Commit } from "@/types/git";

export function commitMenu(root: string, c: Commit): MenuEntry[] {
  return [
    { label: "Copy hash", onSelect: () => void navigator.clipboard.writeText(c.hash) },
    { label: "Checkout (detached HEAD)", separatorBefore: true, onSelect: () => void runOp(`git switch --detach ${c.short}`, () => api.checkoutCommit(root, c.hash), { success: `HEAD is now at ${c.short}` }) },
    { label: "Create branch here…", onSelect: () => useUi.getState().openDialog({ kind: "createBranch", start: c.hash }) },
    { label: "Create tag here…", onSelect: () => useUi.getState().openDialog({ kind: "createTag", target: c.hash }) },
    {
      label: "Cherry-pick",
      separatorBefore: true,
      onSelect: () =>
        confirmDestructive({
          title: "Cherry-pick commit",
          command: preview.cherryPick(c.short),
          impact: `Applies the changes of ${c.short} “${c.subject}” on top of the current branch as a new commit. Conflicts may require manual resolution.`,
          confirmLabel: "Cherry-pick",
          onConfirm: () => void runOp(preview.cherryPick(c.short), () => api.cherryPick(root, c.hash), { success: `Cherry-picked ${c.short}` }),
        }),
    },
    {
      label: "Revert",
      danger: true,
      onSelect: () =>
        confirmDestructive({
          title: "Revert commit",
          command: preview.revert(c.short),
          impact: `Creates a new commit that undoes ${c.short} “${c.subject}”. History is not rewritten.`,
          confirmLabel: "Revert commit",
          onConfirm: () => void runOp(preview.revert(c.short), () => api.revert(root, c.hash), { success: `Reverted ${c.short}` }),
        }),
    },
    { label: "Interactive rebase from here…", separatorBefore: true, disabled: c.parents.length === 0, onSelect: () => useUi.getState().openDialog({ kind: "rebase", base: `${c.hash}^` }) },
  ];
}

/** Selection state plus a context menu for commit lists. */
export function useCommitMenu() {
  const root = useRepo((s) => s.repo?.root ?? "");
  const menu = useContextMenu();
  const [selected, setSelected] = useState<string | null>(null);
  return {
    selected,
    select: (c: Commit) => setSelected(c.hash),
    setSelected,
    onContextMenu: (e: React.MouseEvent, c: Commit) => {
      setSelected(c.hash);
      menu.open(e, commitMenu(root, c));
    },
    element: menu.element,
  };
}
