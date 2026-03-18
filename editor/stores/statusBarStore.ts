import { create } from 'zustand';

export interface StatusBarState {
  lineNumber: number;
  column: number;
  language: string | null;
  model: string | null;
  setCursor: (lineNumber: number, column: number) => void;
  setLanguage: (language: string | null) => void;
  setModel: (model: string | null) => void;
}

export const useStatusBarStore = create<StatusBarState>((set) => ({
  lineNumber: 1,
  column: 1,
  language: null,
  model: null,
  setCursor: (lineNumber, column) => set({ lineNumber, column }),
  setLanguage: (language) => set({ language }),
  setModel: (model) => set({ model }),
}));
