import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LLMConfig, LLMProvider } from '../services/llm/types';

// API Key 存储（单独存储以支持加密）
export interface ApiKeyStorage {
  openai?: string;
  anthropic?: string;
  ollama?: string; // 本地模型可能不需要
}

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
  setCurrentProvider: (provider: LLMProvider) => void;
  setApiKey: (provider: LLMProvider, key: string | undefined) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (language: string) => void;
  setFontSize: (size: number) => void;
  setWorkingDirectory: (dir: string) => void;
  getCurrentLLMConfig: () => LLMConfig;
  resetConfig: () => void;
}

// 默认 LLM 配置
const defaultLLMConfigs: Record<LLMProvider, LLMConfig> = {
  openai: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    maxTokens: 4096,
    temperature: 0.7,
  },
  anthropic: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6-20250514',
    maxTokens: 4096,
    temperature: 0.7,
  },
  ollama: {
    provider: 'ollama',
    model: 'llama3.2',
    baseUrl: 'http://localhost:11434',
    maxTokens: 4096,
    temperature: 0.7,
  },
};

// 默认状态
const defaultState = {
  llmConfigs: defaultLLMConfigs,
  currentProvider: 'anthropic' as LLMProvider,
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
            [provider]: { ...state.llmConfigs[provider], ...config },
          },
        })),

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
