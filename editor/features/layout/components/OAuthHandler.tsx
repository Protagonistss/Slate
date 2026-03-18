// OAuthHandler - Handles OAuth deep link processing
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { parseOAuthDeepLinkUrl } from "@/services/backend/auth";
import { getCurrentDeepLinks, onDeepLinkOpen } from "@/services/tauri/deepLink";
import { useAuthStore, useUIStore } from "@/stores";

function getOAuthProviderLabel(provider: string | null | undefined): string {
  switch (provider) {
    case "github":
      return "GitHub";
    case "gitee":
      return "Gitee";
    case "google":
      return "Google";
    default:
      return "账号";
  }
}

export function useOAuthHandler() {
  const navigate = useNavigate();
  const processedDeepLinksRef = useRef<Set<string>>(new Set());

  const completeOAuthExchange = useAuthStore((state) => state.completeOAuthExchange);
  const lastHandledOAuthTicket = useAuthStore((state) => state.lastHandledOAuthTicket);
  const hasAuthSession = useAuthStore((state) => Boolean(state.accessToken || state.refreshToken));
  const addToast = useUIStore((state) => state.addToast);

  useEffect(() => {
    let cancelled = false;

    const processUrls = async (urls: string[] | null | undefined) => {
      for (const url of Array.isArray(urls) ? urls : []) {
        if (cancelled || processedDeepLinksRef.current.has(url)) {
          continue;
        }

        const payload = parseOAuthDeepLinkUrl(url);
        if (!payload) {
          continue;
        }

        processedDeepLinksRef.current.add(url);

        if (payload.error) {
          addToast({ type: "error", message: payload.error });
          navigate("/settings#account", { replace: true });
          continue;
        }

        if (!payload.ticket) {
          continue;
        }

        if (payload.ticket === lastHandledOAuthTicket) {
          continue;
        }

        const result = await completeOAuthExchange(payload.ticket, payload.provider);
        if (cancelled) {
          return;
        }

        if (result.success) {
          addToast({
            type: "success",
            message: `${getOAuthProviderLabel(payload.provider)} 登录成功。`,
          });
        } else if (
          result.error &&
          !(hasAuthSession && result.error.includes("OAuth 交换票据无效或已过期"))
        ) {
          addToast({ type: "error", message: result.error });
        }

        navigate("/settings#account", { replace: true });
      }
    };

    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        await processUrls(await getCurrentDeepLinks());
        unsubscribe = await onDeepLinkOpen(processUrls);
      } catch (error) {
        if (cancelled) {
          return;
        }

        addToast({
          type: "error",
          message:
            error instanceof Error ? error.message : "处理桌面登录回调时发生未知错误",
        });
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [addToast, completeOAuthExchange, hasAuthSession, lastHandledOAuthTicket, navigate]);
}

// Component for OAuth handling
export function OAuthHandler() {
  useOAuthHandler();
  return null;
}
