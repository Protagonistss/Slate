import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { TerminalSession, TerminalStatus } from '@/services/terminal/types';

interface TerminalState {
  sessions: TerminalSession[];
  activeId: string | null;
  panelVisible: boolean;
  panelHeight: number;

  createSession: (cwd?: string) => string;
  updateSessionStatus: (id: string, status: TerminalStatus, exitCode?: number) => void;
  closeSession: (id: string) => void;
  setActive: (id: string | null) => void;
  togglePanel: () => void;
  setPanelVisible: (visible: boolean) => void;
  setPanelHeight: (height: number) => void;
  renameSession: (id: string, title: string) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: [],
  activeId: null,
  panelVisible: false,
  panelHeight: 200,

  createSession: (cwd = process.cwd?.() || '~') => {
    const id = uuidv4();
    const session: TerminalSession = {
      id,
      title: `Terminal ${get().sessions.length + 1}`,
      cwd,
      status: 'starting',
      createdAt: Date.now(),
    };

    set((state) => ({
      sessions: [...state.sessions, session],
      activeId: id,
      panelVisible: true,
    }));

    return id;
  },

  updateSessionStatus: (id, status, exitCode) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, status, exitCode } : s
      ),
    }));
  },

  closeSession: (id) => {
    set((state) => {
      const remaining = state.sessions.filter((s) => s.id !== id);
      const newActiveId =
        state.activeId === id
          ? remaining.length > 0
            ? remaining[remaining.length - 1].id
            : null
          : state.activeId;

      return {
        sessions: remaining,
        activeId: newActiveId,
        panelVisible: remaining.length > 0 ? state.panelVisible : false,
      };
    });
  },

  setActive: (id) => set({ activeId: id }),

  togglePanel: () => set((state) => ({ panelVisible: !state.panelVisible })),

  setPanelVisible: (visible) => set({ panelVisible: visible }),

  setPanelHeight: (height) => set({ panelHeight: height }),

  renameSession: (id, title) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s)),
    }));
  },
}));
