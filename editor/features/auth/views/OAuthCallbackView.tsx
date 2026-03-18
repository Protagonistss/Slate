import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import type { OAuthProvider } from "@/services/backend/auth";
import { useAuthStore, useUIStore } from "@/stores";

const CALLBACK_PROCESSED_KEY_PREFIX = "slate:oauth-callback:processed:";

function parseOAuthProvider(value: string | null): OAuthProvider | null {
  switch (value) {
    case "github":
    case "gitee":
    case "google":
      return value;
    default:
      return null;
  }
}

function getOAuthProviderLabel(provider: OAuthProvider | null): string {
  switch (provider) {
    case "github":
      return "GitHub";
    case "gitee":
      return "Gitee";
    case "google":
      return "Google";
    default:
      return "OAuth";
  }
}

export function OAuthCallbackView() {
  const location = useLocation();
  const navigate = useNavigate();
  const completeOAuthCallback = useAuthStore((state) => state.completeOAuthCallback);
  const addToast = useUIStore((state) => state.addToast);

  useEffect(() => {
    const fingerprint = `${location.pathname}${location.search}${location.hash}`;
    const processedKey = `${CALLBACK_PROCESSED_KEY_PREFIX}${fingerprint}`;

    if (window.sessionStorage.getItem(processedKey) === "1") {
      navigate("/settings#account", { replace: true });
      return;
    }

    window.sessionStorage.setItem(processedKey, "1");

    let cancelled = false;
    const provider = parseOAuthProvider(new URLSearchParams(location.search).get("provider"));

    void (async () => {
      const result = await completeOAuthCallback(location.hash, provider);
      if (cancelled) {
        return;
      }

      if (result.success) {
        addToast({
          type: "success",
          message: `${getOAuthProviderLabel(provider)} 登录成功。`,
        });
      } else {
        addToast({
          type: "error",
          message: result.error ?? "OAuth 回调参数不完整",
        });
      }

      navigate("/settings#account", { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [addToast, completeOAuthCallback, location.hash, location.pathname, location.search, navigate]);

  return (
    <div className="h-screen w-full bg-obsidian flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
        <span className="text-sm text-zinc-500">Signing you in...</span>
      </div>
    </div>
  );
}
