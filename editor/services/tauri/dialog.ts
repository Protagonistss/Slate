/**
 * Tauri 对话框 API 封装
 */

// 检查是否在 Tauri 环境中（兼容 v2 默认注入）
const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

/**
 * 打开文件夹选择对话框
 * @returns 选择的文件夹路径，如果取消则返回 null
 */
export async function openFolderDialog(): Promise<string | null> {
  if (!isTauri) {
    console.warn('Dialog not available in browser');
    return null;
  }

  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择文件夹',
    });

    return selected as string | null;
  } catch (error) {
    console.error('Failed to open folder dialog:', error);
    return null;
  }
}

/**
 * 打开文件选择对话框
 * @param filters 文件过滤器
 * @returns 选择的文件路径，如果取消则返回 null
 */
export async function openFileDialog(filters?: { name: string; extensions: string[] }[]): Promise<string | null> {
  if (!isTauri) {
    console.warn('Dialog not available in browser');
    return null;
  }

  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      directory: false,
      multiple: false,
      filters,
      title: '选择文件',
    });

    return selected as string | null;
  } catch (error) {
    console.error('Failed to open file dialog:', error);
    return null;
  }
}

/**
 * 打开保存文件对话框
 * @param defaultPath 默认路径
 * @param filters 文件过滤器
 * @returns 选择的保存路径，如果取消则返回 null
 */
export async function saveFileDialog(
  defaultPath?: string,
  filters?: { name: string; extensions: string[] }[]
): Promise<string | null> {
  if (!isTauri) {
    console.warn('Dialog not available in browser');
    return null;
  }

  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const selected = await save({
      defaultPath,
      filters,
      title: '保存文件',
    });

    return selected;
  } catch (error) {
    console.error('Failed to open save dialog:', error);
    return null;
  }
}
