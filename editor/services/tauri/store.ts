/**
 * Tauri Store API 封装
 */

const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

let storeInstance: Awaited<ReturnType<typeof import('@tauri-apps/plugin-store').load>> | null = null;

/**
 * 获取 Store 实例
 */
async function getStore() {
  if (!isTauri) {
    return null;
  }

  if (!storeInstance) {
    const { load } = await import('@tauri-apps/plugin-store');
    storeInstance = await load('agent-store.json');
  }

  return storeInstance;
}

/**
 * 获取存储值
 */
export async function getStoreValue<T>(key: string): Promise<T | null> {
  const store = await getStore();

  if (!store) {
    // 浏览器环境降级到 localStorage
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }

  const value = await store.get<T>(key);
  return value ?? null;
}

/**
 * 设置存储值
 */
export async function setStoreValue<T>(key: string, value: T): Promise<void> {
  const store = await getStore();

  if (!store) {
    // 浏览器环境降级到 localStorage
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }

  await store.set(key, value);
  await store.save();
}

/**
 * 删除存储值
 */
export async function deleteStoreValue(key: string): Promise<void> {
  const store = await getStore();

  if (!store) {
    localStorage.removeItem(key);
    return;
  }

  await store.delete(key);
  await store.save();
}

/**
 * 清空所有存储
 */
export async function clearStore(): Promise<void> {
  const store = await getStore();

  if (!store) {
    localStorage.clear();
    return;
  }

  const keys = await store.keys();
  for (const key of keys) {
    await store.delete(key);
  }
  await store.save();
}

/**
 * 获取所有键
 */
export async function getStoreKeys(): Promise<string[]> {
  const store = await getStore();

  if (!store) {
    return Object.keys(localStorage);
  }

  return store.keys();
}
