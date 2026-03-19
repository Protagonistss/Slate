// useLLMCatalog - LLM 目录管理组合 Hook
import { useEffect, useMemo } from "react";
import { useAuthStore, useConfigStore, useLLMCatalogStore, useUIStore } from "@/stores";
import { isSessionExpiredError } from "@/services/backend/client";
import {
  createBackendLLMProvider,
  deleteBackendLLMProvider,
  updateBackendLLMProvider,
  type BackendLLMProvider,
} from "@/services/backend/llm";
import type { LLMConfig } from "@/services/llm/types";
import {
  parseModels,
  getSelectedModel,
  parseReasoningEffortDraft,
  type ProviderDraft,
} from "../components/AIModelsSettings/utils";

export interface UseLLMCatalogResult {
  // 状态
  user: ReturnType<typeof useAuthStore.getState>["user"];
  accessToken: ReturnType<typeof useAuthStore.getState>["accessToken"];
  currentProvider: ReturnType<typeof useConfigStore.getState>["currentProvider"];
  llmConfigs: ReturnType<typeof useConfigStore.getState>["llmConfigs"];
  providers: BackendLLMProvider[];
  isLoading: boolean;
  error: string | null;

  // 计算属性
  configuredProviders: BackendLLMProvider[];

  // 操作
  setCurrentProvider: (provider: string) => void;
  setLLMConfig: (provider: string, config: LLMConfig) => void;
  refresh: () => Promise<void>;

  // Provider 操作
  saveProvider: (
    provider: BackendLLMProvider,
    draft: ProviderDraft
  ) => Promise<void>;
  deleteProvider: (provider: BackendLLMProvider) => Promise<void>;
  createCustomProvider: (config: {
    displayName: string;
    baseUrl: string;
    apiKey: string;
    models: string[];
    defaultModel: string;
  }) => Promise<void>;

  // 工具函数
  getSelectedModel: (provider: BackendLLMProvider, config?: LLMConfig | null) => string;
  parseModels: (value: string) => string[];
}

