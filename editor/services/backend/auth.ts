import { get, post } from "@/services/tauri/http";

export type OAuthProvider = "github" | "gitee" | "google";

interface BackendUser {
  id: string;
  email: string | null;
  username: string;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
}

interface BackendOAuthStartResponse {
  provider: string;
  authorization_url: string;
  state: string;
}

interface BackendDetailResponse {
  detail?: string;
}

interface BackendTokenPairResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: BackendUser;
}

export interface AuthUser {
  id: string;
  email: string | null;
  username: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AuthSessionPayload {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
}

export interface OAuthFragmentPayload {
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string | null;
  error: string | null;
}

export interface OAuthDeepLinkPayload {
  provider: OAuthProvider | null;
  ticket: string | null;
  error: string | null;
}

const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

const backendBaseUrl = (() => {
  const envValue =
    typeof import.meta !== "undefined" && typeof import.meta.env.VITE_BACKEND_URL === "string"
      ? import.meta.env.VITE_BACKEND_URL.trim()
      : "";

  const defaultBaseUrl = isTauri ? "http://127.0.0.1:8000/api/v1" : "/api/v1";

  return (envValue || defaultBaseUrl).replace(/\/+$/, "");
})();

function buildUrl(path: string): string {
  return `${backendBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildAbsoluteUrl(path: string): string {
  const url = buildUrl(path);
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost";

  return new URL(url, origin).toString();
}

function getErrorMessage(status: number, data: unknown, fallback: string): string {
  if (data && typeof data === "object" && typeof (data as BackendDetailResponse).detail === "string") {
    return (data as BackendDetailResponse).detail as string;
  }

  return `${fallback}（HTTP ${status}）`;
}

function mapUser(user: BackendUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatar_url ?? null,
    isActive: user.is_active,
    createdAt: user.created_at,
  };
}

function mapTokenPair(payload: BackendTokenPairResponse): AuthSessionPayload {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type,
    expiresIn: payload.expires_in,
    user: mapUser(payload.user),
  };
}

export function getBackendBaseUrl(): string {
  return backendBaseUrl;
}

export function parseOAuthFragment(fragment: string): OAuthFragmentPayload {
  const normalized = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  const params = new URLSearchParams(normalized);

  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    tokenType: params.get("token_type"),
    error: params.get("error"),
  };
}

export function parseOAuthDeepLinkUrl(rawUrl: string): OAuthDeepLinkPayload | null {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "slate:" || url.hostname !== "auth" || url.pathname !== "/callback") {
    return null;
  }

  const providerParam = url.searchParams.get("provider");
  const provider =
    providerParam === "github" || providerParam === "gitee" || providerParam === "google"
      ? providerParam
      : null;

  return {
    provider,
    ticket: url.searchParams.get("ticket"),
    error: url.searchParams.get("error"),
  };
}

export async function requestOAuthAuthorizationUrl(
  provider: OAuthProvider,
  redirectTo: string
): Promise<string> {
  const url = new URL(buildAbsoluteUrl(`/auth/oauth/${provider}/start`));
  url.searchParams.set("redirect_to", redirectTo);

  let response;

  try {
    response = await get(url.toString());
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : `连接后端失败，请确认 ${backendBaseUrl} 已启动`;
    throw new Error(message);
  }

  if (!response.ok || !response.data || typeof response.data !== "object") {
    throw new Error(
      getErrorMessage(response.status, response.data, `获取 ${provider} OAuth 授权地址失败`)
    );
  }

  const payload = response.data as BackendOAuthStartResponse;
  if (!payload.authorization_url) {
    throw new Error(`${provider} OAuth 返回的授权地址为空`);
  }

  return payload.authorization_url;
}

export async function exchangeOAuthTicket(ticket: string): Promise<AuthSessionPayload> {
  const response = await post(buildUrl("/auth/oauth/exchange"), { ticket });

  if (!response.ok || !response.data || typeof response.data !== "object") {
    throw new Error(getErrorMessage(response.status, response.data, "兑换 OAuth 登录票据失败"));
  }

  return mapTokenPair(response.data as BackendTokenPairResponse);
}

export async function fetchCurrentUser(accessToken: string): Promise<AuthUser> {
  const response = await get(buildUrl("/me"), {
    Authorization: `Bearer ${accessToken}`,
  });

  if (!response.ok || !response.data || typeof response.data !== "object") {
    throw new Error(getErrorMessage(response.status, response.data, "获取当前用户信息失败"));
  }

  return mapUser(response.data as BackendUser);
}

export async function refreshSession(refreshToken: string): Promise<AuthSessionPayload> {
  const response = await post(buildUrl("/auth/refresh"), {
    refresh_token: refreshToken,
  });

  if (!response.ok || !response.data || typeof response.data !== "object") {
    throw new Error(getErrorMessage(response.status, response.data, "刷新登录会话失败"));
  }

  return mapTokenPair(response.data as BackendTokenPairResponse);
}

export async function logoutSession(
  refreshToken: string | null,
  accessToken?: string | null
): Promise<void> {
  const headers = accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
      }
    : undefined;

  const response = await post(
    buildUrl("/auth/logout"),
    {
      refresh_token: refreshToken,
    },
    headers
  );

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, response.data, "退出登录失败"));
  }
}
