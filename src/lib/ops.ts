import { toGitError } from "@/lib/api";
import { useCommandLog } from "@/stores/commandLog";
import { useRepo } from "@/stores/repo";
import { useUi } from "@/stores/ui";
import type { Executed } from "@/types/git";

/**
 * Runs a Git operation with the shared UX: the command is announced before it
 * runs, replaced with the exact executed command afterwards, errors open the
 * Git error dialog with real stderr, and the repository state is refreshed.
 */
export async function runOp(preview: string, fn: () => Promise<Executed>, opts: { success?: string; refresh?: boolean } = {}): Promise<Executed | null> {
  const log = useCommandLog.getState();
  const id = log.start(preview);
  try {
    const out = await fn();
    log.finish(id, "executed", out.command || preview);
    if (opts.success) useUi.getState().toast({ tone: "ok", title: "OPERATION COMPLETE", detail: opts.success });
    if (opts.refresh !== false) await useRepo.getState().refresh();
    return out;
  } catch (e) {
    const err = toGitError(e);
    log.finish(id, "failed", err.command || preview);
    useUi.getState().openDialog({ kind: "error", error: err });
    // A failed operation may still have changed state (e.g. a merge with conflicts).
    if (opts.refresh !== false) await useRepo.getState().refresh();
    return null;
  }
}

/** Runs a read-only/non-Git side effect and reports errors uniformly. */
export async function runAction<T>(fn: () => Promise<T>, success?: string): Promise<T | null> {
  try {
    const r = await fn();
    if (success) useUi.getState().toast({ tone: "info", title: success });
    return r;
  } catch (e) {
    useUi.getState().openDialog({ kind: "error", error: toGitError(e) });
    return null;
  }
}

export function confirmDestructive(opts: { title: string; command: string; impact: string; confirmLabel?: string; typeToConfirm?: string; onConfirm: () => void }) {
  useUi.getState().openDialog({ kind: "confirm", confirmLabel: "Confirm", ...opts });
}
