import { useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, useConfigStore, useLLMCatalogStore } from "@/stores";
import type { LLMProvider } from "@/services/llm/types";

interface AgentModelSelectProps {
  className?: string;
  disabled?: boolean;
}

interface ModelOption {
  provider: LLMProvider;
  model: string;
  label: string;
}

export function AgentModelSelect({ className, disabled = false }: AgentModelSelectProps) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentProvider = useConfigStore((state) => state.currentProvider);
  const llmConfigs = useConfigStore((state) => state.llmConfigs);
  const setCurrentProvider = useConfigStore((state) => state.setCurrentProvider);
  const setLLMConfig = useConfigStore((state) => state.setLLMConfig);
  const syncLLMProviders = useConfigStore((state) => state.syncLLMProviders);
  const providers = useLLMCatalogStore((state) => state.providers);
  const isLoading = useLLMCatalogStore((state) => state.isLoading);
  const initialize = useLLMCatalogStore((state) => state.initialize);
  const clear = useLLMCatalogStore((state) => state.clear);

  useEffect(() => {
    if (accessToken) {
      void initialize();
    } else {
      clear();
    }
  }, [accessToken, clear, initialize]);

  useEffect(() => {
    if (providers.length > 0) {
      syncLLMProviders(providers);
    }
  }, [providers, syncLLMProviders]);

  const configuredProviders = useMemo(
    () => providers.filter((provider) => provider.configured && provider.models.length > 0),
    [providers]
  );

  const options = useMemo<ModelOption[]>(
    () =>
      configuredProviders.flatMap((provider) =>
        provider.models.map((model) => ({
          provider: provider.name,
          model,
          label: `${provider.display_name} · ${model}`,
        }))
      ),
    [configuredProviders]
  );

  const activeProvider =
    configuredProviders.find((provider) => provider.name === currentProvider) || configuredProviders[0] || null;
  const providerConfig = activeProvider ? llmConfigs[activeProvider.name] : null;
  const selectedModel =
    activeProvider && providerConfig?.model && activeProvider.models.includes(providerConfig.model)
      ? providerConfig.model
      : activeProvider?.default_model || activeProvider?.models[0] || "";
  const selectedValue = activeProvider && selectedModel ? `${activeProvider.name}:${selectedModel}` : "";

  const selectedLabel = !accessToken
    ? "Sign in"
    : isLoading
    ? "Loading..."
    : activeProvider && selectedModel
    ? selectedModel
    : "No models";

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const [providerValue, ...modelParts] = event.target.value.split(":");
    const model = modelParts.join(":");
    if (!providerValue || !model) {
      return;
    }

    const provider = providerValue as LLMProvider;
    setCurrentProvider(provider);
    const prev = llmConfigs[provider];
    setLLMConfig(provider, {
      ...prev,
      provider,
      model,
    });
  };

  return (
    <div className={cn("group/model relative hidden min-w-[5.5rem] max-w-[11rem] sm:block", className)}>
      <span className="invisible block truncate whitespace-nowrap rounded-md px-2 py-1.5 pr-5 text-[11px] font-medium">
        {selectedLabel}
      </span>

      <div
        className={cn(
          "absolute inset-0 rounded-md transition-all",
          disabled || !accessToken || options.length === 0 ? "opacity-50" : "hover:bg-zinc-800/40"
        )}
      >
        <span className="pointer-events-none block truncate whitespace-nowrap px-2 py-1.5 pr-5 text-[11px] font-medium text-zinc-500 transition-colors group-hover/model:text-zinc-300">
          {selectedLabel}
        </span>

        <select
          value={selectedValue}
          onChange={handleChange}
          disabled={disabled || !accessToken || isLoading || options.length === 0}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 outline-none disabled:cursor-not-allowed"
          title="Select model"
        >
          {!selectedValue && (
            <option value="">
              {selectedLabel}
            </option>
          )}
          {options.map((option) => (
            <option
              key={`${option.provider}:${option.model}`}
              value={`${option.provider}:${option.model}`}
              className="bg-zinc-900 py-1 text-zinc-300"
            >
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <ChevronDown
        size={10}
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 opacity-50 transition-opacity group-hover/model:opacity-100"
      />
    </div>
  );
}
