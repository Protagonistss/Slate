import { create } from 'zustand';
import { FileInfo, readDir } from '../services/tauri/fs';

// 规范化路径（统一使用正斜杠）
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

// 文件树节点
export interface FileTreeNode extends FileInfo {
  children?: FileTreeNode[];
  isLoading?: boolean;
  isExpanded?: boolean;
}

// 工作区状态
export interface WorkspaceState {
  // 当前打开的工作区路径
  workspacePath: string | null;
  workspaceName: string | null;
  // 文件树根节点
  fileTree: FileTreeNode[];
  // 展开的文件夹路径集合
  expandedPaths: Set<string>;
  // 是否正在加载
  isLoading: boolean;
  // 错误信息
  error: string | null;

  // Actions
  openWorkspace: (path: string) => Promise<void>;
  closeWorkspace: () => void;
  toggleFolder: (path: string) => Promise<void>;
  expandFolder: (path: string) => Promise<void>;
  collapseFolder: (path: string) => void;
  refreshFolder: (path: string) => Promise<void>;
}

// 排序文件列表：文件夹在前，然后按名称排序
function sortFiles(files: FileInfo[]): FileInfo[] {
  return [...files].sort((a, b) => {
    // 文件夹优先
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    // 按名称排序（忽略大小写）
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

// 过滤隐藏文件和常见忽略目录
function shouldShowFile(name: string): boolean {
  // 隐藏文件（以 . 开头）
  if (name.startsWith('.')) return false;
  // node_modules
  if (name === 'node_modules') return false;
  // 常见构建输出目录
  if (['dist', 'build', 'out', 'target', 'bin', 'obj'].includes(name)) return false;
  return true;
}

// 递归加载目录内容
async function loadDirectory(path: string): Promise<FileTreeNode[]> {
  try {
    const entries = await readDir(path);
    const filtered = entries.filter(e => shouldShowFile(e.name));
    const sorted = sortFiles(filtered);

    return sorted.map(entry => ({
      ...entry,
      children: entry.isDirectory ? [] : undefined,
      isLoading: false,
      isExpanded: false,
    }));
  } catch (error) {
    console.error(`Failed to load directory ${path}:`, error);
    return [];
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspacePath: null,
  workspaceName: null,
  fileTree: [],
  expandedPaths: new Set(),
  isLoading: false,
  error: null,

  openWorkspace: async (path: string) => {
    set({ isLoading: true, error: null });

    try {
      const children = await loadDirectory(path);
      const pathParts = path.replace(/\\/g, '/').split('/');
      const workspaceName = pathParts[pathParts.length - 1] || path;

      set({
        workspacePath: path,
        workspaceName,
        fileTree: children,
        expandedPaths: new Set(),
        isLoading: false,
      });
    } catch (error) {
      set({
        error: `无法打开文件夹: ${error}`,
        isLoading: false,
      });
    }
  },

  closeWorkspace: () => {
    set({
      workspacePath: null,
      workspaceName: null,
      fileTree: [],
      expandedPaths: new Set(),
      error: null,
    });
  },

  toggleFolder: async (path: string) => {
    const { expandedPaths } = get();
    const normalizedPath = normalizePath(path);
    if (expandedPaths.has(normalizedPath)) {
      get().collapseFolder(path);
    } else {
      await get().expandFolder(path);
    }
  },

  expandFolder: async (path: string) => {
    const { fileTree, expandedPaths } = get();
    const normalizedPath = normalizePath(path);

    // 添加到展开集合
    const newExpanded = new Set(expandedPaths);
    newExpanded.add(normalizedPath);
    set({ expandedPaths: newExpanded });

    // 递归更新文件树中对应节点的 children
    const updateNodeChildren = async (nodes: FileTreeNode[]): Promise<FileTreeNode[]> => {
      return Promise.all(nodes.map(async (node) => {
        const nodePath = normalizePath(node.path);
        if (nodePath === normalizedPath && node.isDirectory) {
          const children = await loadDirectory(node.path);
          return { ...node, children, isExpanded: true, isLoading: false };
        }
        // 继续递归子节点（即使 children 是空数组也要检查，因为需要找到深层节点）
        if (node.children != null) {
          const updatedChildren = await updateNodeChildren(node.children);
          // 只有当 children 有变化时才更新
          if (updatedChildren !== node.children) {
            return { ...node, children: updatedChildren };
          }
        }
        return node;
      }));
    };

    const newTree = await updateNodeChildren(fileTree);
    set({ fileTree: newTree });
  },

  collapseFolder: (path: string) => {
    const { expandedPaths } = get();
    const normalizedPath = normalizePath(path);
    const newExpanded = new Set(expandedPaths);
    newExpanded.delete(normalizedPath);
    set({ expandedPaths: newExpanded });

    // 更新节点状态
    const updateNodeExpanded = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.map((node) => {
        if (normalizePath(node.path) === normalizedPath) {
          return { ...node, isExpanded: false };
        }
        if (node.children) {
          return { ...node, children: updateNodeExpanded(node.children) };
        }
        return node;
      });
    };

    set(state => ({ fileTree: updateNodeExpanded(state.fileTree) }));
  },

  refreshFolder: async (path: string) => {
    const { fileTree, expandedPaths } = get();
    const normalizedPath = normalizePath(path);

    if (!expandedPaths.has(normalizedPath)) {
      return;
    }

    // 递归刷新文件树
    const refreshNode = async (nodes: FileTreeNode[]): Promise<FileTreeNode[]> => {
      return Promise.all(nodes.map(async (node) => {
        if (normalizePath(node.path) === normalizedPath && node.isDirectory) {
          const children = await loadDirectory(node.path);
          return { ...node, children };
        }
        if (node.children) {
          return { ...node, children: await refreshNode(node.children) };
        }
        return node;
      }));
    };

    const newTree = await refreshNode(fileTree);
    set({ fileTree: newTree });
  },
}));
