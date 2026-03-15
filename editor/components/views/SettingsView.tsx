import { AnimatePresence, motion } from "motion/react";
import {
  Cpu,
  ExternalLink,
  Keyboard,
  Palette,
  Plus,
  Plug,
  Search,
  Settings2,
  Terminal,
  User,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useLocation, useNavigate } from "react-router";
import { AIModelsSettings } from "@/components/settings/AIModelsSettings";
import { LLM_PROVIDERS as PROVIDERS } from "@/constants/llmProviders";
import { cn } from "@/lib/utils";
import { openUrl } from "@/services/tauri/shell";
import { isTauriEnvironment } from "@/services/tauri/deepLink";
import { useAuthStore, useMcpStore, useProjectStore, useUIStore } from "@/stores";
import type { ApiKeyStorage } from "@/stores/configStore";
import { getBackendBaseUrl, type AuthUser, type OAuthProvider } from "@/services/backend/auth";
import type { LLMConfig, LLMProvider } from "@/services/llm/types";
import type {
  McpConfigScope,
  McpServerConfig,
  McpServerStatus,
  McpToolDescriptor,
} from "@/services/mcp";
import { confirmDialog } from "@/services/tauri/dialog";

const NAV_ITEMS = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "models", label: "AI Models", icon: Cpu },
  { id: "mcp", label: "MCP Servers", icon: Plug },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "account", label: "Account", icon: User },
] as const;

const ACCOUNT_PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: "github", label: "GitHub" },
  { id: "gitee", label: "Gitee" },
  { id: "google", label: "Google" },
];

type SettingsTab = (typeof NAV_ITEMS)[number]["id"];

interface McpServerDraft {
  scope: McpConfigScope;
  id: string;
  name: string;
  enabled: boolean;
  command: string;
  argsText: string;
  cwd: string;
  envText: string;
}

interface ModelsSettingsProps {
  currentProvider: LLMProvider;
  currentConfig: LLMConfig;
  llmConfigs: Record<LLMProvider, LLMConfig>;
  apiKeys: ApiKeyStorage;
  setCurrentProvider: (provider: LLMProvider) => void;
  setLLMConfig: (provider: LLMProvider, config: Partial<LLMConfig>) => void;
  setApiKey: (provider: LLMProvider, key: string | undefined) => void;
}

interface MCPSettingsProps {
  mcpSupported: boolean;
  currentProject: { name: string; path: string } | null;
  servers: McpServerStatus[];
  tools: McpToolDescriptor[];
  isLoading: boolean;
  scopeOptions: readonly { value: McpConfigScope; label: string }[];
  formOpen: boolean;
  setFormOpen: (open: boolean) => void;
  draft: McpServerDraft;
  setDraft: Dispatch<SetStateAction<McpServerDraft>>;
  configText: string;
  setConfigText: Dispatch<SetStateAction<string>>;
  openNewForm: () => void;
  openEditForm: (server: McpServerStatus) => void;
  handleSaveServer: () => Promise<void>;
  handleToggleServer: (server: McpServerStatus) => Promise<void>;
  handleRetryServer: (server: McpServerStatus) => Promise<void>;
  handleDeleteServer: (server: McpServerStatus) => Promise<void>;
}

const emptyDraft = (scope: McpConfigScope): McpServerDraft => ({
  scope,
  id: "",
  name: "",
  enabled: true,
  command: "",
  argsText: "",
  cwd: "",
  envText: "",
});

function defaultLLMConfigFor(provider: LLMProvider): LLMConfig {
  const providerDef = PROVIDERS.find((item) => item.id === provider);
  const baseConfig: LLMConfig = {
    provider,
    model: providerDef?.models[0] || "",
    maxTokens: 4096,
    temperature: 0.7,
  };

  if (provider === "ollama") {
    return {
      ...baseConfig,
      baseUrl: "http://localhost:11434",
    };
  }

  return baseConfig;
}

function draftFromServer(server: McpServerStatus): McpServerDraft {
  const transport =
    server.config.transport.type === "stdio"
      ? server.config.transport
      : { type: "stdio" as const, command: "", args: [] };

  return {
    scope: server.scope,
    id: server.id,
    name: server.name,
    enabled: server.enabled,
    command: transport.command,
    argsText: transport.args.join("\n"),
    cwd: server.config.cwd || "",
    envText: Object.entries(server.config.env || {})
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  };
}

function parseEnv(envText: string): Record<string, string> {
  return envText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((env, line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) {
        return env;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (key) {
        env[key] = value;
      }
      return env;
    }, {});
}

function draftToSnippet(draft: McpServerDraft): string {
  const id = draft.id.trim() || "server_id";
  const name = draft.name.trim() || "Server Name";
  const args = draft.argsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const env = parseEnv(draft.envText);

  const serverConfig: Record<string, unknown> = {
    name,
    command: draft.command.trim() || "npx",
    args,
    enabled: draft.enabled,
  };

  if (draft.cwd.trim()) {
    serverConfig.cwd = draft.cwd.trim();
  }

  if (Object.keys(env).length > 0) {
    serverConfig.env = env;
  }

  return JSON.stringify(
    {
      mcpServers: {
        [id]: serverConfig,
      },
    },
    null,
    2
  );
}

