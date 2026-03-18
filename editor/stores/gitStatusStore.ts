import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type GitStatusKind =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "ignored"
  | "conflict"
  | "unknown";

export interface GitStatusEntry {
  path: string;
  xy: string;
  isConflict: boolean;
  isUntracked: boolean;
  isIgnored: boolean;
  hasStaged: boolean;
  hasUnstaged: boolean;
  kind: GitStatusKind;
}

export interface GitStatusState {
  statusByPath: Record<string, GitStatusEntry>;
  lastUpdatedAt: number | null;
  isRefreshing: boolean;
  lastError: string | null;

  refreshNow: (projectPath: string) => Promise<void>;
  scheduleRefresh: (projectPath: string, debounceMs?: number) => void;
  getStatus: (relativePath: string) => GitStatusEntry | null;
  clear: () => void;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<void> | null = null;

export const useGitStatusStore = create<GitStatusState>((set, get) => ({
  statusByPath: {},
  lastUpdatedAt: null,
  isRefreshing: false,
  lastError: null,

  refreshNow: async (projectPath) => {
    if (!projectPath) return;

    if (inflight) {
      return inflight;
    }

    const p = (async () => {
      set({ isRefreshing: true, lastError: null });
      try {
        const entries = await invoke<GitStatusEntry[]>("get_git_status", { projectPath });
        const map: Record<string, GitStatusEntry> = {};
        for (const e of entries) {
          if (e?.path) {
            map[e.path] = e;
          }
        }
        set({ statusByPath: map, lastUpdatedAt: Date.now(), isRefreshing: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({ isRefreshing: false, lastError: message });
      } finally {
        inflight = null;
      }
    })();

    inflight = p;
    return p;
  },

  scheduleRefresh: (projectPath, debounceMs = 300) => {
    if (!projectPath) return;

    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void get().refreshNow(projectPath);
    }, debounceMs);
  },

  getStatus: (relativePath) => {
    if (!relativePath) return null;
    return get().statusByPath[relativePath] ?? null;
  },

  clear: () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    inflight = null;
    set({ statusByPath: {}, lastUpdatedAt: null, isRefreshing: false, lastError: null });
  },
}));

