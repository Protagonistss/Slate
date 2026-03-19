// ProviderList - Provider 列表组件
import { Plus } from "lucide-react";
import { useState } from "react";
import type { BackendLLMProvider } from "@/services/backend/llm";
import type { LLMConfig } from "@/services/llm/types";
import { ProviderCard } from "./ProviderCard";
import { CustomProviderDialog } from "./CustomProviderDialog";
import { ProviderEditor } from "./ProviderEditor";
import { createDraft, EMPTY_DRAFT, parseModels, type ProviderDraft } from "./utils";

export interface ProviderListProps {
  providers: BackendLLMProvider[];
  currentProvider: string | null;
  llmConfigs: Record<string, LLMConfig | null>;
  isLoading: boolean;
  setCurrentProvider: (provider: string) => void;
  setLLMConfig: (provider: string, config: LLMConfig) => void;
  saveProvider: (provider: BackendLLMProvider, draft: ProviderDraft) => Promise<void>;
  deleteProvider: (provider: BackendLLMProvider) => Promise<void>;
  createCustomProvider: (config: {
    displayName: string;
    baseUrl: string;
    apiKey: string;
    models: string[];
    defaultModel: string;
  }) => Promise<void>;
}

export function ProviderList({
  providers,
  currentProvider,
  llmConfigs,
  isLoading,
  setCurrentProvider,
  setLLMConfig,
  saveProvider,
  deleteProvider,
  createCustomProvider,
}: ProviderListProps) {
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProviderDraft>(EMPTY_DRAFT);
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  // Custom provider form state
  const [customProviderName, setCustomProviderName] = useState("");
  const [customModelName, setCustomModelName] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customProviderKey, setCustomProviderKey] = useState("");
  const [isSavingCustomProvider, setIsSavingCustomProvider] = useState(false);

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
    const prev = llmConfigs[provider.name];
    setLLMConfig(provider.name, {
      ...prev,
      provider: provider.name,
      model,
    });
  };

  const handleUseProvider = (provider: BackendLLMProvider) => {
    setCurrentProvider(provider.name);
  };

  const handleSaveProvider = async (provider: BackendLLMProvider) => {
    try {
      setPendingProvider(provider.name);
      await saveProvider(provider, draft);
      setEditingProvider(null);
    } finally {
      setPendingProvider(null);
    }
  };

  const handleDeleteProvider = async (provider: BackendLLMProvider) => {
    try {
      setPendingProvider(provider.name);
      await deleteProvider(provider);
      setEditingProvider(null);
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
    try {
      setIsSavingCustomProvider(true);
      const models = parseModels(customModelName);
      const defaultModel = models[0] || "";

      await createCustomProvider({
        displayName: customProviderName,
        baseUrl: customBaseUrl,
        apiKey: customProviderKey,
        models,
        defaultModel,
      });

      setIsAddingProvider(false);
      resetCustomProviderForm();
    } finally {
      setIsSavingCustomProvider(false);
    }
  };

  const renderEditor = (provider: BackendLLMProvider) => (
    <ProviderEditor
      provider={provider}
      draft={draft}
      onChange={setDraft}
      onCancel={() => setEditingProvider(null)}
      onSave={() => handleSaveProvider(provider)}
      onDelete={provider.deletable ? () => handleDeleteProvider(provider) : undefined}
      pendingProvider={pendingProvider}
    />
  );

  return (
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
        providers.map((provider) => (
          <ProviderCard
            key={provider.name}
            provider={provider}
            currentProvider={currentProvider}
            llmConfigs={llmConfigs}
            isEditing={editingProvider === provider.name}
            pendingProvider={pendingProvider}
            onUse={handleUseProvider}
            onConfig={openProviderConfig}
            onSelectModel={handleSelectModel}
            renderEditor={renderEditor}
          />
        ))
      )}

      <CustomProviderDialog
        isOpen={isAddingProvider}
        displayName={customProviderName}
        modelNames={customModelName}
        baseUrl={customBaseUrl}
        apiKey={customProviderKey}
        isSaving={isSavingCustomProvider}
        onChangeDisplayName={setCustomProviderName}
        onChangeModelNames={setCustomModelName}
        onChangeBaseUrl={setCustomBaseUrl}
        onChangeApiKey={setCustomProviderKey}
        onCancel={() => {
          setIsAddingProvider(false);
          resetCustomProviderForm();
        }}
        onSave={handleSaveCustomProvider}
      />

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
  );
}
