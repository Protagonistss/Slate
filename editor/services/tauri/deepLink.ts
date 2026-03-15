const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

export type DeepLinkListener = (urls: string[]) => void | Promise<void>;

function normalizeDeepLinks(urls: string[] | null | undefined): string[] {
  return Array.isArray(urls) ? urls : [];
}

export function isTauriEnvironment(): boolean {
  return isTauri;
}

export async function getCurrentDeepLinks(): Promise<string[]> {
  if (!isTauri) {
    return [];
  }

  const { getCurrent } = await import("@tauri-apps/plugin-deep-link");
  return normalizeDeepLinks(await getCurrent());
}

export async function onDeepLinkOpen(
  listener: DeepLinkListener
): Promise<() => void> {
  if (!isTauri) {
    return () => {};
  }

  const { onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
  const unlisten = await onOpenUrl((urls) => {
    void listener(normalizeDeepLinks(urls));
  });
  return () => {
    void unlisten();
  };
}