function parseSnippetToServerConfig(
  snippet: string,
  scope: McpConfigScope
): { draft: McpServerDraft; serverConfig: McpServerConfig } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(snippet);
  } catch {
    throw new Error("请粘贴合法的 MCP JSON 配置");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("MCP 配置必须是一个 JSON 对象");
  }

  const servers = (parsed as { mcpServers?: unknown }).mcpServers;
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) {
    throw new Error("JSON 中缺少 mcpServers 对象");
  }

  const firstEntry = Object.entries(servers as Record<string, unknown>)[0];
  if (!firstEntry) {
    throw new Error("mcpServers 不能为空");
  }

  const [id, rawServer] = firstEntry;
  if (!rawServer || typeof rawServer !== "object" || Array.isArray(rawServer)) {
    throw new Error("server 配置格式不正确");
  }

  const server = rawServer as Record<string, unknown>;
  const command = typeof server.command === "string" ? server.command.trim() : "";
  if (!command) {
    throw new Error("server 配置缺少 command");
  }

  const args = Array.isArray(server.args)
    ? server.args.filter((value): value is string => typeof value === "string")
    : [];
  const env =
    server.env && typeof server.env === "object" && !Array.isArray(server.env)
      ? Object.fromEntries(
          Object.entries(server.env as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string"
          )
        )
      : {};

  const draft: McpServerDraft = {
    scope,
    id: id.trim(),
    name: typeof server.name === "string" && server.name.trim() ? server.name.trim() : id.trim(),
    enabled: typeof server.enabled === "boolean" ? server.enabled : true,
    command,
    argsText: args.join("\n"),
    cwd: typeof server.cwd === "string" ? server.cwd : "",
    envText: Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  };

  return {
    draft,
    serverConfig: {
      id: draft.id,
      name: draft.name,
      enabled: draft.enabled,
      transport: {
        type: "stdio",
        command: draft.command,
        args,
      },
      cwd: draft.cwd.trim() || null,
      env,
    },
  };
}

function statusDot(status: McpServerStatus["status"]) {
  switch (status) {
    case "connected":
      return "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.45)]";
    case "connecting":
      return "bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.35)]";
    case "approvalRequired":
      return "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]";
    case "error":
      return "bg-red-400";
    default:
      return "bg-zinc-600";
  }
}

interface AccountSettingsProps {
  user: AuthUser | null;
  currentOAuthProvider: OAuthProvider | null;
  pendingAction: "signOut" | null;
  pendingOAuthProvider: OAuthProvider | null;
  backendBaseUrl: string;
  onConnect: (provider: OAuthProvider) => Promise<void>;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => void;
}

