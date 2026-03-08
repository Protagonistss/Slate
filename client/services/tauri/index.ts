export * from './fs';
export * from './shell';
export * from './http';
export * from './store';

// 检查是否在 Tauri 环境中（兼容 v2 默认注入）
export const isTauriEnv =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
