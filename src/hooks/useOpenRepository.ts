import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useRepo } from "@/stores/repo";

/** Returns a function that shows the native folder picker and opens the chosen repository. */
export function useOpenRepositoryDialog() {
  const openRepo = useRepo((s) => s.open);
  return useCallback(async () => {
    const picked = await open({ directory: true, multiple: false, title: "Open Git repository" });
    if (typeof picked === "string") await openRepo(picked);
  }, [openRepo]);
}