function AccountSettings({
  user,
  currentOAuthProvider,
  pendingAction,
  pendingOAuthProvider,
  backendBaseUrl,
  onConnect,
  onSignOut,
  onDeleteAccount,
}: AccountSettingsProps) {
  const isSignedIn = Boolean(user);
  const avatarText = (user?.username.trim().charAt(0) || "S").toUpperCase();
  const isSigningOut = pendingAction === "signOut";
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [user?.avatarUrl]);

  return (
    <motion.div
      key="account"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="max-w-[600px] space-y-12"
    >
      <div>
        <h2 className="mb-1 text-[20px] font-medium text-zinc-100">Account</h2>
        <p className="text-[13px] text-zinc-500">Manage your profile and connected services.</p>
      </div>

      <section className="space-y-4">
        <h3 className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">Profile</h3>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-800 text-[13px] font-semibold text-zinc-200">
              {user?.avatarUrl && !avatarFailed ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username || "User avatar"}
                  className="h-full w-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                avatarText
              )}
            </div>
            <div>
              <div className="text-[13px] font-medium text-zinc-300">
                {user?.username || "Not signed in"}
              </div>
              <div className="text-[12px] text-zinc-600">
                {user?.email || "Use GitHub, Gitee or Google to sign in via the backend."}
              </div>
            </div>
          </div>
          {isSignedIn ? (
            <button
              onClick={() => void onSignOut()}
              disabled={isSigningOut || pendingOAuthProvider !== null}
              className="text-[12px] text-zinc-500 transition-colors hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </button>
          ) : (
            <span className="text-[12px] text-zinc-600">Backend OAuth</span>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">
            Connected Accounts
          </h3>
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-600">
            <ExternalLink size={12} />
            {backendBaseUrl}
          </span>
        </div>

        <div className="space-y-4">
          {(isSignedIn && currentOAuthProvider
            ? ACCOUNT_PROVIDERS.filter((provider) => provider.id === currentOAuthProvider)
            : ACCOUNT_PROVIDERS
          ).map((provider) => {
            const isConnected = currentOAuthProvider === provider.id && isSignedIn;
            const handle = isConnected ? `(@${user?.username})` : null;
            const isPendingProvider = pendingOAuthProvider === provider.id;
            const isAnyAccountActionPending = isSigningOut || pendingOAuthProvider !== null;

            return (
              <div key={provider.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-zinc-400">{provider.label}</span>
                  {handle && <span className="font-mono text-[11px] text-zinc-600">{handle}</span>}
                </div>

                {isSignedIn ? (
                  <span className="text-[12px] text-zinc-500">Signed In</span>
                ) : (
                  <button
                    onClick={() => void onConnect(provider.id)}
                    disabled={isAnyAccountActionPending}
                    className="text-[12px] text-zinc-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPendingProvider ? "Signing in..." : "Sign In"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 pt-4">
        <h3 className="text-[11px] font-medium uppercase tracking-widest text-red-500/50">
          Danger Zone
        </h3>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px] text-zinc-500">Delete Account</span>
          <button
            onClick={onDeleteAccount}
            className="text-[12px] text-red-400/70 transition-colors hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </section>
    </motion.div>
  );
}

function PlaceholderSettings({ title }: { title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="flex min-h-[420px] flex-col items-center justify-center text-center text-zinc-500"
    >
      <Settings2 size={42} className="mb-4 opacity-25" />
      <h2 className="text-[16px] font-medium text-zinc-300">{title}</h2>
      <p className="mt-2 text-[13px] text-zinc-500">该部分后续继续和 Slate 主线同步。</p>
    </motion.div>
  );
}

function maskSecret(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "Not configured";
  }

  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}...`;
  }

  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function describeMcpStatus(status: McpServerStatus["status"]) {
  switch (status) {
    case "connected":
      return "Connected";
    case "approvalRequired":
      return "Awaiting Approval";
    case "connecting":
      return "Connecting";
    case "disabled":
      return "Disabled";
    case "unsupported":
      return "Unsupported";
    case "error":
      return "Error";
    default:
      return "Offline";
  }
}

function ModelsSettings({
  currentProvider,
  currentConfig,
  llmConfigs,
  apiKeys,
  setCurrentProvider,
  setLLMConfig,
  setApiKey,
}: ModelsSettingsProps) {
  const addToast = useUIStore((state) => state.addToast);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [customProviderName, setCustomProviderName] = useState("");
  const [customModelName, setCustomModelName] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customProviderKey, setCustomProviderKey] = useState("");
  const [isSavingCustomProvider, setIsSavingCustomProvider] = useState(false);
  const [providerDrafts, setProviderDrafts] = useState<Record<LLMProvider, string>>({
    anthropic: apiKeys.anthropic || "",
    openai: apiKeys.openai || "",
    ollama: llmConfigs.ollama.baseUrl || "http://localhost:11434",
  });

  useEffect(() => {
    setProviderDrafts({
      anthropic: apiKeys.anthropic || "",
      openai: apiKeys.openai || "",
      ollama: llmConfigs.ollama.baseUrl || "http://localhost:11434",
    });
  }, [apiKeys.anthropic, apiKeys.openai, llmConfigs.ollama.baseUrl]);

  const updateProviderDraft = (provider: LLMProvider, value: string) => {
    setProviderDrafts((current) => ({
      ...current,
      [provider]: value,
    }));
  };

  const openProviderConfig = (provider: LLMProvider) => {
    setCurrentProvider(provider);
    setEditingProvider(provider);
  };

  const handleSelectModel = (provider: LLMProvider, model: string) => {
    const providerConfig = llmConfigs[provider];
    const configured =
      provider === "ollama"
        ? Boolean((providerConfig.baseUrl || "").trim())
        : Boolean(apiKeys[provider]?.trim());

    if (!configured) {
      openProviderConfig(provider);
      return;
    }

    setCurrentProvider(provider);
    setLLMConfig(provider, { model });
  };

  const saveProviderConfig = (provider: LLMProvider) => {
    const nextValue = providerDrafts[provider].trim();
    if (provider === "ollama") {
      setLLMConfig("ollama", { baseUrl: nextValue || "http://localhost:11434" });
    } else {
      setApiKey(provider, nextValue || undefined);
    }
    setCurrentProvider(provider);
    setEditingProvider(null);
  };

  const resetCustomProviderForm = () => {
    setCustomProviderName("");
    setCustomModelName("");
    setCustomBaseUrl("");
    setCustomProviderKey("");
  };

  const handleSaveCustomProvider = () => {
    if (!customProviderKey.trim()) {
      return;
    }

    setIsSavingCustomProvider(true);
    window.setTimeout(() => {
      addToast({
        type: "warning",
        message: "当前版本暂不支持自定义 Provider，已保留与 Slate 一致的设置入口。",
      });
      setIsSavingCustomProvider(false);
      setIsAddingProvider(false);
      resetCustomProviderForm();
    }, 400);
  };

  return (
    <motion.div
      key="models"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="max-w-[600px] space-y-8"
    >
      <div>
        <h2 className="mb-1 text-[20px] font-medium text-zinc-100">AI Providers</h2>
        <p className="text-[13px] text-zinc-500">
          Configure your API keys. Models will be available instantly in your workspace.
        </p>
      </div>

      <section className="space-y-1">
          {PROVIDERS.map((provider) => {
            const isActive = currentProvider === provider.id;
            const configured =
              provider.id === "ollama"
                ? Boolean((llmConfigs.ollama.baseUrl || "").trim())
                : Boolean(apiKeys[provider.id]?.trim());
            const isEditing = editingProvider === provider.id;
            const draftValue = providerDrafts[provider.id];
            const providerConfig = llmConfigs[provider.id];
            const selectedModel = providerConfig.model || provider.models[0];
            const detailText =
              provider.id === "ollama"
                ? llmConfigs.ollama.baseUrl || "http://localhost:11434"
                : maskSecret(apiKeys[provider.id]);
            const placeholder = provider.id === "ollama" ? "http://localhost:11434" : "sk-...";
            const statusLabel = configured
              ? provider.id === "ollama"
                ? "Configured"
                : "Connected"
              : "Not configured";
            const actionLabel = configured ? "Config" : "Connect";

            return (
              <div key={provider.id} className="space-y-2">
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
                          {provider.name}
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
                              onClick={() => setCurrentProvider(provider.id)}
                              className="px-2 py-1 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
                            >
                              Use
                            </button>
                          )}
                          <button
                            onClick={() => openProviderConfig(provider.id)}
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
                      {provider.models.map((model) => {
                        const isSelected = isActive && selectedModel === model;

                        return (
                          <button
                            key={model}
                            type="button"
                            onClick={() => handleSelectModel(provider.id, model)}
                            className={cn(
                              "rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                              isSelected
                                ? "border-white/15 bg-white/[0.08] text-zinc-200"
                                : "border-white/5 bg-white/[0.02] text-zinc-400 hover:border-white/10 hover:text-zinc-300"
                            )}
                          >
                            {model}
                          </button>
                        );
                      })}
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
                          <h4 className="text-[13px] font-medium text-zinc-300">{provider.name}</h4>
                          <p className="mt-0.5 text-[11px] text-zinc-500">
                            {provider.id === "ollama"
                              ? "Configure your local runtime endpoint and default model."
                              : "Configure your API key and default model."}
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">
                              {provider.id === "ollama" ? "Base URL" : "API Key"}
                            </label>
                            <input
                              type={provider.id === "ollama" ? "text" : "password"}
                              value={draftValue}
                              onChange={(event) => updateProviderDraft(provider.id, event.target.value)}
                              placeholder={placeholder}
                              className="flex-1 border-b border-white/10 bg-transparent pb-1.5 font-mono text-[12px] text-zinc-300 transition-colors placeholder:text-zinc-700 focus:border-zinc-500 focus:outline-none"
                              autoFocus
                            />
                          </div>

                          <div className="flex items-center gap-4">
                            <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">
                              Default Model
                            </label>
                            <div className="relative flex-1">
                              <select
                                value={selectedModel}
                                onChange={(event) => {
                                  setCurrentProvider(provider.id);
                                  setLLMConfig(provider.id, { model: event.target.value });
                                }}
                                className="w-full appearance-none border-b border-white/10 bg-transparent pb-1.5 pr-8 text-[12px] text-zinc-300 transition-colors focus:border-zinc-500 focus:outline-none"
                              >
                                {provider.models.map((model) => (
                                  <option key={model} value={model}>
                                    {model}
                                  </option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-zinc-500">
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
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
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button
                            onClick={() => setEditingProvider(null)}
                            className="text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveProviderConfig(provider.id)}
                            className="text-[12px] font-medium text-zinc-300 transition-colors hover:text-white"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

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
                      <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">
                        Provider Name
                      </label>
                      <input
                        type="text"
                        value={customProviderName}
                        onChange={(event) => setCustomProviderName(event.target.value)}
                        placeholder="e.g. DeepSeek"
                        className="flex-1 border-b border-white/10 bg-transparent pb-1.5 font-mono text-[12px] text-zinc-300 transition-colors placeholder:text-zinc-700 focus:border-zinc-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="w-24 flex-shrink-0 text-[12px] text-zinc-400">
                        Model Name
                      </label>
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
                      onClick={handleSaveCustomProvider}
                      disabled={!customProviderKey.trim() || isSavingCustomProvider}
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
    </motion.div>
  );
}

function MCPSettings({
  mcpSupported,
  currentProject,
  servers,
  tools,
  isLoading,
  scopeOptions,
  formOpen,
  setFormOpen,
  draft,
  setDraft,
  configText,
  setConfigText,
  openNewForm,
  openEditForm,
  handleSaveServer,
  handleToggleServer,
  handleRetryServer,
  handleDeleteServer,
}: MCPSettingsProps) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const filteredServers = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return servers;
    }

    return servers.filter((server) =>
      [server.name, server.id, server.transportSummary, server.scope].join(" ").toLowerCase().includes(query)
    );
  }, [deferredSearch, servers]);
  const editingServer = useMemo(
    () => servers.find((server) => server.id === draft.id && server.scope === draft.scope) || null,
    [draft.id, draft.scope, servers]
  );

  const getServerMeta = (server: McpServerStatus) => {
    const items = [server.transportSummary];

    if (server.status === "connected") {
      items.push(`${server.toolCount} Tools`);
    }

    return items;
  };

  const renderServerActions = (server: McpServerStatus) => {
    if (!mcpSupported) {
      return null;
    }

    if (server.status === "connected") {
      return (
        <div className="absolute right-4 flex items-center gap-1 bg-[#050505] pl-2 opacity-0 shadow-[0_0_12px_8px_#050505] transition-opacity group-hover:opacity-100">
          <button
            onClick={() => void handleRetryServer(server)}
            className="px-2 py-1 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Restart
          </button>
          <button
            onClick={() => openEditForm(server)}
            className="px-2 py-1 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Config
          </button>
        </div>
      );
    }

    const primaryLabel =
      server.status === "approvalRequired"
        ? "Approve"
        : server.status === "disabled"
        ? "Enable"
        : server.status === "connecting"
        ? "Connecting"
        : server.status === "unsupported"
        ? null
        : server.status === "error"
        ? "Retry"
        : "Connect";

    const primaryAction =
      server.status === "approvalRequired"
        ? () => handleRetryServer(server)
        : server.status === "disabled"
        ? () => handleToggleServer(server)
        : server.status === "connecting"
        ? null
        : server.status === "unsupported"
        ? null
        : server.status === "error"
        ? () => handleRetryServer(server)
        : () => handleRetryServer(server);

    return (
      <div className="absolute right-4 flex items-center gap-2 bg-[#050505] pl-2 opacity-0 shadow-[0_0_12px_8px_#050505] transition-opacity group-hover:opacity-100">
        {primaryLabel && (
          <button
            onClick={() => primaryAction && void primaryAction()}
            disabled={server.status === "connecting"}
            className={cn(
              "rounded border border-white/5 px-3 py-1 text-[12px] transition-colors",
              server.status === "connecting"
                ? "cursor-not-allowed border-white/5 bg-white/5 text-zinc-500"
                : "bg-white/10 text-zinc-200 hover:bg-white/15"
            )}
          >
            {primaryLabel}
          </button>
        )}
        <button
          onClick={() => openEditForm(server)}
          className="px-2 py-1 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Config
        </button>
      </div>
    );
  };

  return (
    <motion.div
      key="mcp"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="space-y-10 pb-24"
    >
      <div className="flex items-start justify-between pb-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h2 className="text-[20px] font-medium tracking-tight text-zinc-100">MCP Servers</h2>
            <div className="rounded-full border border-zinc-700/50 bg-zinc-800/50 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
              BETA
            </div>
          </div>
          <p className="max-w-[420px] text-[13px] leading-relaxed text-zinc-500">
            Expand your Agent&apos;s capabilities by connecting to external tools, databases, and local file systems.
          </p>
        </div>

        <button
          onClick={() => {
            if (formOpen) {
              setFormOpen(false);
            } else {
              openNewForm();
            }
          }}
          disabled={!mcpSupported}
          className={cn(
            "group flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium shadow-sm transition-all duration-200 active:scale-95",
            !mcpSupported
              ? "cursor-not-allowed border-white/5 bg-white/[0.03] text-zinc-600"
              : formOpen
              ? "border-white/20 bg-white/10 text-white"
              : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
          )}
        >
          {formOpen ? (
            <X size={14} className="text-zinc-400" />
          ) : (
            <Plus size={14} className="text-zinc-400 transition-colors group-hover:text-zinc-200" />
          )}
          <span>{formOpen ? "Cancel" : "Add Server"}</span>
        </button>
      </div>

      {!mcpSupported && (
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 text-[13px] leading-relaxed text-amber-100/80">
          MCP Servers 仅支持桌面端。当前 Web 环境下只能查看占位状态，新增、编辑、启停、重连和删除都已禁用。
        </div>
      )}

      <AnimatePresence initial={false}>
        {mcpSupported && formOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, overflow: "hidden" }}
            animate={{ opacity: 1, height: "auto", overflow: "hidden" }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="flex flex-col overflow-hidden rounded-xl border border-white/5 bg-black/20"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-zinc-500" />
                <h3 className="text-[12px] font-medium text-zinc-300">Server Configuration</h3>
              </div>
              <span className="text-[10px] font-mono tracking-wider text-zinc-500">JSON</span>
            </div>

            <textarea
              value={configText}
              onChange={(event) => setConfigText(event.target.value)}
              spellCheck={false}
              className="custom-scrollbar block h-[180px] w-full resize-y border-none bg-transparent p-3 font-mono text-[12px] leading-relaxed text-zinc-300 transition-colors placeholder:text-zinc-700 focus:bg-white/[0.01] focus:outline-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 bg-black/40 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <p className="text-[11px] text-zinc-500">Paste your MCP server configuration JSON above.</p>
                {currentProject && (
                  <div className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1">
                    <select
                      value={draft.scope}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          scope: event.target.value as McpConfigScope,
                        }))
                      }
                      className="bg-transparent text-[11px] text-zinc-400 focus:outline-none"
                    >
                      {scopeOptions.map((scope) => (
                        <option key={scope.value} value={scope.value}>
                          {scope.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {editingServer && (
                  <button
                    onClick={() => void handleDeleteServer(editingServer)}
                    className="px-2 py-1 text-[12px] text-red-400/70 transition-colors hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => void handleSaveServer()}
                  className="rounded-md bg-zinc-200 px-3 py-1.5 text-[12px] font-medium text-zinc-900 transition-colors hover:bg-white"
                >
                  Save Config
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-6">
        <div className="relative group">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-zinc-300"
          />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search connected servers..."
            disabled={!mcpSupported && servers.length === 0}
            className="w-full rounded-xl border border-white/5 bg-black/20 py-3.5 pl-11 pr-4 text-[13px] text-zinc-200 shadow-sm transition-all placeholder:text-zinc-600 focus:border-zinc-500 focus:bg-black/40 focus:outline-none focus:ring-1 focus:ring-zinc-500/20"
          />
        </div>

        <div className="space-y-1">
          {filteredServers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-white/[0.01] p-5 text-[13px] text-zinc-500">
              {!mcpSupported
                ? "当前环境不支持 MCP 桌面运行时。请在 Slate 桌面端管理本地 stdio servers。"
                : servers.length === 0
                ? "No servers configured yet. Add a local stdio server to get started."
                : "No servers matched your search."}
            </div>
          ) : (
            filteredServers.map((server) => (
              <div
                key={`${server.scope}-${server.id}`}
                className="group relative flex items-center justify-between rounded-lg p-3 -mx-3 transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "h-8 w-8 flex-shrink-0 rounded-md border border-white/5 flex items-center justify-center",
                      server.status === "connected" ? "bg-zinc-900" : "bg-zinc-900/50 opacity-70"
                    )}
                  >
                    {server.transportType === "stdio" ? (
                      <Terminal size={14} className={server.status === "connected" ? "text-zinc-500" : "text-zinc-600"} />
                    ) : (
                      <Plug size={14} className="text-zinc-600" />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-[13px] font-medium",
                          server.status === "connected" ? "text-zinc-300" : "text-zinc-400"
                        )}
                      >
                        {server.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(server.status))} />
                        <span className={cn("text-[11px]", server.status === "connected" ? "text-zinc-500" : "text-zinc-600")}>
                          {describeMcpStatus(server.status)}
                        </span>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "flex items-center gap-2 text-[11px]",
                        server.status === "connected" ? "text-zinc-600" : "text-zinc-600/70"
                      )}
                    >
                      {getServerMeta(server).map((item, index) => (
                        <span key={`${server.id}-${item}-${index}`} className="flex items-center gap-2">
                          {index > 0 && <span>·</span>}
                          <span className={index === 0 ? "font-mono" : undefined}>{item}</span>
                        </span>
                      ))}
                    </div>

                    {(server.error || server.unsupportedReason) && (
                      <div className="max-w-[420px] truncate text-[11px] text-red-400/70">
                        {server.error || server.unsupportedReason}
                      </div>
                    )}
                  </div>
                </div>

                {renderServerActions(server)}
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function SettingsView() {
  const location = useLocation();
  const navigate = useNavigate();
  const mcpSupported = isTauriEnvironment();
  const [activeTab, setActiveTab] = useState<SettingsTab>("models");
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<McpServerDraft>(emptyDraft("global"));
  const [configText, setConfigText] = useState<string>(() => draftToSnippet(emptyDraft("global")));
  const [pendingAccountAction, setPendingAccountAction] = useState<"signOut" | null>(null);
  const [pendingOAuthProvider, setPendingOAuthProvider] = useState<OAuthProvider | null>(null);

  const currentProject = useProjectStore((state) => state.currentProject);
  const addToast = useUIStore((state) => state.addToast);
  const servers = useMcpStore((state) => state.servers);
  const tools = useMcpStore((state) => state.tools);
  const initialized = useMcpStore((state) => state.initialized);
  const isLoading = useMcpStore((state) => state.isLoading);
  const initialize = useMcpStore((state) => state.initialize);
  const saveServer = useMcpStore((state) => state.saveServer);
  const deleteServer = useMcpStore((state) => state.deleteServer);
  const toggleServer = useMcpStore((state) => state.toggleServer);
  const retryServer = useMcpStore((state) => state.retryServer);
  const mcpError = useMcpStore((state) => state.error);
  const clearError = useMcpStore((state) => state.clearError);
  const authUser = useAuthStore((state) => state.user);
  const currentOAuthProvider = useAuthStore((state) => state.currentOAuthProvider);
  const authError = useAuthStore((state) => state.error);
  const beginOAuth = useAuthStore((state) => state.beginOAuth);
  const completeOAuthCallback = useAuthStore((state) => state.completeOAuthCallback);
  const signOut = useAuthStore((state) => state.signOut);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const clearAuthError = useAuthStore((state) => state.clearError);
  const authUserId = authUser?.id ?? null;

  useEffect(() => {
    if (mcpSupported && !initialized) {
      void initialize();
    }
  }, [initialize, initialized, mcpSupported]);

  useEffect(() => {
    if (!mcpSupported && formOpen) {
      setFormOpen(false);
    }
  }, [formOpen, mcpSupported]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    const hashTab =
      location.hash && !location.hash.includes("=") ? location.hash.replace(/^#/, "") : null;
    const nextTab = tab || hashTab;

    if (nextTab && NAV_ITEMS.some((item) => item.id === nextTab) && nextTab !== activeTab) {
      setActiveTab(nextTab as SettingsTab);
    }
  }, [activeTab, location.hash, location.search]);

  useEffect(() => {
    if (mcpError) {
      addToast({ type: "error", message: mcpError });
      clearError();
    }
  }, [addToast, clearError, mcpError]);

  useEffect(() => {
    if (authError) {
      addToast({ type: "error", message: authError });
      clearAuthError();
    }
  }, [addToast, authError, clearAuthError]);

  useEffect(() => {
    if (!currentProject && draft.scope === "project") {
      setDraft((current) => ({ ...current, scope: "global" }));
    }
  }, [currentProject, draft.scope]);

  useEffect(() => {
    if (!authUser || activeTab !== "account") {
      return;
    }

    void refreshProfile().catch(() => {
      // 错误交给 authStore 的 error/toast 链路处理。
    });
  }, [activeTab, authUserId, refreshProfile]);

  useEffect(() => {
    if (!location.hash.includes("access_token") && !location.hash.includes("error=")) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const providerParam = params.get("provider");
    const provider =
      providerParam === "github" || providerParam === "gitee" || providerParam === "google"
        ? providerParam
        : null;

    let cancelled = false;

    void (async () => {
      const result = await completeOAuthCallback(location.hash, provider);
      if (cancelled) {
        return;
      }

      if (result.success) {
        const providerLabel =
          ACCOUNT_PROVIDERS.find((item) => item.id === provider)?.label || "账号";
        addToast({ type: "success", message: `${providerLabel} 登录成功，当前会话已同步。` });
      } else if (result.error) {
        addToast({ type: "error", message: result.error });
      }

      const nextParams = new URLSearchParams(location.search);
      nextParams.set("tab", "account");
      nextParams.delete("provider");
      const nextSearch = nextParams.toString();
      navigate(`/settings${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [addToast, completeOAuthCallback, location.hash, location.search, navigate]);

  const scopeOptions = useMemo(
    () =>
      currentProject
        ? ([
            { value: "global", label: "Global" },
            { value: "project", label: `Project: ${currentProject.name}` },
          ] as const)
        : ([{ value: "global", label: "Global" }] as const),
    [currentProject]
  );

  const openNewForm = () => {
    if (!mcpSupported) {
      return;
    }

    const nextDraft = emptyDraft(currentProject ? "project" : "global");
    setDraft(nextDraft);
    setConfigText(draftToSnippet(nextDraft));
    setFormOpen(true);
    setActiveTab("mcp");
  };

  const openEditForm = (server: McpServerStatus) => {
    const nextDraft = draftFromServer(server);
    setDraft(nextDraft);
    setConfigText(draftToSnippet(nextDraft));
    setFormOpen(true);
    setActiveTab("mcp");
  };

  const maybeApproveServer = async (server: McpServerStatus | null) => {
    if (!server?.requiresApproval) {
      return;
    }

    const approved = await confirmDialog(
      `首次连接或配置变更需要确认。\n\n${server.transportSummary}\n\n是否信任并连接这个 MCP server？`,
      "信任 MCP Server"
    );

    if (!approved) {
      addToast({
        type: "warning",
        message: `已保留 ${server.name}，但尚未批准连接`,
      });
      return;
    }

    const nextServer = await retryServer({
      scope: server.scope,
      id: server.id,
      approve: true,
    });

    if (nextServer) {
      addToast({
        type: "success",
        message: `已批准并重新连接 ${nextServer.name}`,
      });
    }
  };

  const handleSaveServer = async () => {
    if (draft.scope === "project" && !currentProject) {
      addToast({ type: "warning", message: "当前没有打开项目，无法写入项目级配置" });
      return;
    }

    try {
      const parsed = parseSnippetToServerConfig(configText, draft.scope);
      setDraft(parsed.draft);

      const targetServer = await saveServer({
        scope: parsed.draft.scope,
        server: parsed.serverConfig,
      });

      addToast({
        type: "success",
        message: `已保存 MCP server ${parsed.serverConfig.name}`,
      });
      setFormOpen(false);
      await maybeApproveServer(targetServer);
    } catch (error) {
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "保存 MCP server 失败",
      });
    }
  };

  const handleToggleServer = async (server: McpServerStatus) => {
    try {
      const targetServer = await toggleServer({
        scope: server.scope,
        id: server.id,
        enabled: !server.enabled,
      });

      addToast({
        type: "info",
        message: `${server.name} 已${server.enabled ? "停用" : "启用"}`,
      });

      if (!server.enabled) {
        await maybeApproveServer(targetServer);
      }
    } catch (error) {
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "切换 MCP server 状态失败",
      });
    }
  };

  const handleRetryServer = async (server: McpServerStatus) => {
    try {
      const targetServer = await retryServer({
        scope: server.scope,
        id: server.id,
      });
      await maybeApproveServer(targetServer);
    } catch (error) {
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "重连 MCP server 失败",
      });
    }
  };

  const handleDeleteServer = async (server: McpServerStatus) => {
    const confirmed = await confirmDialog(
      `确定删除 MCP server "${server.name}" 吗？`,
      "删除 MCP Server"
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteServer(server.scope, server.id);
      addToast({
        type: "success",
        message: `已删除 ${server.name}`,
      });
    } catch (error) {
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "删除 MCP server 失败",
      });
    }
  };

  const handleConnectAccount = async (provider: OAuthProvider) => {
    try {
      setPendingOAuthProvider(provider);
      const redirectTo = isTauriEnvironment()
        ? `slate://auth/callback?provider=${provider}`
        : `${window.location.origin}/settings?tab=account&provider=${provider}`;
      const authorizationUrl = await beginOAuth(provider, redirectTo);

      if (isTauriEnvironment()) {
        await openUrl(authorizationUrl);
      } else {
        window.location.assign(authorizationUrl);
      }
    } catch (error) {
      const providerLabel = ACCOUNT_PROVIDERS.find((item) => item.id === provider)?.label || provider;
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : `${providerLabel} 登录失败`,
      });
    } finally {
      setPendingOAuthProvider(null);
    }
  };

  const handleSignOut = async () => {
    try {
      setPendingAccountAction("signOut");
      await signOut();
      addToast({
        type: "success",
        message: "已退出当前账号。",
      });
    } finally {
      setPendingAccountAction(null);
    }
  };

  const handleDeleteAccount = () => {
    addToast({
      type: "warning",
      message: "删除账号接口还未接入后端，当前版本暂不支持。",
    });
  };

  const renderContent = () => {
    switch (activeTab) {
      case "models":
        return <AIModelsSettings />;
      case "mcp":
        return (
          <MCPSettings
            mcpSupported={mcpSupported}
            currentProject={currentProject ? { name: currentProject.name, path: currentProject.path } : null}
            servers={servers}
            tools={tools}
            isLoading={isLoading}
            scopeOptions={scopeOptions}
            formOpen={formOpen}
            setFormOpen={setFormOpen}
            draft={draft}
            setDraft={setDraft}
            configText={configText}
            setConfigText={setConfigText}
            openNewForm={openNewForm}
            openEditForm={openEditForm}
            handleSaveServer={handleSaveServer}
            handleToggleServer={handleToggleServer}
            handleRetryServer={handleRetryServer}
            handleDeleteServer={handleDeleteServer}
          />
        );
      case "account":
        return (
          <AccountSettings
            user={authUser}
            currentOAuthProvider={currentOAuthProvider}
            pendingAction={pendingAccountAction}
            pendingOAuthProvider={pendingOAuthProvider}
            backendBaseUrl={getBackendBaseUrl()}
            onConnect={handleConnectAccount}
            onSignOut={handleSignOut}
            onDeleteAccount={handleDeleteAccount}
          />
        );
      default:
        return (
          <PlaceholderSettings
            title={NAV_ITEMS.find((item) => item.id === activeTab)?.label || "Unknown"}
          />
        );
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-obsidian text-zinc-100">
      <div className="flex w-[260px] flex-shrink-0 flex-col border-r border-graphite bg-charcoal/30">
        <div className="flex h-14 items-center border-b border-graphite px-6">
          <h2 className="text-[14px] font-medium text-zinc-200">Settings</h2>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-3 py-6">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    const nextParams = new URLSearchParams(location.search);
                    nextParams.set("tab", item.id);
                    navigate(`/settings?${nextParams.toString()}`, { replace: true });
                  }}
                  className={cn(
                    "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                    isActive
                      ? "bg-white/10 text-zinc-100 shadow-sm"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  )}
                >
                  <Icon size={16} className={isActive ? "text-zinc-200" : "text-zinc-500"} />
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute left-0 h-5 w-1 rounded-r-full bg-zinc-300"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col bg-obsidian/50">
        <div className="custom-scrollbar flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[840px] px-8 py-10 lg:px-12 lg:py-12">
            <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
