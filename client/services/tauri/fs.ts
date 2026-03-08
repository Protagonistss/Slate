/**
 * Tauri 文件系统 API 封装
 */

// 检查是否在 Tauri 环境中（兼容 v2 默认注入）
const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size?: number;
  modified?: number;
}

/**
 * 前端统一使用正斜杠路径，便于状态对比
 */
function toUiPath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * 是否为 Windows 绝对路径（盘符或 UNC）
 */
function isWindowsAbsolutePath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\');
}

/**
 * 生成可尝试的路径格式（兼容不同分隔符）
 */
function buildPathCandidates(path: string): string[] {
  const candidates = [path];

  if (isWindowsAbsolutePath(path)) {
    const backslashPath = path.replace(/\//g, '\\');
    const slashPath = path.replace(/\\/g, '/');

    if (!candidates.includes(backslashPath)) {
      candidates.push(backslashPath);
    }
    if (!candidates.includes(slashPath)) {
      candidates.push(slashPath);
    }
  }

  return candidates;
}

/**
 * 按 base 路径风格拼接子路径
 */
function joinChildPath(base: string, name: string): string {
  const useBackslash = isWindowsAbsolutePath(base) || base.includes('\\');
  const sep = useBackslash ? '\\' : '/';

  const normalizedBase = useBackslash
    ? base.replace(/[\\/]+$/, '')
    : base.replace(/\/+$/, '');
  const normalizedName = useBackslash
    ? name.replace(/[\\/]+/g, '\\').replace(/^\\+|\\+$/g, '')
    : name.replace(/[\\/]+/g, '/').replace(/^\/+|\/+$/g, '');

  if (!normalizedName) {
    return normalizedBase;
  }
  if (!normalizedBase) {
    return normalizedName;
  }

  return `${normalizedBase}${sep}${normalizedName}`;
}

/**
 * 调用后端工作区命令（失败时返回 null，由插件 API 兜底）
 */
async function invokeWorkspaceCommand<T>(
  command: 'read_workspace_dir' | 'read_workspace_text_file',
  path: string
): Promise<T | null> {
  if (!isTauri) {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, { path });
  } catch {
    return null;
  }
}

/**
 * 读取文本文件
 */
export async function readTextFile(path: string): Promise<string> {
  if (!isTauri) {
    throw new Error('File system not available in browser');
  }

  const backendContent = await invokeWorkspaceCommand<string>('read_workspace_text_file', path);
  if (typeof backendContent === 'string') {
    return backendContent;
  }

  const { readTextFile: tauriReadTextFile } = await import('@tauri-apps/plugin-fs');
  let lastError: unknown;

  for (const candidate of buildPathCandidates(path)) {
    try {
      return await tauriReadTextFile(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Failed to read file: ${path}`);
}

/**
 * 写入文本文件
 */
export async function writeTextFile(path: string, content: string): Promise<void> {
  if (!isTauri) {
    throw new Error('File system not available in browser');
  }

  const { writeTextFile: tauriWriteTextFile } = await import('@tauri-apps/plugin-fs');
  let lastError: unknown;

  for (const candidate of buildPathCandidates(path)) {
    try {
      await tauriWriteTextFile(candidate, content);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Failed to write file: ${path}`);
}

/**
 * 检查文件/目录是否存在
 */
export async function exists(path: string): Promise<boolean> {
  if (!isTauri) {
    return false;
  }

  const { exists: tauriExists } = await import('@tauri-apps/plugin-fs');
  let lastError: unknown;

  for (const candidate of buildPathCandidates(path)) {
    try {
      return await tauriExists(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Failed to check path exists: ${path}`);
}

/**
 * 创建目录
 */
export async function createDir(path: string, recursive = false): Promise<void> {
  if (!isTauri) {
    throw new Error('File system not available in browser');
  }

  const { mkdir } = await import('@tauri-apps/plugin-fs');
  let lastError: unknown;

  for (const candidate of buildPathCandidates(path)) {
    try {
      await mkdir(candidate, { recursive });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Failed to create directory: ${path}`);
}

/**
 * 删除文件/目录
 */
export async function remove(path: string, recursive = false): Promise<void> {
  if (!isTauri) {
    throw new Error('File system not available in browser');
  }

  const { remove: tauriRemove } = await import('@tauri-apps/plugin-fs');
  let lastError: unknown;

  for (const candidate of buildPathCandidates(path)) {
    try {
      await tauriRemove(candidate, { recursive });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Failed to remove path: ${path}`);
}

/**
 * 读取目录内容
 */
export async function readDir(path: string): Promise<FileInfo[]> {
  if (!isTauri) {
    return [];
  }

  const backendEntries = await invokeWorkspaceCommand<FileInfo[]>('read_workspace_dir', path);
  if (Array.isArray(backendEntries)) {
    return backendEntries.map((entry) => ({
      ...entry,
      path: toUiPath(entry.path),
    }));
  }

  const { readDir: tauriReadDir } = await import('@tauri-apps/plugin-fs');

  let entries: Awaited<ReturnType<typeof tauriReadDir>> | null = null;
  let resolvedPath = path;
  let lastError: unknown;

  for (const candidate of buildPathCandidates(path)) {
    try {
      entries = await tauriReadDir(candidate);
      resolvedPath = candidate;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!entries) {
    throw lastError ?? new Error(`Failed to read directory: ${path}`);
  }

  return entries.map((entry) => ({
    name: entry.name || '',
    path: toUiPath(joinChildPath(resolvedPath, entry.name || '')),
    isDirectory: entry.isDirectory,
    isFile: entry.isFile,
  }));
}

/**
 * 获取用户主目录
 */
export async function getHomeDir(): Promise<string | null> {
  if (!isTauri) {
    return null;
  }
  // 浏览器环境没有 homeDir
  return null;
}

/**
 * 获取文档目录
 */
export async function getDocumentDir(): Promise<string | null> {
  if (!isTauri) {
    return null;
  }
  // 浏览器环境没有 documentDir
  return null;
}
