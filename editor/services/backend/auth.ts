import { requestBackend } from "./client";
import {
  buildBackendAbsoluteUrl,
  buildBackendUrl,
  getBackendBaseUrl,
  getBackendErrorMessage,
} from "./base";

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
  const url = new URL(buildBackendAbsoluteUrl(`/auth/oauth/${provider}/start`));
  url.searchParams.set("redirect_to", redirectTo);

  const response = await requestBackend({
    url: url.toString(),
    auth: "none",
    retryOn401: false,
    networkErrorMessage: `获取 ${provider} OAuth 授权地址失败`,
  });

  if (!response.ok || !response.data || typeof response.data !== "object") {
    throw new Error(
      getBackendErrorMessage(response.status, response.data, `获取 ${provider} OAuth 授权地址失败`)
    );
  }

  const payload = response.data as BackendOAuthStartResponse;
  if (!payload.authorization_url) {
    throw new Error(`${provider} OAuth 返回的授权地址为空`);
  }

  return payload.authorization_url;
}

export async function exchangeOAuthTicket(ticket: string): Promise<AuthSessionPayload> {
  const response = await requestBackend({
    url: buildBackendUrl("/auth/oauth/exchange"),
    method: "POST",
    body: { ticket },
    auth: "none",
    retryOn401: false,
    networkErrorMessage: "兑换 OAuth 登录票据失败",
  });

  if (!response.ok || !response.data || typeof response.data !== "object") {
    throw new Error(getBackendErrorMessage(response.status, response.data, "兑换 OAuth 登录票据失败"));
  }

  return mapTokenPair(response.data as BackendTokenPairResponse);
}

export async function fetchCurrentUser(
  accessToken: string,
  options?: { retryOn401?: boolean }
): Promise<AuthUser> {
  const response = await requestBackend({
    url: buildBackendUrl("/me"),
    auth: "required",
    accessTokenOverride: accessToken,
    retryOn401: options?.retryOn401 ?? false,
    networkErrorMessage: "获取当前用户信息失败",
  });

  if (!response.ok || !response.data || typeof response.data !== "object") {
    throw new Error(getBackendErrorMessage(response.status, response.data, "获取当前用户信息失败"));
  }

  return mapUser(response.data as BackendUser);
}

export async function refreshSession(refreshToken: string): Promise<AuthSessionPayload> {
  const response = await requestBackend({
    url: buildBackendUrl("/auth/refresh"),
    method: "POST",
    body: {
      refresh_token: refreshToken,
    },
    auth: "none",
    retryOn401: false,
    networkErrorMessage: "刷新登录会话失败",
  });

  if (!response.ok || !response.data || typeof response.data !== "object") {
    throw new Error(getBackendErrorMessage(response.status, response.data, "刷新登录会话失败"));
  }

  return mapTokenPair(response.data as BackendTokenPairResponse);
}

export async function logoutSession(
  refreshToken: string | null,
  accessToken?: string | null
): Promise<void> {
  const response = await requestBackend({
    url: buildBackendUrl("/auth/logout"),
    method: "POST",
    body: {
      refresh_token: refreshToken,
    },
    headers:
      accessToken && accessToken.trim()
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
    auth: "none",
    retryOn401: false,
    networkErrorMessage: "退出登录失败",
  });

  if (!response.ok) {
    throw new Error(getBackendErrorMessage(response.status, response.data, "退出登录失败"));
  }
}

export { getBackendBaseUrl };
