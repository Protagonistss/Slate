import { create } from 'zustand';

// 应用模式
export type AppMode = 'editor' | 'agent';

// 设置面板标签
export type SettingsTab = 'general' | 'llm' | 'appearance' | 'shortcuts';

// UI 状态
export interface UIState {
  // 模式
  mode: AppMode;

  // 侧边栏
  sidebarVisible: boolean;
  sidebarWidth: number;

  // Agent 面板
  agentPanelVisible: boolean;
  agentPanelWidth: number;

  // 设置
  settingsOpen: boolean;
  settingsTab: SettingsTab;

  // Toast 通知
  toasts: Toast[];

  // 模态框
  confirmModal: ConfirmModal | null;

  // Actions
  setMode: (mode: AppMode) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleAgentPanel: () => void;
  setAgentPanelWidth: (width: number) => void;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setSettingsTab: (tab: SettingsTab) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  showConfirm: (modal: Omit<ConfirmModal, 'id'>) => Promise<boolean>;
  closeConfirm: () => void;
}

// Toast 类型
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// 确认模态框类型
export interface ConfirmModal {
  id: string;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  resolve: (value: boolean) => void;
}

let confirmResolve: ((value: boolean) => void) | null = null;

export const useUIStore = create<UIState>((set, get) => ({
  mode: 'agent',
  sidebarVisible: true,
  sidebarWidth: 250,
  agentPanelVisible: true,
  agentPanelWidth: 400,
  settingsOpen: false,
  settingsTab: 'general',
  toasts: [],
  confirmModal: null,

  setMode: (mode) => set({ mode }),

  toggleSidebar: () =>
    set((state) => ({ sidebarVisible: !state.sidebarVisible })),

  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),

  toggleAgentPanel: () =>
    set((state) => ({ agentPanelVisible: !state.agentPanelVisible })),

  setAgentPanelWidth: (agentPanelWidth) => set({ agentPanelWidth }),

  openSettings: (tab = 'general') =>
    set({
      settingsOpen: true,
      settingsTab: tab,
    }),

  closeSettings: () => set({ settingsOpen: false }),

  setSettingsTab: (settingsTab) => set({ settingsTab }),

  addToast: (toast) => {
    const id = Date.now().toString();
    const newToast: Toast = { ...toast, id };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // 自动移除
    const duration = toast.duration ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  showConfirm: (modal) => {
    return new Promise((resolve) => {
      const id = Date.now().toString();
      confirmResolve = resolve;

      set({
        confirmModal: {
          ...modal,
          id,
          resolve,
        },
      });
    });
  },

  closeConfirm: () => {
    set({ confirmModal: null });
    confirmResolve = null;
  },
}));
