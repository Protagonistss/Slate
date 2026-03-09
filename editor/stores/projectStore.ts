import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { ProjectInfo, ProjectFile } from '../services/project';
import { openProjectFolder, findEntryFiles } from '../services/project';

// Re-export types for convenience
export type { ProjectInfo, ProjectFile } from '../services/project';

interface ProjectState {
  currentProject: ProjectInfo | null;
  projectFiles: ProjectFile[];

  openProject: () => Promise<void>;
  closeProject: () => void;
  getProjectFiles: () => ProjectFile[];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  projectFiles: [],

  openProject: async () => {
    const project = await openProjectFolder();
    if (project) {
      set({
        currentProject: project,
        projectFiles: project.rootFiles,
      });

      // 打开主要入口文件（懒加载内容）
      const entryFiles = findEntryFiles(project);
      if (entryFiles.length > 0) {
        const { useEditorStore } = await import('../stores/editorStore');
        const editorStore = useEditorStore.getState();

        // 关闭所有现有文件
        editorStore.closeAllFiles();

        // 打开入口文件（按需加载内容）
        for (const file of entryFiles) {
          const fullFilePath = await join(project.path, file.path.replace(/\//g, '\\'));
          const content = await invoke<string>('read_workspace_text_file', { path: fullFilePath });
          editorStore.openFile(file.path, file.name, content, file.language);
        }
      }
    }
  },

  closeProject: () => {
    set({
      currentProject: null,
      projectFiles: [],
    });
  },

  getProjectFiles: () => {
    return get().projectFiles;
  },
}));
