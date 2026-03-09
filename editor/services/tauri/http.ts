/**
 * Tauri HTTP API 封装
 */

const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  timeout?: number;
}

export interface FetchResponse {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  data: unknown;
}

/**
 * 发送 HTTP 请求
 */
export async function fetchWithTauri(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResponse> {
  const { method = 'GET', headers = {}, body, timeout } = options;

  if (isTauri) {
    const tauriHttp = await import('@tauri-apps/plugin-http');

    const response = await tauriHttp.fetch(url, {
      method,
      headers,
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      connectTimeout: timeout || 30000,
    });

    // 将 Headers 转换为 Record
    const headersObj: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    // 尝试解析 JSON 响应
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // 如果不是 JSON，尝试获取文本
      try {
        data = await response.text();
      } catch {
        // 忽略
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      headers: headersObj,
      data,
    };
  }

  // 浏览器环境降级
  const response = await fetch(url, {
    method,
    headers,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    signal: timeout ? AbortSignal.timeout(timeout) : undefined,
  });

  const data = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    data,
  };
}

/**
 * GET 请求
 */
export async function get(url: string, headers?: Record<string, string>): Promise<FetchResponse> {
  return fetchWithTauri(url, { method: 'GET', headers });
}

/**
 * POST 请求
 */
export async function post(
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<FetchResponse> {
  return fetchWithTauri(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body as Record<string, unknown>,
  });
}
