import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useRepo } from "@/stores/repo";

/** Keeps the repository state fresh: filesystem watcher events plus a refresh on window focus. */
export function useRepoWatcher() {
  const root = useRepo((s) => s.repo?.root);

  useEffect(() => {
    if (!root) return;
    void invoke("watch_repository", { root }).catch(() => undefined);
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void useRepo.getState().refresh(), 150);
    };
    const un = listen<string>("repo-changed", (e) => e.payload === root && schedule());
    window.addEventListener("focus", schedule);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", schedule);
      void un.then((f) => f());
      void invoke("unwatch_repository").catch(() => undefined);
    };
  }, [root]);
}
