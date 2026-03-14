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

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string | null;
  currentOAuthProvider: OAuthProvider | null;
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...resettableState,

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
            isLoading: false,
            error: null,
          });
          return { success: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : "完成桌面 OAuth 登录失败";
          set({
            ...resettableState,
            error: message,
          });
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
          const user = await fetchCurrentUser(payload.accessToken);
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
          set({
            ...resettableState,
            error: message,
          });
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
          const user = await fetchCurrentUser(accessToken);
          set({ user, isLoading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : "刷新当前用户信息失败";
          set({ isLoading: false, error: message });
          throw error;
        }
      },

      restoreSession: async () => {
        const { accessToken, refreshToken, currentOAuthProvider } = get();
        if (!accessToken && !refreshToken) {
          return;
        }

        set({ isLoading: true, error: null });

        try {
          if (accessToken) {
            const user = await fetchCurrentUser(accessToken);
            set({ user, isLoading: false, error: null });
            return;
          }
        } catch {
          // access token 失效时尝试 refresh token。
        }

        if (!refreshToken) {
          set({ ...resettableState });
          return;
        }

        try {
          const session = await refreshSession(refreshToken);
          set({
            user: session.user,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            tokenType: session.tokenType,
            currentOAuthProvider,
            isLoading: false,
            error: null,
          });
        } catch {
          set({ ...resettableState });
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

        set({ ...resettableState });
      },

      clearSession: () => set({ ...resettableState }),
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
      }),
    }
  )
);
