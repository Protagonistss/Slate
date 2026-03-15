import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, LogIn, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { getBackendBaseUrl, type AuthUser } from "@/services/backend/auth";
import {
  createBackendLLMProvider,
  deleteBackendLLMProvider,
  updateBackendLLMProvider,
  type BackendLLMProvider,
} from "@/services/backend/llm";
import { useAuthStore, useConfigStore, useLLMCatalogStore, useUIStore } from "@/stores";
import type { LLMConfig, LLMProvider } from "@/services/llm/types";

interface ProviderDraft {
  displayName: string;
  model: string;
  modelText: string;
  baseUrl: string;
  apiKey: string;
}

const EMPTY_DRAFT: ProviderDraft = {
  displayName: "",
  model: "",
  modelText: "",
  baseUrl: "",
  apiKey: "",
};

function parseModels(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSelectedModel(provider: BackendLLMProvider, config?: LLMConfig | null): string {
  if (config?.model && provider.models.includes(config.model)) {
    return config.model;
  }

  return provider.default_model || provider.models[0] || "";
}

function getModelInputValue(provider: BackendLLMProvider): string {
  if (provider.models.length <= 1) {
    return provider.models[0] || "";
  }

  const defaultModel = provider.default_model;
  if (!defaultModel || !provider.models.includes(defaultModel)) {
    return provider.models.join(", ");
  }

  return [defaultModel, ...provider.models.filter((model) => model !== defaultModel)].join(", ");
}

function createDraft(provider: BackendLLMProvider, config?: LLMConfig | null): ProviderDraft {
  return {
    displayName: provider.display_name,
    model: getSelectedModel(provider, config),
    modelText: getModelInputValue(provider),
    baseUrl: provider.base_url || "",
    apiKey: "",
  };
}

function getProviderDetailText(provider: BackendLLMProvider, config?: LLMConfig | null): string {
  return provider.base_url?.trim() || config?.model || "Managed by backend";
}

function SignInGuide({ user }: { user: AuthUser | null }) {
  const navigate = useNavigate();

  if (user) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-black/20 p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-zinc-200">
            <LogIn size={16} />
            <span className="text-[14px] font-medium">Sign in to use backend models</span>
          </div>
          <p className="max-w-[520px] text-[13px] leading-relaxed text-zinc-500">
            AI Models and Agent execution now use the backend gateway. Sign in first to browse configured
            providers and send requests.
          </p>
        </div>

        <button
          onClick={() => navigate("/settings?tab=account")}
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-zinc-100 px-4 py-2 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-white"
        >
          <LogIn size={14} />
          Go to Account
        </button>
      </div>
    </div>
  );
}

