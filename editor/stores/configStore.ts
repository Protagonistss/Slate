import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BackendLLMProvider } from '@/services/backend/llm';
import type { LLMConfig, LLMProvider } from '../services/llm/types';

export type ApiKeyStorage = Record<string, string | undefined>;

// 配置状态
export interface ConfigState {
  // LLM 配置
  llmConfigs: Record<LLMProvider, LLMConfig>;
  currentProvider: LLMProvider;

  // API Keys
  apiKeys: ApiKeyStorage;

  // UI 配置
  theme: 'light' | 'dark' | 'system';
  language: string;
  fontSize: number;

  // 工作目录
  workingDirectory: string;

  // Actions
  setLLMConfig: (provider: LLMProvider, config: Partial<LLMConfig>) => void;
  syncLLMProviders: (providers: BackendLLMProvider[]) => void;
  setCurrentProvider: (provider: LLMProvider) => void;
  setApiKey: (provider: LLMProvider, key: string | undefined) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (language: string) => void;
  setFontSize: (size: number) => void;
  setWorkingDirectory: (dir: string) => void;
  getCurrentLLMConfig: () => LLMConfig;
  resetConfig: () => void;
}

// 默认状态
const defaultState = {
  llmConfigs: {} as Record<LLMProvider, LLMConfig>,
  currentProvider: '' as LLMProvider,
  apiKeys: {},
  theme: 'dark' as const,
  language: 'zh-CN',
  fontSize: 14,
  workingDirectory: '',
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      ...defaultState,

      setLLMConfig: (provider, config) =>
        set((state) => ({
          llmConfigs: {
            ...state.llmConfigs,
            [provider]: {
              provider,
              model: '',
              maxTokens: 4096,
              temperature: 0.7,
              ...state.llmConfigs[provider],
              ...config,
            },
          },
        })),

      syncLLMProviders: (providers) =>
        set((state) => {
          const configuredProviders = providers.filter(
            (provider) => provider.configured && provider.models.length > 0
          );

          const nextConfigs = { ...state.llmConfigs };

          configuredProviders.forEach((provider) => {
            const existingConfig = nextConfigs[provider.name];
            const fallbackModel = provider.default_model || provider.models[0] || '';
            const nextModel =
              existingConfig?.model && provider.models.includes(existingConfig.model)
                ? existingConfig.model
                : fallbackModel;

            nextConfigs[provider.name] = {
              provider: provider.name,
              model: nextModel,
              maxTokens: existingConfig?.maxTokens ?? 4096,
              temperature: existingConfig?.temperature ?? 0.7,
              systemPrompt: existingConfig?.systemPrompt,
              reasoningEffort: existingConfig?.reasoningEffort,
            };
          });

          const nextCurrentProvider =
            state.currentProvider &&
            configuredProviders.some((provider) => provider.name === state.currentProvider)
              ? state.currentProvider
              : configuredProviders[0]?.name || '';

          return {
            llmConfigs: nextConfigs,
            currentProvider: nextCurrentProvider,
          };
        }),

      setCurrentProvider: (provider) => set({ currentProvider: provider }),

      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: {
            ...state.apiKeys,
            [provider]: key,
          },
        })),

      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setFontSize: (fontSize) => set({ fontSize }),
      setWorkingDirectory: (workingDirectory) => set({ workingDirectory }),

      getCurrentLLMConfig: () => {
        const state = get();
        const provider = state.currentProvider;
        const config = state.llmConfigs[provider];
        const apiKey = state.apiKeys[provider];

        return {
          provider,
          model: '',
          maxTokens: 4096,
          temperature: 0.7,
          ...config,
          apiKey,
        };
      },

      resetConfig: () => set(defaultState),
    }),
    {
      name: 'protagonist-config',
      // 不持久化 API Keys（安全考虑）
      partialize: (state) => ({
        llmConfigs: state.llmConfigs,
        currentProvider: state.currentProvider,
        theme: state.theme,
        language: state.language,
        fontSize: state.fontSize,
        workingDirectory: state.workingDirectory,
      }),
    }
  )
);
