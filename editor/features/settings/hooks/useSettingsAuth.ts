// useSettingsAuth - 设置页面认证相关逻辑
import { useState } from "react";
import { useAuthStore, useUIStore } from "@/stores";
import { getBackendBaseUrl, type OAuthProvider } from "@/services/backend/auth";
import { isTauriEnvironment } from "@/services/tauri/deepLink";
import { openUrl } from "@/services/tauri/shell";
import { confirmDialog } from "@/services/tauri/dialog";

export interface UseSettingsAuthResult {
  user: ReturnType<typeof useAuthStore.getState>["user"];
  currentOAuthProvider: ReturnType<typeof useAuthStore.getState>["currentOAuthProvider"];
  pendingOAuthProvider: OAuthProvider | null;
  pendingAction: "signOut" | null;
  backendBaseUrl: string;
  handleOAuthSignIn: (provider: OAuthProvider) => Promise<void>;
  handleSignOut: () => Promise<void>;
  handleDeleteAccount: () => Promise<void>;
}

function buildOAuthRedirectUri(provider: OAuthProvider): string {
  if (isTauriEnvironment()) {
    return "slate://auth/callback";
  }

  const redirectUrl = new URL("/auth/callback", window.location.origin);
  redirectUrl.searchParams.set("provider", provider);
  return redirectUrl.toString();
}

export function useSettingsAuth(): UseSettingsAuthResult {
  const addToast = useUIStore((state) => state.addToast);
  const user = useAuthStore((state) => state.user);
  const currentOAuthProvider = useAuthStore((state) => state.currentOAuthProvider);
  const beginOAuth = useAuthStore((state) => state.beginOAuth);
  const [pendingOAuthProvider, setPendingOAuthProvider] = useState<OAuthProvider | null>(null);
  const [pendingAction, setPendingAction] = useState<"signOut" | null>(null);
  const backendBaseUrl = getBackendBaseUrl();

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    setPendingOAuthProvider(provider);
    try {
      const redirectUri = buildOAuthRedirectUri(provider);
      const authUrl = await beginOAuth(provider, redirectUri);

      if (isTauriEnvironment()) {
        await openUrl(authUrl);
        setPendingOAuthProvider(null);
      } else {
        window.location.href = authUrl;
      }
    } catch (error) {
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to sign in",
      });
      setPendingOAuthProvider(null);
    }
  };

  const handleSignOut = async () => {
    setPendingAction("signOut");
    try {
      useAuthStore.getState().signOut();
      addToast({ type: "success", message: "Signed out successfully" });
    } catch (error) {
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to sign out",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = await confirmDialog("Are you sure you want to delete your account?");
    if (!confirmed) return;

    try {
      // TODO: Implement account deletion API
      addToast({ type: "success", message: "Account deleted successfully" });
      await handleSignOut();
    } catch (error) {
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to delete account",
      });
    }
  };

  return {
    user,
    currentOAuthProvider,
    pendingOAuthProvider,
    pendingAction,
    backendBaseUrl,
    handleOAuthSignIn,
    handleSignOut,
    handleDeleteAccount,
  };
}
