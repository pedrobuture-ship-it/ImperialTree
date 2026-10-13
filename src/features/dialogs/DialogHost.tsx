import { useUi } from "@/stores/ui";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorDialog } from "./ErrorDialog";
import { AddRemoteDialog, CloneDialog, CreateBranchDialog, CreateStashDialog, CreateTagDialog, CreateWorktreeDialog, RenameBranchDialog } from "./FormDialogs";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { RebaseDialog } from "@/features/rebase/RebaseDialog";

export function DialogHost() {
  const d = useUi((s) => s.dialog);
  if (!d) return null;
  switch (d.kind) {
    case "confirm":
      return <ConfirmDialog {...d} />;
    case "error":
      return <ErrorDialog error={d.error} />;
    case "createBranch":
      return <CreateBranchDialog start={d.start} />;
    case "renameBranch":
      return <RenameBranchDialog name={d.name} />;
    case "createTag":
      return <CreateTagDialog target={d.target} />;
    case "createStash":
      return <CreateStashDialog />;
    case "createWorktree":
      return <CreateWorktreeDialog branch={d.branch} />;
    case "clone":
      return <CloneDialog />;
    case "addRemote":
      return <AddRemoteDialog />;
    case "shortcuts":
      return <ShortcutsDialog />;
    case "rebase":
      return <RebaseDialog base={d.base} />;
  }
}