export function AIModelsSettings() {
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
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [draft, setDraft] = useState<ProviderDraft>(EMPTY_DRAFT);
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [customProviderName, setCustomProviderName] = useState("");
  const [customModelName, setCustomModelName] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customProviderKey, setCustomProviderKey] = useState("");
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [isSavingCustomProvider, setIsSavingCustomProvider] = useState(false);

  useEffect(() => {
    if (accessToken) {
      void initialize();
    } else {
      clear();
      setEditingProvider(null);
      setDraft(EMPTY_DRAFT);
    }
  }, [accessToken, clear, initialize]);

  useEffect(() => {
    if (providers.length > 0) {
      syncLLMProviders(providers);
    }
  }, [providers, syncLLMProviders]);

  useEffect(() => {
    if (error) {
      addToast({ type: "error", message: error });
      clearError();
    }
  }, [addToast, clearError, error]);

  const configuredProviders = useMemo(
    () => providers.filter((provider) => provider.configured && provider.models.length > 0),
    [providers]
  );

  const openProviderConfig = (provider: BackendLLMProvider) => {
    setCurrentProvider(provider.name);
    setIsAddingProvider(false);
    setEditingProvider(provider.name);
    setDraft(createDraft(provider, llmConfigs[provider.name]));
  };

  const handleSelectModel = (provider: BackendLLMProvider, model: string) => {
    if (!provider.configured || provider.models.length === 0) {
      openProviderConfig(provider);
      return;
    }

    setCurrentProvider(provider.name);
    setLLMConfig(provider.name, {
      provider: provider.name,
      model,
    });
  };

  const handleSaveProvider = async (provider: BackendLLMProvider) => {
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
      setPendingProvider(provider.name);

      if (provider.source === "custom") {
        if (!accessToken) {
          throw new Error("请先登录 backend 账号");
        }

        const saved = await updateBackendLLMProvider(accessToken, provider.name, {
          display_name: draft.displayName.trim(),
          base_url: draft.baseUrl.trim(),
          api_key: draft.apiKey.trim() || undefined,
          models: nextModels,
          default_model: nextModel || null,
        });

        await refresh();
        syncLLMProviders(useLLMCatalogStore.getState().providers);
        setCurrentProvider(saved.name);
        setLLMConfig(saved.name, {
          provider: saved.name,
          model: nextModel,
        });
      } else {
        setCurrentProvider(provider.name);
        setLLMConfig(provider.name, {
          provider: provider.name,
          model: nextModel,
        });
      }

      setEditingProvider(null);
      addToast({
        type: "success",
        message: `已保存 ${provider.source === "custom" ? draft.displayName.trim() || provider.display_name : provider.display_name}`,
      });
    } catch (saveError) {
      addToast({
        type: "error",
        message: saveError instanceof Error ? saveError.message : "保存 Provider 失败",
      });
    } finally {
      setPendingProvider(null);
    }
  };

  const handleDeleteProvider = async (provider: BackendLLMProvider) => {
    if (!accessToken) {
      addToast({ type: "error", message: "请先登录 backend 账号" });
      return;
    }

    try {
      setPendingProvider(provider.name);
      await deleteBackendLLMProvider(accessToken, provider.name);
      await refresh();
      syncLLMProviders(useLLMCatalogStore.getState().providers);
      setEditingProvider(null);
      addToast({ type: "success", message: `已删除 ${provider.display_name}` });
    } catch (deleteError) {
      addToast({
        type: "error",
        message: deleteError instanceof Error ? deleteError.message : "删除 Provider 失败",
      });
    } finally {
      setPendingProvider(null);
    }
  };

  const resetCustomProviderForm = () => {
    setCustomProviderName("");
    setCustomModelName("");
    setCustomBaseUrl("");
    setCustomProviderKey("");
  };

  const handleSaveCustomProvider = async () => {
    const models = parseModels(customModelName);
    const defaultModel = models[0] || "";
    if (!accessToken) {
      addToast({ type: "error", message: "请先登录 backend 账号" });
      return;
    }
    if (!customProviderName.trim() || !customBaseUrl.trim() || !customProviderKey.trim() || models.length === 0) {
      addToast({ type: "error", message: "请完整填写 Provider Name、Model Name、Base URL 和 API Key" });
      return;
    }

    try {
      setIsSavingCustomProvider(true);
      const provider = await createBackendLLMProvider(accessToken, {
        display_name: customProviderName.trim(),
        base_url: customBaseUrl.trim(),
        api_key: customProviderKey.trim(),
        models,
        default_model: defaultModel,
      });

      await refresh();
      syncLLMProviders(useLLMCatalogStore.getState().providers);
      setCurrentProvider(provider.name);
      setLLMConfig(provider.name, {
        provider: provider.name,
        model: provider.default_model || provider.models[0] || "",
      });
      setIsAddingProvider(false);
      resetCustomProviderForm();
      addToast({ type: "success", message: `已添加 ${provider.display_name}` });
    } catch (saveError) {
      addToast({
        type: "error",
        message: saveError instanceof Error ? saveError.message : "添加 Provider 失败",
      });
    } finally {
      setIsSavingCustomProvider(false);
    }
  };

  return (
    <motion.div
      key="models-backend"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="max-w-[600px] space-y-8"
    >
      <div>
        <h2 className="mb-1 text-[20px] font-medium text-zinc-100">AI Providers</h2>
        <p className="text-[13px] text-zinc-500">
          Providers use OpenAI-compatible endpoints and can be added dynamically instead of relying on built-in
          presets.
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-600">
          <ExternalLink size={12} />
          <span className="truncate">{getBackendBaseUrl()}</span>
        </div>
      </div>

      <SignInGuide user={user} />

      {user && (
        <section className="space-y-1">
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">Providers</span>
            {isLoading && <span className="text-[11px] text-zinc-600">Loading...</span>}
          </div>

          {providers.length === 0 && !isLoading ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-white/[0.01] p-5 text-[13px] text-zinc-500">
              当前还没有可用 Provider。你可以直接通过下方 `Add Provider` 添加 OpenAI-compatible 接口。
            </div>
          ) : (
            providers.map((provider) => {
              const isActive = currentProvider === provider.name;
              const configured = provider.configured && provider.models.length > 0;
              const isEditing = editingProvider === provider.name;
              const providerConfig = llmConfigs[provider.name];
              const selectedModel = getSelectedModel(provider, providerConfig);
              const detailText = getProviderDetailText(provider, providerConfig);
              const statusLabel = configured ? "Connected" : "Not configured";
              const actionLabel = configured ? "Config" : "Connect";

              return (
                <div key={provider.name} className="space-y-2">
                  <div
                    className={cn(
                      "group relative -mx-3 rounded-lg p-3 transition-colors",
                      isActive ? "bg-white/[0.02]" : "hover:bg-white/[0.03]"
                    )}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "text-[13px] font-medium",
                              configured ? "text-zinc-300" : "text-zinc-400"
                            )}
                          >
                            {provider.display_name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                configured ? "bg-emerald-500/80" : "bg-zinc-700"
                              )}
                            />
                            <span
                              className={cn(
                                "text-[11px]",
                                configured ? "text-zinc-500" : "text-zinc-600"
                              )}
                            >
                              {statusLabel}
                            </span>
                            {isActive && (
                              <span className="rounded-full border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                                Active
                              </span>
                            )}
                          </div>
                        </div>

                        {!isEditing && (
                          <div className="absolute right-4 top-3 flex items-center gap-2 bg-[#050505] pl-2 opacity-0 shadow-[0_0_12px_8px_#050505] transition-opacity group-hover:opacity-100">
                            {configured && (
                              <span className="max-w-[160px] truncate font-mono text-[11px] text-zinc-600">
                                {detailText}
                              </span>
                            )}
                            {configured && !isActive && (
                              <button
                                onClick={() => setCurrentProvider(provider.name)}
                                className="px-2 py-1 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
                              >
                                Use
                              </button>
                            )}
                            <button
                              onClick={() => openProviderConfig(provider)}
                              className={cn(
                                "transition-colors",
                                configured
                                  ? "px-2 py-1 text-[12px] text-zinc-500 hover:text-zinc-300"
                                  : "rounded border border-white/5 bg-white/10 px-3 py-1 text-[12px] text-zinc-200 hover:bg-white/15"
                              )}
                            >
                              {actionLabel}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className={cn("flex flex-wrap items-center gap-1.5", !configured && "opacity-50")}>
                        {provider.models.map((model) => (
                          <button
                            key={`${provider.name}-${model}`}
                            type="button"
                            onClick={() => handleSelectModel(provider, model)}
                            className={cn(
                              "rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                              isActive && selectedModel === model
                                ? "border-white/15 bg-white/[0.08] text-zinc-200"
                                : "border-white/5 bg-white/[0.02] text-zinc-400 hover:border-white/10 hover:text-zinc-300"
                            )}
                          >
                            {model}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {isEditing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 mb-4 flex flex-col gap-4 rounded-lg border border-white/5 bg-white/[0.01] px-3 py-4">
                          <div>
                            <h4 className="text-[13px] font-medium text-zinc-300">{provider.display_name}</h4>
                            <p className="mt-0.5 text-[11px] text-zinc-500">
                              {provider.source === "custom"
                                ? "OpenAI-compatible API endpoint"
                                : "Built-in backend provider. Only local invocation defaults are editable here."}
                            </p>
                          </div>

                          <div className="space-y-4">
                            {provider.source === "custom" ? (
                              <>
                                <div className="flex items-center gap-4">
                                  <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">Provider Name</label>
                                  <input
                                    type="text"
                                    value={draft.displayName}
                                    onChange={(event) =>
                                      setDraft((current) => ({ ...current, displayName: event.target.value }))
                                    }
                                    placeholder="e.g. DeepSeek"
                                    className="flex-1 border-b border-white/10 bg-transparent pb-1.5 font-mono text-[12px] text-zinc-300 transition-colors placeholder:text-zinc-700 focus:border-zinc-500 focus:outline-none"
                                  />
                                </div>

                                <div className="flex items-center gap-4">
                                  <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">Model Name</label>
                                  <input
                                    type="text"
                                    value={draft.modelText}
                                    onChange={(event) =>
                                      setDraft((current) => ({ ...current, modelText: event.target.value }))
                                    }
                                    placeholder="e.g. deepseek-chat"
                                    className="flex-1 border-b border-white/10 bg-transparent pb-1.5 font-mono text-[12px] text-zinc-300 transition-colors placeholder:text-zinc-700 focus:border-zinc-500 focus:outline-none"
                                  />
                                </div>

                                <div className="flex items-center gap-4">
                                  <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">Base URL</label>
                                  <input
                                    type="text"
                                    value={draft.baseUrl}
                                    onChange={(event) =>
                                      setDraft((current) => ({ ...current, baseUrl: event.target.value }))
                                    }
                                    placeholder="https://api.openai.com/v1"
                                    className="flex-1 border-b border-white/10 bg-transparent pb-1.5 font-mono text-[12px] text-zinc-300 transition-colors placeholder:text-zinc-700 focus:border-zinc-500 focus:outline-none"
                                  />
                                </div>

                                <div className="flex items-center gap-4">
                                  <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">API Key</label>
                                  <input
                                    type="password"
                                    value={draft.apiKey}
                                    onChange={(event) =>
                                      setDraft((current) => ({ ...current, apiKey: event.target.value }))
                                    }
                                    placeholder="sk-..."
                                    className="flex-1 border-b border-white/10 bg-transparent pb-1.5 font-mono text-[12px] text-zinc-300 transition-colors placeholder:text-zinc-700 focus:border-zinc-500 focus:outline-none"
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-4">
                                  <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">Base URL</label>
                                  <div className="flex-1 border-b border-white/10 pb-1.5 font-mono text-[12px] text-zinc-500">
                                    {provider.base_url || getBackendBaseUrl()}
                                  </div>
                                </div>

                                <div className="flex items-center gap-4">
                                  <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">Default Model</label>
                                  <div className="relative flex-1">
                                    <select
                                      value={draft.model}
                                      onChange={(event) =>
                                        setDraft((current) => ({ ...current, model: event.target.value }))
                                      }
                                      disabled={provider.models.length === 0}
                                      className="w-full appearance-none border-b border-white/10 bg-transparent pb-1.5 pr-8 text-[12px] text-zinc-300 transition-colors focus:border-zinc-500 focus:outline-none disabled:text-zinc-600"
                                    >
                                      {provider.models.map((model) => (
                                        <option key={model} value={model}>
                                          {model}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-zinc-500">
                                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path
                                          d="M3 4.5L6 7.5L9 4.5"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-2">
                            <div>
                              {provider.deletable && (
                                <button
                                  onClick={() => void handleDeleteProvider(provider)}
                                  disabled={pendingProvider === provider.name}
                                  className="text-[12px] text-red-400/70 transition-colors hover:text-red-400 disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setEditingProvider(null)}
                                className="text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => void handleSaveProvider(provider)}
                                disabled={pendingProvider === provider.name}
                                className="text-[12px] font-medium text-zinc-300 transition-colors hover:text-white disabled:opacity-50"
                              >
                                {pendingProvider === provider.name ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}

          {configuredProviders.length === 0 && providers.length > 0 && (
            <div className="mt-3 rounded-xl border border-dashed border-zinc-800 bg-white/[0.01] p-5 text-[13px] text-zinc-500">
              当前目录里还没有可用模型。你可以新增一个 OpenAI-compatible Provider，或者在 backend 配置已有 Provider。
            </div>
          )}

          <AnimatePresence initial={false}>
            {isAddingProvider && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2 mb-4 flex flex-col gap-4 rounded-lg border border-white/5 bg-white/[0.01] px-3 py-4">
                  <div>
                    <h4 className="text-[13px] font-medium text-zinc-300">Custom Provider</h4>
                    <p className="mt-0.5 text-[11px] text-zinc-500">OpenAI-compatible API endpoint</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">Provider Name</label>
                      <input
                        type="text"
                        value={customProviderName}
                        onChange={(event) => setCustomProviderName(event.target.value)}
                        placeholder="e.g. DeepSeek"
                        className="flex-1 border-b border-white/10 bg-transparent pb-1.5 font-mono text-[12px] text-zinc-300 transition-colors placeholder:text-zinc-700 focus:border-zinc-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">Model Name</label>
                      <input
                        type="text"
                        value={customModelName}
                        onChange={(event) => setCustomModelName(event.target.value)}
                        placeholder="e.g. deepseek-chat"
                        className="flex-1 border-b border-white/10 bg-transparent pb-1.5 font-mono text-[12px] text-zinc-300 transition-colors placeholder:text-zinc-700 focus:border-zinc-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">Base URL</label>
                      <input
                        type="text"
                        value={customBaseUrl}
                        onChange={(event) => setCustomBaseUrl(event.target.value)}
                        placeholder="https://api.openai.com/v1"
                        className="flex-1 border-b border-white/10 bg-transparent pb-1.5 font-mono text-[12px] text-zinc-300 transition-colors placeholder:text-zinc-700 focus:border-zinc-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">API Key</label>
                      <input
                        type="password"
                        value={customProviderKey}
                        onChange={(event) => setCustomProviderKey(event.target.value)}
                        placeholder="sk-..."
                        className="flex-1 border-b border-white/10 bg-transparent pb-1.5 font-mono text-[12px] text-zinc-300 transition-colors placeholder:text-zinc-700 focus:border-zinc-500 focus:outline-none"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => {
                        setIsAddingProvider(false);
                        resetCustomProviderForm();
                      }}
                      className="text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleSaveCustomProvider()}
                      disabled={isSavingCustomProvider}
                      className="text-[12px] font-medium text-zinc-300 transition-colors hover:text-white disabled:opacity-50"
                    >
                      {isSavingCustomProvider ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!isAddingProvider && (
            <div className="px-3 pt-2">
              <button
                onClick={() => {
                  setEditingProvider(null);
                  resetCustomProviderForm();
                  setIsAddingProvider(true);
                }}
                className="flex items-center gap-1.5 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <Plus size={12} />
                Add Provider
              </button>
            </div>
          )}
        </section>
      )}
    </motion.div>
  );
}
