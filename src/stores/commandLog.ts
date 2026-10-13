import { create } from "zustand";

export interface CommandEntry {
  id: number;
  command: string;
  state: "running" | "executed" | "failed";
  time: number;
}

interface CommandLogState {
  entries: CommandEntry[];
  start: (command: string) => number;
  finish: (id: number, state: "executed" | "failed", command?: string) => void;
  clear: () => void;
}

let seq = 0;

export const useCommandLog = create<CommandLogState>((set) => ({
  entries: [],
  start: (command) => {
    const id = ++seq;
    set((s) => ({ entries: [{ id, command, state: "running" as const, time: Date.now() }, ...s.entries].slice(0, 50) }));
    return id;
  },
  finish: (id, state, command) => set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, state, command: command || e.command } : e)) })),
  clear: () => set({ entries: [] }),
}));
