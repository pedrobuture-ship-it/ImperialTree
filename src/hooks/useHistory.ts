import { useCallback, useEffect, useRef, useState } from "react";
import { api, toGitError } from "@/lib/api";
import { useRepo } from "@/stores/repo";
import type { Commit, LogQuery } from "@/types/git";

const PAGE = 300;

/** Loads commits incrementally; refreshes from the start whenever the repository changes. */
export function useHistory(query: Omit<LogQuery, "skip" | "limit">, page = PAGE) {
  const root = useRepo((s) => s.repo?.root ?? "");
  const revision = useRepo((s) => s.revision);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);
  const generation = useRef(0);
  const key = JSON.stringify(query);

  const load = useCallback(
    async (reset: boolean) => {
      if (!root || (inflight.current && !reset)) return;
      const gen = reset ? ++generation.current : generation.current;
      inflight.current = true;
      setLoading(true);
      try {
        const skip = reset ? 0 : commitsRef.current.length;
        const next = await api.history(root, { ...JSON.parse(key), skip, limit: page });
        if (gen !== generation.current) return;
        setCommits((prev) => (reset ? next : [...prev, ...next]));
        setDone(next.length < page);
        setError(null);
      } catch (e) {
        if (gen === generation.current) setError(toGitError(e).message);
      } finally {
        if (gen === generation.current) {
          inflight.current = false;
          setLoading(false);
        }
      }
    },
    [root, key, page],
  );

  const commitsRef = useRef<Commit[]>([]);
  commitsRef.current = commits;

  useEffect(() => {
    inflight.current = false;
    void load(true);
  }, [load, revision]);

  const more = useCallback(() => {
    if (!done) void load(false);
  }, [done, load]);

  return { commits, loading, done, error, more };
}
