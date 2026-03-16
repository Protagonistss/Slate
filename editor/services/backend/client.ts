import { fetchWithTauri, type FetchResponse } from "@/services/tauri/http";
import { getBackendNetworkErrorMessage } from "./base";

export const SESSION_EXPIRED_MESSAGE = "登录已过期，请重新登录";

export class SessionExpiredError extends Error {
  readonly code = "SESSION_EXPIRED";

  constructor(message = SESSION_EXPIRED_MESSAGE) {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export function isSessionExpiredError(error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}

type BackendAuthMode = "required" | "none";

interface BackendRequestBaseOptions {
  url: string;
  auth?: BackendAuthMode;
  retryOn401?: boolean;
  accessTokenOverride?: string | null;
  headers?: Record<string, string>;
  networkErrorMessage?: string;
}

export interface BackendRequestOptions extends BackendRequestBaseOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  timeout?: number;
}

export interface BackendStreamRequestOptions extends BackendRequestBaseOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  signal?: AbortSignal;
}

interface AuthStoreController {
  accessToken: string | null;
  refreshAccessToken: () => Promise<string | null>;
  handleSessionExpired: (message?: string) => void;
}

async function getAuthController(): Promise<AuthStoreController> {
  const { useAuthStore } = await import("@/stores/authStore");
  return useAuthStore.getState();
}

async function resolveAuthorizationToken(
  options: BackendRequestBaseOptions,
  accessTokenOverride?: string | null
): Promise<string | null> {
  if (options.auth !== "required") {
    return null;
  }

  const overrideToken = accessTokenOverride ?? options.accessTokenOverride;
  if (typeof overrideToken === "string" && overrideToken.trim()) {
    return overrideToken;
  }

  const auth = await getAuthController();
  const currentToken = auth.accessToken?.trim();
  if (!currentToken) {
    throw new Error("请先登录 backend 账号");
  }

  return currentToken;
}

async function buildHeaders(
  options: BackendRequestBaseOptions,
  accessTokenOverride?: string | null
): Promise<Record<string, string>> {
  const headers = { ...(options.headers || {}) };
  const token = await resolveAuthorizationToken(options, accessTokenOverride);

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function shouldRetryOn401(options: BackendRequestBaseOptions, status: number): boolean {
  return options.auth === "required" && options.retryOn401 !== false && status === 401;
}

function hasHeader(headers: Record<string, string>, headerName: string): boolean {
  const target = headerName.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === target);
}

function normalizeJsonBody(body: unknown): string | Record<string, unknown> | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === "string") {
    return body;
  }

  return body as Record<string, unknown>;
}

async function buildRequestPayload(
  options: BackendRequestBaseOptions & { body?: unknown },
  accessTokenOverride?: string | null
): Promise<{ headers: Record<string, string>; body: string | Record<string, unknown> | undefined }> {
  const headers = await buildHeaders(options, accessTokenOverride);
  const body = normalizeJsonBody(options.body);

  if (body && typeof body !== "string" && !hasHeader(headers, "Content-Type")) {
    headers["Content-Type"] = "application/json";
  }

  return { headers, body };
}

async function performRequest(
  options: BackendRequestOptions,
  accessTokenOverride?: string | null
): Promise<FetchResponse> {
  try {
    const { headers, body } = await buildRequestPayload(options, accessTokenOverride);
    return await fetchWithTauri(options.url, {
      method: options.method || "GET",
      headers,
      body,
      timeout: options.timeout,
    });
  } catch (error) {
    throw new Error(getBackendNetworkErrorMessage(error, options.networkErrorMessage || "请求失败"));
  }
}

async function performStreamRequest(
  options: BackendStreamRequestOptions,
  accessTokenOverride?: string | null
): Promise<Response> {
  try {
    const { headers, body } = await buildRequestPayload(options, accessTokenOverride);
    return await fetch(options.url, {
      method: options.method || "GET",
      headers,
      body: typeof body === "string" ? body : body ? JSON.stringify(body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    throw new Error(getBackendNetworkErrorMessage(error, options.networkErrorMessage || "请求失败"));
  }
}

async function retryRequestWithRefresh(options: BackendRequestOptions): Promise<FetchResponse> {
  const auth = await getAuthController();
  const refreshedToken = await auth.refreshAccessToken();
  if (!refreshedToken) {
    throw new SessionExpiredError();
  }

  const retriedResponse = await performRequest(options, refreshedToken);
  if (retriedResponse.status === 401) {
    auth.handleSessionExpired();
    throw new SessionExpiredError();
  }

  return retriedResponse;
}

async function retryStreamRequestWithRefresh(options: BackendStreamRequestOptions): Promise<Response> {
  const auth = await getAuthController();
  const refreshedToken = await auth.refreshAccessToken();
  if (!refreshedToken) {
    throw new SessionExpiredError();
  }

  const retriedResponse = await performStreamRequest(options, refreshedToken);
  if (retriedResponse.status === 401) {
    auth.handleSessionExpired();
    throw new SessionExpiredError();
  }

  return retriedResponse;
}

export async function requestBackend(options: BackendRequestOptions): Promise<FetchResponse> {
  const response = await performRequest(options);
  if (!shouldRetryOn401(options, response.status)) {
    return response;
  }

  return retryRequestWithRefresh(options);
}

export async function requestBackendStream(options: BackendStreamRequestOptions): Promise<Response> {
  const response = await performStreamRequest(options);
  if (!shouldRetryOn401(options, response.status)) {
    return response;
  }

  return retryStreamRequestWithRefresh(options);
}