export function useLLMCatalog(): UseLLMCatalogResult {
  const addToast = useUIStore((state) => state.addToast);
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentProvider = useConfigStore((state) => state.currentProvider);
  const llmConfigs = useConfigStore((state) => state.llmConfigs);
  const setCurrentProvider = useConfigStore((state) => state.setCurrentProvider);
  const setLLMConfig = useConfigStore((state) => state.setLLMConfig);
  const syncLLMProviders = useConfigStore((state) => state.syncLLMProviders);
  const providers = useLLMCatalogStore((state) => state.providers);
  const isLoading = useLLMCatalogStore((state) => state.isLoading);
  const error = useLLMCatalogStore((state) => state.error);
  const initialize = useLLMCatalogStore((state) => state.initialize);
  const refresh = useLLMCatalogStore((state) => state.refresh);
  const clear = useLLMCatalogStore((state) => state.clear);
  const clearError = useLLMCatalogStore((state) => state.clearError);

  // 初始化和清理
  useEffect(() => {
    if (accessToken) {
      void initialize();
    } else {
      clear();
    }
  }, [accessToken, clear, initialize]);

  // 同步 providers
  useEffect(() => {
    if (providers.length > 0) {
      syncLLMProviders(providers);
    }
  }, [providers, syncLLMProviders]);

  // 错误处理
  useEffect(() => {
    if (error) {
      addToast({ type: "error", message: error });
      clearError();
    }
  }, [addToast, clearError, error]);

  // 计算属性
  const configuredProviders = useMemo(
    () => providers.filter((provider) => provider.configured && provider.models.length > 0),
    [providers]
  );

  // 保存 Provider
  const saveProvider = async (
    provider: BackendLLMProvider,
    draft: ProviderDraft
  ): Promise<void> => {
    const nextModels = provider.source === "custom" ? parseModels(draft.modelText) : provider.models;
    const nextModel =
      provider.source === "custom"
        ? nextModels[0] || getSelectedModel(provider)
        : nextModels.includes(draft.model)
          ? draft.model
          : nextModels[0] || getSelectedModel(provider);

    if (provider.source === "custom" && nextModels.length === 0) {
      addToast({ type: "error", message: "至少需要一个模型名称" });
      return;
    }

    if (provider.source === "custom" && (!draft.displayName.trim() || !draft.baseUrl.trim())) {
      addToast({ type: "error", message: "请完整填写 Provider Name、Model Name 和 Base URL" });
      return;
    }

    try {
      if (provider.source === "custom") {
        if (!accessToken) {
          throw new Error("请先登录 backend 账号");
        }

        const saved = await updateBackendLLMProvider(provider.name, {
          display_name: draft.displayName.trim(),
          base_url: draft.baseUrl.trim(),
          api_key: draft.apiKey.trim() || undefined,
          models: nextModels,
          default_model: nextModel || null,
        });

        await refresh();
        syncLLMProviders(useLLMCatalogStore.getState().providers);
        setCurrentProvider(saved.name);
        const prevCustom = llmConfigs[saved.name] ?? llmConfigs[provider.name];
        setLLMConfig(saved.name, {
          ...prevCustom,
          provider: saved.name,
          model: nextModel,
          reasoningEffort: parseReasoningEffortDraft(draft.reasoningEffort),
        });
      } else {
        setCurrentProvider(provider.name);
        const prevBuiltin = llmConfigs[provider.name];
        setLLMConfig(provider.name, {
          ...prevBuiltin,
          provider: provider.name,
          model: nextModel,
          reasoningEffort: parseReasoningEffortDraft(draft.reasoningEffort),
        });
      }

      addToast({
        type: "success",
        message: `已保存 ${provider.source === "custom" ? draft.displayName.trim() || provider.display_name : provider.display_name}`,
      });
    } catch (saveError) {
      if (isSessionExpiredError(saveError)) {
        return;
      }

      addToast({
        type: "error",
        message: saveError instanceof Error ? saveError.message : "保存 Provider 失败",
      });
      throw saveError;
    }
  };

  // 删除 Provider
  const deleteProvider = async (provider: BackendLLMProvider): Promise<void> => {
    if (!accessToken) {
      addToast({ type: "error", message: "请先登录 backend 账号" });
      return;
    }

    try {
      await deleteBackendLLMProvider(provider.name);
      await refresh();
      syncLLMProviders(useLLMCatalogStore.getState().providers);
      addToast({ type: "success", message: `已删除 ${provider.display_name}` });
    } catch (deleteError) {
      if (isSessionExpiredError(deleteError)) {
        return;
      }

      addToast({
        type: "error",
        message: deleteError instanceof Error ? deleteError.message : "删除 Provider 失败",
      });
      throw deleteError;
    }
  };

  // 创建自定义 Provider
  const createCustomProvider = async (config: {
    displayName: string;
    baseUrl: string;
    apiKey: string;
    models: string[];
    defaultModel: string;
  }): Promise<void> => {
    if (!accessToken) {
      addToast({ type: "error", message: "请先登录 backend 账号" });
      return;
    }

    if (!config.displayName.trim() || !config.baseUrl.trim() || !config.apiKey.trim() || config.models.length === 0) {
      addToast({ type: "error", message: "请完整填写 Provider Name、Model Name、Base URL 和 API Key" });
      return;
    }

    try {
      const provider = await createBackendLLMProvider({
        display_name: config.displayName.trim(),
        base_url: config.baseUrl.trim(),
        api_key: config.apiKey.trim(),
        models: config.models,
        default_model: config.defaultModel,
      });

      await refresh();
      syncLLMProviders(useLLMCatalogStore.getState().providers);
      setCurrentProvider(provider.name);
      setLLMConfig(provider.name, {
        provider: provider.name,
        model: provider.default_model || provider.models[0] || "",
      });

      addToast({ type: "success", message: `已添加 ${provider.display_name}` });
    } catch (saveError) {
      if (isSessionExpiredError(saveError)) {
        return;
      }

      addToast({
        type: "error",
        message: saveError instanceof Error ? saveError.message : "添加 Provider 失败",
      });
      throw saveError;
    }
  };

  return {
    user,
    accessToken,
    currentProvider,
    llmConfigs,
    providers,
    isLoading,
    error,
    configuredProviders,
    setCurrentProvider,
    setLLMConfig,
    refresh,
    saveProvider,
    deleteProvider,
    createCustomProvider,
    getSelectedModel: (provider: BackendLLMProvider, config?: LLMConfig | null) =>
      getSelectedModel(provider, config),
    parseModels,
  };
}
