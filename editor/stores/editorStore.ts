import { create } from 'zustand';

// 打开的文件标签
export interface FileTab {
  path: string;
  name: string;
  content: string;
  language: string;
  isModified: boolean;
}

// 编辑器状态
export interface EditorState {
  // 打开的文件
  openFiles: FileTab[];
  activeFilePath: string | null;

  // 编辑器设置
  theme: string;
  fontSize: number;
  wordWrap: 'on' | 'off';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';

  // Actions
  openFile: (path: string, name: string, content: string, language?: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  updateFileContent: (path: string, content: string) => void;
  markFileModified: (path: string, modified: boolean) => void;
  setEditorTheme: (theme: string) => void;
  setEditorFontSize: (size: number) => void;
  setWordWrap: (wrap: 'on' | 'off') => void;
  setMinimap: (enabled: boolean) => void;
  setLineNumbers: (mode: 'on' | 'off' | 'relative') => void;
  getActiveFile: () => FileTab | undefined;
  closeAllFiles: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  openFiles: [],
  activeFilePath: null,
  theme: 'vs-dark',
  fontSize: 14,
  wordWrap: 'on',
  minimap: true,
  lineNumbers: 'on',

  openFile: (path, name, content, language = 'plaintext') =>
    set((state) => {
      // 如果文件已经打开，直接激活
      const existingIndex = state.openFiles.findIndex((f) => f.path === path);
      if (existingIndex >= 0) {
        return { activeFilePath: path };
      }

      const newFile: FileTab = {
        path,
        name,
        content,
        language,
        isModified: false,
      };

      return {
        openFiles: [...state.openFiles, newFile],
        activeFilePath: path,
      };
    }),

  closeFile: (path) =>
    set((state) => {
      const newFiles = state.openFiles.filter((f) => f.path !== path);
      let newActivePath = state.activeFilePath;

      // 如果关闭的是当前活动文件，切换到相邻文件
      if (state.activeFilePath === path) {
        const closedIndex = state.openFiles.findIndex((f) => f.path === path);
        if (newFiles.length > 0) {
          // 优先选择右边的文件，否则选择左边的
          newActivePath =
            newFiles[Math.min(closedIndex, newFiles.length - 1)].path;
        } else {
          newActivePath = null;
        }
      }

      return {
        openFiles: newFiles,
        activeFilePath: newActivePath,
      };
    }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  updateFileContent: (path, content) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, content, isModified: true } : f
      ),
    })),

  markFileModified: (path, modified) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, isModified: modified } : f
      ),
    })),

  setEditorTheme: (theme) => set({ theme }),
  setEditorFontSize: (fontSize) => set({ fontSize }),
  setWordWrap: (wordWrap) => set({ wordWrap }),
  setMinimap: (minimap) => set({ minimap }),
  setLineNumbers: (lineNumbers) => set({ lineNumbers }),

  getActiveFile: () => {
    const state = get();
    return state.openFiles.find((f) => f.path === state.activeFilePath);
  },

  closeAllFiles: () =>
    set({
      openFiles: [],
      activeFilePath: null,
    }),
}));
