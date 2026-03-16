import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  exchangeOAuthTicket,
  fetchCurrentUser,
  logoutSession,
  parseOAuthFragment,
  refreshSession,
  requestOAuthAuthorizationUrl,
  type AuthUser,
  type OAuthProvider,
} from "@/services/backend/auth";
import { isSessionExpiredError, SESSION_EXPIRED_MESSAGE } from "@/services/backend/client";
import { useUIStore } from "./uiStore";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string | null;
  currentOAuthProvider: OAuthProvider | null;
  lastHandledOAuthTicket: string | null;
  isLoading: boolean;
  error: string | null;
  beginOAuth: (provider: OAuthProvider, redirectTo: string) => Promise<string>;
  completeOAuthCallback: (
    fragment: string,
    provider: OAuthProvider | null
  ) => Promise<{ success: boolean; error?: string }>;
  completeOAuthExchange: (
    ticket: string,
    provider: OAuthProvider | null
  ) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  handleSessionExpired: (message?: string) => void;
  restoreSession: () => Promise<void>;
  signOut: () => Promise<void>;
  clearSession: () => void;
  clearError: () => void;
}

const resettableState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  tokenType: null,
  currentOAuthProvider: null,
  isLoading: false,
  error: null,
};

const SESSION_EXPIRED_TOAST_COOLDOWN_MS = 3000;

let refreshAccessTokenPromise: Promise<string | null> | null = null;
let lastSessionExpiredToastAt = 0;

type AuthStoreSetter = (
  partial: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>)
) => void;

function clearPersistedSession(set: AuthStoreSetter, preserveTicket: string | null) {
  set({
    ...resettableState,
    lastHandledOAuthTicket: preserveTicket,
  });
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...resettableState,
      lastHandledOAuthTicket: null,

      handleSessionExpired: (message = SESSION_EXPIRED_MESSAGE) => {
        const preserveTicket = get().lastHandledOAuthTicket;
        clearPersistedSession(set, preserveTicket);

        const currentTime = Date.now();
        if (currentTime - lastSessionExpiredToastAt >= SESSION_EXPIRED_TOAST_COOLDOWN_MS) {
          useUIStore.getState().addToast({ type: "error", message });
          lastSessionExpiredToastAt = currentTime;
        }

        void import("./llmCatalogStore").then(({ useLLMCatalogStore }) => {
          useLLMCatalogStore.getState().clear();
        });
      },

      beginOAuth: async (provider, redirectTo) => {
        set({ isLoading: true, error: null });

        try {
          const authorizationUrl = await requestOAuthAuthorizationUrl(provider, redirectTo);
          set({ isLoading: false });
          return authorizationUrl;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : `启动 ${provider} OAuth 流程失败`;
          set({ isLoading: false, error: message });
          throw error;
        }
      },

      completeOAuthExchange: async (ticket, provider) => {
        set({ isLoading: true, error: null });

        try {
          const session = await exchangeOAuthTicket(ticket);
          set({
            user: session.user,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            tokenType: session.tokenType,
            currentOAuthProvider: provider,
            lastHandledOAuthTicket: ticket,
            isLoading: false,
            error: null,
          });
          return { success: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : "完成桌面 OAuth 登录失败";
          set((state) => ({
            user: state.user,
            accessToken: state.accessToken,
            refreshToken: state.refreshToken,
            tokenType: state.tokenType,
            currentOAuthProvider: state.currentOAuthProvider,
            lastHandledOAuthTicket: state.lastHandledOAuthTicket,
            isLoading: false,
            error: message,
          }));
          return { success: false, error: message };
        }
      },

      completeOAuthCallback: async (fragment, provider) => {
        const payload = parseOAuthFragment(fragment);
        if (payload.error) {
          set({ error: payload.error, isLoading: false });
          return { success: false, error: payload.error };
        }

        if (!payload.accessToken || !payload.refreshToken) {
          return { success: false };
        }

        set({ isLoading: true, error: null });

        try {
          const user = await fetchCurrentUser(payload.accessToken, { retryOn401: false });
          set({
            user,
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            tokenType: payload.tokenType,
            currentOAuthProvider: provider,
            isLoading: false,
            error: null,
          });
          return { success: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : "完成 OAuth 登录失败";
          set((state) => ({
            user: state.user,
            accessToken: state.accessToken,
            refreshToken: state.refreshToken,
            tokenType: state.tokenType,
            currentOAuthProvider: state.currentOAuthProvider,
            lastHandledOAuthTicket: state.lastHandledOAuthTicket,
            isLoading: false,
            error: message,
          }));
          return { success: false, error: message };
        }
      },

      refreshProfile: async () => {
        const accessToken = get().accessToken;
        if (!accessToken) {
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const user = await fetchCurrentUser(accessToken, { retryOn401: true });
          set({ user, isLoading: false });
        } catch (error) {
          if (isSessionExpiredError(error)) {
            set({ isLoading: false });
            throw error;
          }

          const message = error instanceof Error ? error.message : "刷新当前用户信息失败";
          set({ isLoading: false, error: message });
          throw error;
        }
      },

      refreshAccessToken: async () => {
        if (refreshAccessTokenPromise) {
          return refreshAccessTokenPromise;
        }

        const { refreshToken, currentOAuthProvider } = get();
        if (!refreshToken) {
          get().handleSessionExpired();
          return null;
        }

        refreshAccessTokenPromise = (async () => {
          try {
            const session = await refreshSession(refreshToken);
            set({
              user: session.user,
              accessToken: session.accessToken,
              refreshToken: session.refreshToken,
              tokenType: session.tokenType,
              currentOAuthProvider,
              error: null,
            });
            return session.accessToken;
          } catch {
            get().handleSessionExpired();
            return null;
          } finally {
            refreshAccessTokenPromise = null;
          }
        })();

        return refreshAccessTokenPromise;
      },

      restoreSession: async () => {
        const { accessToken, refreshToken } = get();
        if (!accessToken && !refreshToken) {
          return;
        }

        set({ isLoading: true, error: null });

        try {
          if (accessToken) {
            const user = await fetchCurrentUser(accessToken, { retryOn401: false });
            set({ user, isLoading: false, error: null });
            return;
          }
        } catch {
          // access token 失效时尝试 refresh token。
        }

        if (!refreshToken) {
          clearPersistedSession(set, get().lastHandledOAuthTicket);
          return;
        }

        const refreshedToken = await get().refreshAccessToken();
        if (refreshedToken) {
          set({ isLoading: false, error: null });
        }
      },

      signOut: async () => {
        const { accessToken, refreshToken } = get();
        set({ isLoading: true, error: null });

        try {
          await logoutSession(refreshToken, accessToken);
        } catch {
          // 退出登录时即使后端失败，也清理本地会话。
        }

        clearPersistedSession(set, get().lastHandledOAuthTicket);
      },

      clearSession: () => clearPersistedSession(set, get().lastHandledOAuthTicket),
      clearError: () => set({ error: null }),
    }),
    {
      name: "slate-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        tokenType: state.tokenType,
        currentOAuthProvider: state.currentOAuthProvider,
        lastHandledOAuthTicket: state.lastHandledOAuthTicket,
      }),
    }
  )
);
