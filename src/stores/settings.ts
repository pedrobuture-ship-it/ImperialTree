import { create } from "zustand";
import { api } from "@/lib/api";

export interface RecentRepo {
  path: string;
  name: string;
  branch: string | null;
  lastOpened: number;
}

interface Persisted {
  recents: RecentRepo[];
  showCommand: boolean;
  editor: string | null;
  terminal: string | null;
  conventional: boolean;
  recentBranches: string[];
}

interface SettingsState extends Persisted {
  loaded: boolean;
  load: () => Promise<void>;
  patch: (p: Partial<Persisted>) => void;
  touchRecent: (r: RecentRepo) => void;
  removeRecent: (path: string) => void;
  pushRecentBranch: (name: string) => void;
}

const DEFAULTS: Persisted = { recents: [], showCommand: true, editor: null, terminal: null, conventional: false, recentBranches: [] };

function snapshot(s: SettingsState): Persisted {
  return { recents: s.recents, showCommand: s.showCommand, editor: s.editor, terminal: s.terminal, conventional: s.conventional, recentBranches: s.recentBranches };
}

let saveTimer: number | undefined;
function scheduleSave(get: () => SettingsState) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    api.saveState(JSON.stringify(snapshot(get()))).catch(() => undefined);
  }, 250);
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    try {
      const parsed = JSON.parse(await api.loadState()) as Partial<Persisted>;
      set({ ...DEFAULTS, ...parsed, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  patch: (p) => {
    set(p);
    scheduleSave(get);
  },
  touchRecent: (r) => {
    set((s) => ({ recents: [r, ...s.recents.filter((x) => x.path !== r.path)].slice(0, 20) }));
    scheduleSave(get);
  },
  removeRecent: (path) => {
    set((s) => ({ recents: s.recents.filter((x) => x.path !== path) }));
    scheduleSave(get);
  },
  pushRecentBranch: (name) => {
    set((s) => ({ recentBranches: [name, ...s.recentBranches.filter((b) => b !== name)].slice(0, 8) }));
    scheduleSave(get);
  },
}));
