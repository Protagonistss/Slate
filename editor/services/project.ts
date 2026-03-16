import * as dialog from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { normalizePath } from '../utils/pathUtils';

// Rust 后端返回的目录条目类型
interface WorkspaceDirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface ProjectFile {
  path: string;
  name: string;
  content: string;
  language: string;
  type: 'file' | 'folder';
  children?: ProjectFile[];
}

export interface ProjectInfo {
  path: string;
  name: string;
  rootFiles: ProjectFile[];
}

// 文件扩展名到语言的映射
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.html': 'html',
  '.htm': 'html',
  '.json': 'json',
  '.md': 'markdown',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.cs': 'csharp',
  '.php': 'php',
  '.rb': 'ruby',
  '.sh': 'shell',
  '.txt': 'plaintext',
};

// 获取文件的语言类型
function getLanguage(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.'));
  return EXTENSION_TO_LANGUAGE[ext] || 'plaintext';
}

// 读取文件内容
async function readFileContent(filePath: string): Promise<string> {
  try {
    // 使用 Tauri invoke 调用 Rust 命令读取文件
    const content = await invoke<string>('read_workspace_text_file', { path: filePath });
    return content;
  } catch (error) {
    console.error('Failed to read file:', error);
    return '';
  }
}

// 递归扫描目录构建项目文件树（只扫描结构，不读取内容）
async function scanDirectory(dirPath: string, baseDir: string = ''): Promise<ProjectFile[]> {
  // 使用 Rust 命令读取目录条目
  const entries = await invoke<WorkspaceDirEntry[]>('read_workspace_dir', { path: dirPath });
  const files: ProjectFile[] = [];

  for (const entry of entries) {
    // 只跳过系统级文件（.git 目录、macOS .DS_Store、Windows Thumbs.db）
    if (entry.name === '.git' || entry.name === '.DS_Store' || entry.name === 'Thumbs.db') {
      continue;
    }

    // 构建相对路径
    const baseDirNormalized = normalizePath(baseDir);
    const relativePath = baseDirNormalized ? `${baseDirNormalized}/${entry.name}` : entry.name;

    if (entry.isDirectory) {
      // 是目录 - 递归扫描
      const fullPath = entry.path;
      const children = await scanDirectory(fullPath, relativePath);
      files.push({
        path: relativePath,
        name: entry.name,
        content: '',
        language: '',
        type: 'folder',
        children,
      });
    } else {
      // 是文件 - 不读取内容，只记录信息
      files.push({
        path: relativePath,
        name: entry.name,
        content: '',  // 延迟加载
        language: getLanguage(entry.name),
        type: 'file',
      });
    }
  }

  // 排序：文件夹在前，文件在后，各自按字母顺序排序
  files.sort((a, b) => {
    if (a.type === 'folder' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  return files;
}

// 获取文件的完整路径（用于读取内容）
function getFullFilePath(projectPath: string, relativePath: string): string {
  const projectPathNormalized = normalizePath(projectPath);
  return `${projectPathNormalized}/${relativePath}`;
}

// 打开项目文件夹
export async function openProjectFolder(): Promise<ProjectInfo | null> {
  try {
    const selected = await dialog.open({
      directory: true,
      multiple: false,
      title: 'Select Project Folder',
    });

    if (selected === null || Array.isArray(selected)) {
      return null;
    }

    const projectPath = selected as string;

    // 获取目录名称作为项目名
    const projectName = projectPath.split(/[/\\]/).filter(Boolean).pop() || 'Untitled Project';

    console.log('[openProjectFolder] Selected path:', projectPath);
    console.log('[openProjectFolder] Project name:', projectName);

    // 扫描项目文件
    const rootFiles = await scanDirectory(projectPath);

    return {
      path: projectPath,
      name: projectName,
      rootFiles,
    };
  } catch (error) {
    console.error('Failed to open folder:', error);
    return null;
  }
}

// 查找项目的主要入口文件（按优先级返回单个入口文件）
export function findEntryFiles(project: ProjectInfo): ProjectFile[] {
  // 扁平化所有文件列表
  function flattenFiles(files: ProjectFile[]): ProjectFile[] {
    const result: ProjectFile[] = [];
    for (const file of files) {
      if (file.type === 'file') {
        result.push(file);
      } else if (file.children) {
        result.push(...flattenFiles(file.children));
      }
    }
    return result;
  }

  const allFiles = flattenFiles(project.rootFiles);

  // 按优先级排序的入口文件名
  const priorityEntryFiles = [
    'index.tsx', 'index.jsx',
    'main.tsx', 'main.jsx',
    'App.tsx', 'App.jsx',
    'index.ts', 'index.js',
    'main.ts', 'main.js',
    'index.html'
  ];

  // 按优先级查找第一个匹配的文件
  for (const entryName of priorityEntryFiles) {
    const found = allFiles.find(file => file.name === entryName);
    if (found) {
      return [found];
    }
  }

  return [];
}

// 从指定路径打开项目（用于恢复上次项目）
export async function openProjectByPath(projectPath: string): Promise<ProjectInfo | null> {
  try {
    console.log('[openProjectByPath] Starting to open project:', projectPath);

    // 检查路径是否存在
    const entries = await invoke<WorkspaceDirEntry[]>('read_workspace_dir', { path: projectPath });
    console.log('[openProjectByPath] Directory entries found:', entries.length);

    // 获取目录名称作为项目名
    const projectName = projectPath.split(/[/\\]/).filter(Boolean).pop() || 'Untitled Project';

    console.log('[openProjectByPath] Project name:', projectName);

    // 扫描项目文件
    const rootFiles = await scanDirectory(projectPath);
    console.log('[openProjectByPath] Root files scanned:', rootFiles.length);

    return {
      path: projectPath,
      name: projectName,
      rootFiles,
    };
  } catch (error) {
    console.error('[openProjectByPath] Failed to open project by path:', error);
    return null;
  }
}
