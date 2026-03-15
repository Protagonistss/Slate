import { create } from "zustand";
import { listBackendLLMModels, listBackendLLMProviders, type BackendLLMModel, type BackendLLMProvider } from "@/services/backend/llm";
import { useAuthStore } from "./authStore";

interface LLMCatalogState {
  providers: BackendLLMProvider[];
  models: BackendLLMModel[];
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  clear: () => void;
  clearError: () => void;
}

let initializePromise: Promise<void> | null = null;
let requestVersion = 0;

async function loadCatalog(): Promise<{ providers: BackendLLMProvider[]; models: BackendLLMModel[] }> {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) {
    return { providers: [], models: [] };
  }

  const [providers, models] = await Promise.all([
    listBackendLLMProviders(accessToken),
    listBackendLLMModels(accessToken),
  ]);

  return { providers, models };
}

export const useLLMCatalogStore = create<LLMCatalogState>((set, get) => ({
  providers: [],
  models: [],
  initialized: false,
  isLoading: false,
  error: null,

  initialize: async () => {
    if (get().initialized || get().isLoading) {
      return;
    }

    if (!initializePromise) {
      const currentRequestVersion = ++requestVersion;
      initializePromise = (async () => {
        set({ isLoading: true, error: null });

        try {
          const { providers, models } = await loadCatalog();
          if (currentRequestVersion !== requestVersion) {
            return;
          }

          set({
            providers,
            models,
            initialized: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          if (currentRequestVersion !== requestVersion) {
            return;
          }

          set({
            providers: [],
            models: [],
            initialized: false,
            isLoading: false,
            error: error instanceof Error ? error.message : "加载模型目录失败",
          });
        } finally {
          initializePromise = null;
        }
      })();
    }

    await initializePromise;
  },

  refresh: async () => {
    const currentRequestVersion = ++requestVersion;
    set({ isLoading: true, error: null });

    try {
      const { providers, models } = await loadCatalog();
      if (currentRequestVersion !== requestVersion) {
        return;
      }

      set({
        providers,
        models,
        initialized: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (currentRequestVersion !== requestVersion) {
        return;
      }

      set({
        providers: [],
        models: [],
        initialized: false,
        isLoading: false,
        error: error instanceof Error ? error.message : "刷新模型目录失败",
      });
    }
  },

  clear: () =>
    set(() => {
      initializePromise = null;
      requestVersion += 1;

      return {
        providers: [],
        models: [],
        initialized: false,
        isLoading: false,
        error: null,
      };
    }),

  clearError: () => set({ error: null }),
}));
