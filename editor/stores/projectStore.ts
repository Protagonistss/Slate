import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { ProjectInfo, ProjectFile } from '../services/project';
import { openProjectFolder, findEntryFiles, openProjectByPath } from '../services/project';
import { setProjectDir, getCurrentProjectPath } from '../services/config';

// Re-export types for convenience
export type { ProjectInfo, ProjectFile } from '../services/project';

interface ProjectState {
  currentProject: ProjectInfo | null;
  projectFiles: ProjectFile[];
  isInitialized: boolean;

  openProject: () => Promise<void>;
  openProjectByPath: (path: string) => Promise<void>;
  restoreLastProject: () => Promise<boolean>;  // 返回是否成功恢复了项目
  closeProject: () => void;
  getProjectFiles: () => ProjectFile[];
  loadProject: (project: ProjectInfo) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  projectFiles: [],
  isInitialized: false,

  // 内部函数：加载项目的通用逻辑
  loadProject: async (project: ProjectInfo) => {
    // 通知后端记录项目
    await setProjectDir(project.path);

    // 同步更新 configStore.workingDirectory（供 Agent 使用）
    const { useConfigStore } = await import('./configStore');
    useConfigStore.getState().setWorkingDirectory(project.path);

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
  },

  openProject: async () => {
    const project = await openProjectFolder();
    if (project) {
      await get().loadProject(project);
    }
  },

  openProjectByPath: async (path: string) => {
    const project = await openProjectByPath(path);
    if (project) {
      await get().loadProject(project);
    }
  },

  restoreLastProject: async () => {
    // 避免重复初始化
    if (get().isInitialized) {
      return false;
    }

    set({ isInitialized: true });

    try {
      const lastProjectPath = await getCurrentProjectPath();
      console.log('[restoreLastProject] Current project path from backend:', lastProjectPath);
      if (lastProjectPath) {
        console.log('[restoreLastProject] Restoring project:', lastProjectPath);
        await get().openProjectByPath(lastProjectPath);
        // 检查是否成功打开了项目
        const success = get().currentProject !== null;
        console.log('[restoreLastProject] Project restored:', success);
        return success;
      } else {
        console.log('[restoreLastProject] No last project found');
        return false;
      }
    } catch (error) {
      console.error('[restoreLastProject] Failed to restore last project:', error);
      return false;
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
