import { AnimatePresence, motion } from "motion/react";
import {
  Cpu,
  Keyboard,
  Key,
  Link2,
  Palette,
  Plus,
  Plug,
  Power,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  Terminal,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { cn } from "@/lib/utils";
import { useConfigStore, useMcpStore, useProjectStore, useUIStore } from "@/stores";
import type { ApiKeyStorage } from "@/stores/configStore";
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

const PROVIDERS: {
  id: LLMProvider;
  name: string;
  mark: string;
  description: string;
  models: string[];
  badgeClass: string;
}[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    mark: "A",
    description: "用于复杂推理和稳定的工具调用。",
    models: [
      "claude-sonnet-4-6-20250514",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
    badgeClass: "text-[#d97757] border-[#d97757]/20 bg-[#d97757]/10",
  },
  {
    id: "openai",
    name: "OpenAI",
    mark: "O",
    description: "适合通用对话、快速输出和多模态场景。",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    badgeClass: "text-emerald-500 border-emerald-500/20 bg-emerald-500/10",
  },
  {
    id: "ollama",
    name: "Ollama",
    mark: "L",
    description: "本地模型运行时，适合离线开发环境。",
    models: ["llama3.2", "qwen2.5", "mistral", "codellama"],
    badgeClass: "text-zinc-300 border-zinc-700 bg-zinc-800/60",
  },
] as const;

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

function ModelsSettings({
  currentProvider,
  currentConfig,
  llmConfigs,
  apiKeys,
  setCurrentProvider,
  setLLMConfig,
  setApiKey,
}: ModelsSettingsProps) {
  return (
    <motion.div
      key="models"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="space-y-10 pb-24"
    >
      <div>
        <h2 className="mb-2 text-[24px] font-medium tracking-tight text-zinc-100">AI Models</h2>
        <p className="text-[14px] text-zinc-500">
          保持和 Slate 一致的设置层级，直接编辑当前工作区的模型配置。
        </p>
      </div>

      <section className="space-y-5">
        <h3 className="text-[12px] font-medium uppercase tracking-widest text-zinc-500">
          Provider Selection
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PROVIDERS.map((provider) => {
            const active = currentProvider === provider.id;
            return (
              <button
                key={provider.id}
                onClick={() => setCurrentProvider(provider.id)}
                className={cn(
                  "rounded-xl border p-5 text-left transition-all duration-200",
                  active
                    ? "border-white/15 bg-white/[0.03] shadow-sm"
                    : "border-graphite bg-white/[0.01] hover:bg-white/[0.02]"
                )}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg border text-[15px] font-semibold",
                        provider.badgeClass
                      )}
                    >
                      {provider.mark}
                    </div>
                    <div>
                      <div className="text-[14px] font-medium text-zinc-200">{provider.name}</div>
                      <div className="mt-1 text-[12px] text-zinc-500">
                        {llmConfigs[provider.id].model}
                      </div>
                    </div>
                  </div>
                  {active && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[13px] leading-relaxed text-zinc-500">{provider.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-5">
        <h3 className="text-[12px] font-medium uppercase tracking-widest text-zinc-500">
          Model Configuration
        </h3>
        <div className="space-y-4 rounded-xl border border-graphite bg-[#0a0a0a] p-5">
          <div className="space-y-2">
            <label className="text-[13px] text-zinc-500">Model</label>
            <select
              value={currentConfig.model}
              onChange={(event) => setLLMConfig(currentProvider, { model: event.target.value })}
              className="w-full rounded-lg border border-graphite bg-black/40 px-3 py-2.5 text-[13px] text-zinc-200 focus:border-zinc-500 focus:outline-none"
            >
              {PROVIDERS.find((provider) => provider.id === currentProvider)?.models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between text-[13px] text-zinc-500">
              <span>Temperature</span>
              <span className="font-mono text-zinc-400">
                {(currentConfig.temperature ?? 0.7).toFixed(1)}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={currentConfig.temperature ?? 0.7}
              onChange={(event) =>
                setLLMConfig(currentProvider, {
                  temperature: parseFloat(event.target.value),
                })
              }
              className="w-full accent-zinc-300"
            />
          </div>

          {currentProvider === "ollama" && (
            <div className="space-y-2">
              <label className="text-[13px] text-zinc-500">Base URL</label>
              <input
                value={currentConfig.baseUrl || ""}
                onChange={(event) => setLLMConfig("ollama", { baseUrl: event.target.value })}
                placeholder="http://localhost:11434"
                className="w-full rounded-lg border border-graphite bg-black/40 px-3 py-2.5 text-[13px] text-zinc-200 focus:border-zinc-500 focus:outline-none placeholder:text-zinc-700"
              />
            </div>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <h3 className="text-[12px] font-medium uppercase tracking-widest text-zinc-500">
          Providers
        </h3>
        <div className="space-y-4">
          {PROVIDERS.map((provider) => {
            const configured = provider.id === "ollama" || Boolean(apiKeys[provider.id]);

            return (
              <div
                key={provider.id}
                className="flex flex-col gap-5 rounded-xl border border-graphite bg-[#0a0a0a] p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg border text-[16px] font-semibold",
                        provider.badgeClass
                      )}
                    >
                      {provider.mark}
                    </div>
                    <div>
                      <h4 className="text-[14px] font-medium text-zinc-200">{provider.name}</h4>
                      <div className="mt-1 text-[12px] text-zinc-500">
                        {configured ? "Connected" : "Not configured"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentProvider(provider.id)}
                    className="text-[13px] font-medium text-zinc-400 transition-colors hover:text-zinc-200"
                  >
                    Use
                  </button>
                </div>

                <div className="flex items-center gap-3 border-t border-graphite pt-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5">
                    <Key size={12} className="text-zinc-400" />
                  </div>
                  {provider.id === "ollama" ? (
                    <input
                      value={llmConfigs.ollama.baseUrl || ""}
                      onChange={(event) => setLLMConfig("ollama", { baseUrl: event.target.value })}
                      placeholder="http://localhost:11434"
                      className="flex-1 bg-transparent text-[13px] text-zinc-400 focus:outline-none placeholder:text-zinc-600"
                    />
                  ) : (
                    <input
                      type="password"
                      value={apiKeys[provider.id] || ""}
                      onChange={(event) => setApiKey(provider.id, event.target.value || undefined)}
                      placeholder={provider.id === "anthropic" ? "sk-ant-..." : "sk-proj-..."}
                      className="flex-1 bg-transparent text-[13px] text-zinc-400 focus:outline-none placeholder:text-zinc-600"
                    />
                  )}
                  <span className="rounded-md border border-white/5 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-zinc-300">
                    自动保存
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
}

function MCPSettings({
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
  const scopePathHint =
    draft.scope === "project" && currentProject
      ? `${currentProject.path}\\.slate\\mcps.json`
      : "~/.slate/mcps.json";
  const scopePathLabel =
    draft.scope === "project" && currentProject
      ? "Current project/.slate/mcps.json"
      : "~/.slate/mcps.json";

  const getServerMeta = (server: McpServerStatus) => {
    if (server.status === "connected") {
      return (
        <div className="flex items-center gap-3 text-[11px] font-medium text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Link2 size={12} className="text-zinc-400" />
            {server.toolCount} Tools
          </span>
          {server.capabilities.prompts && (
            <span className="flex items-center gap-1.5">
              <Link2 size={12} className="text-zinc-400" />
              Prompts
            </span>
          )}
          {server.capabilities.resources && (
            <span className="flex items-center gap-1.5">
              <Link2 size={12} className="text-zinc-400" />
              Resources
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 text-[11px] font-medium text-zinc-600">
        <span className="flex items-center gap-1.5">
          {server.status === "approvalRequired"
            ? "Awaiting Approval"
            : server.status === "connecting"
            ? "Connecting"
            : server.status === "disabled"
            ? "Disabled"
            : server.status === "unsupported"
            ? "Unsupported"
            : server.status === "error"
            ? "Error"
            : "Offline"}
        </span>
      </div>
    );
  };

  const renderServerActions = (server: McpServerStatus) => {
    if (server.status === "connected") {
      return (
        <div className="flex items-center gap-1 sm:-translate-x-2 sm:opacity-0 sm:transition-all sm:duration-300 group-hover:translate-x-0 group-hover:opacity-100">
          <button
            onClick={() => void handleRetryServer(server)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-zinc-400 shadow-sm transition-colors hover:border-white/5 hover:bg-white/10 hover:text-zinc-100"
            title="Restart Server"
          >
            <Power size={14} />
          </button>
          <button
            onClick={() => openEditForm(server)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-zinc-400 shadow-sm transition-colors hover:border-white/5 hover:bg-white/10 hover:text-zinc-100"
            title="Configure"
          >
            <Settings2 size={14} />
          </button>
          <div className="mx-1 h-3 w-px bg-white/10" />
          <button
            onClick={() => void handleDeleteServer(server)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-red-400/70 shadow-sm transition-colors hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-400"
            title="Remove"
          >
            <Trash2 size={14} />
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
        : () => handleRetryServer(server);

    return (
      <div className="flex items-center gap-1.5 sm:-translate-x-2 sm:opacity-0 sm:transition-all sm:duration-300 group-hover:translate-x-0 group-hover:opacity-100">
        {primaryLabel && (
          <button
            onClick={() => primaryAction && void primaryAction()}
            disabled={server.status === "connecting"}
            className={cn(
              "flex h-7 items-center justify-center rounded-md border px-2.5 text-[11px] font-medium shadow-sm transition-colors",
              server.status === "connecting"
                ? "cursor-not-allowed border-white/5 bg-white/5 text-zinc-500"
                : "border-white/5 bg-white/10 text-zinc-200 hover:bg-white/15"
            )}
          >
            {primaryLabel}
          </button>
        )}
        <button
          onClick={() => openEditForm(server)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-zinc-500 shadow-sm transition-colors hover:border-white/5 hover:bg-white/10 hover:text-zinc-300"
          title="Configure"
        >
          <Settings2 size={14} />
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
            {isLoading ? " Syncing runtime status..." : tools.length > 0 ? ` ${tools.length} tools available.` : ""}
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
          className={cn(
            "group flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium shadow-sm transition-all duration-200 active:scale-95",
            formOpen
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

      <AnimatePresence initial={false}>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, overflow: "hidden" }}
            animate={{ opacity: 1, height: "auto", overflow: "visible" }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden rounded-xl border border-white/10 bg-[#0f0f0f]/80"
          >
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-zinc-400" />
                <h3 className="text-[13px] font-medium text-zinc-200">Server Configuration</h3>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">JSON</span>
            </div>

            <div className="p-4">
              <textarea
                value={configText}
                onChange={(event) => setConfigText(event.target.value)}
                spellCheck={false}
                className="custom-scrollbar h-[220px] w-full resize-y rounded-lg border border-white/10 bg-black/40 p-4 font-mono text-[13px] leading-relaxed text-zinc-300 transition-all placeholder:text-zinc-700 focus:border-zinc-500 focus:bg-black/60 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-4 border-t border-white/5 bg-black/20 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <p className="text-[11px] leading-5 text-zinc-500">
                  Paste your MCP server configuration JSON snippet above.
                </p>
                <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-2">
                      <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-600">
                        Save Scope
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-3 py-2">
                          <select
                            value={draft.scope}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                scope: event.target.value as McpConfigScope,
                              }))
                            }
                            className="min-w-[176px] bg-transparent text-[12px] font-medium text-zinc-200 focus:outline-none"
                          >
                            {scopeOptions.map((scope) => (
                              <option key={scope.value} value={scope.value}>
                                {scope.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {currentProject && draft.scope === "project" && (
                          <span className="rounded-full border border-white/5 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-400">
                            {currentProject.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 text-[11px] text-zinc-500 sm:text-right">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                        Write Target
                      </div>
                      <div className="mt-1 truncate text-zinc-400" title={scopePathHint}>
                        {scopePathLabel}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                {editingServer && (
                  <button
                    onClick={() => void handleDeleteServer(editingServer)}
                    className="w-full rounded-lg border border-red-400/10 px-3 py-2 text-[13px] font-medium text-red-400/80 transition-colors hover:bg-red-400/10 hover:text-red-400 sm:w-auto"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => void handleSaveServer()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-[13px] font-medium text-zinc-900 shadow-sm transition-colors hover:bg-white sm:w-auto"
                >
                  <Save size={14} />
                  Save Configuration
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
            className="w-full rounded-xl border border-white/5 bg-black/20 py-3.5 pl-11 pr-4 text-[13px] text-zinc-200 shadow-sm transition-all placeholder:text-zinc-600 focus:border-zinc-500 focus:bg-black/40 focus:outline-none focus:ring-1 focus:ring-zinc-500/20"
          />
        </div>

        <div className="space-y-3">
          {filteredServers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-white/[0.01] p-5 text-[13px] text-zinc-500">
              {servers.length === 0
                ? "No servers configured yet. Add a local stdio server to get started."
                : "No servers matched your search."}
            </div>
          ) : (
            filteredServers.map((server) => (
              <div
                key={`${server.scope}-${server.id}`}
                className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-white/5 bg-white/[0.01] p-3 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-gradient-to-b from-zinc-800 to-zinc-900 shadow-sm">
                    {server.transportType === "stdio" ? (
                      <Terminal
                        size={16}
                        className={server.status === "connected" ? "text-zinc-300" : "text-zinc-500"}
                      />
                    ) : (
                      <Plug size={16} className="text-zinc-500" />
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0a0a0a]">
                      <div className={cn("h-1.5 w-1.5 rounded-full", statusDot(server.status))} />
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h3
                        className={cn(
                          "truncate text-[14px] font-medium leading-none",
                          server.status === "connected" ? "text-zinc-100" : "text-zinc-400"
                        )}
                      >
                        {server.name}
                      </h3>
                      <span className="rounded border border-white/5 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                        {server.transportType}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "max-w-[200px] truncate font-mono text-[11px] xl:max-w-[320px]",
                          server.status === "connected" ? "text-zinc-500" : "text-zinc-600"
                        )}
                      >
                        {server.transportSummary}
                      </div>
                      <div className="h-1 w-1 rounded-full bg-zinc-700/50" />
                      {getServerMeta(server)}
                    </div>
                  </div>
                </div>

                {renderServerActions(server)}

                {(server.error || server.unsupportedReason) && (
                  <div className="sm:basis-full sm:pl-12">
                    <div className="rounded-lg border border-red-500/10 bg-red-500/5 px-3 py-2 text-[12px] text-zinc-300">
                      {server.error || server.unsupportedReason}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("models");
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<McpServerDraft>(emptyDraft("global"));
  const [configText, setConfigText] = useState<string>(() => draftToSnippet(emptyDraft("global")));

  const llmConfigs = useConfigStore((state) => state.llmConfigs);
  const currentProvider = useConfigStore((state) => state.currentProvider);
  const setCurrentProvider = useConfigStore((state) => state.setCurrentProvider);
  const setLLMConfig = useConfigStore((state) => state.setLLMConfig);
  const apiKeys = useConfigStore((state) => state.apiKeys);
  const setApiKey = useConfigStore((state) => state.setApiKey);
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

  useEffect(() => {
    if (!initialized) {
      void initialize();
    }
  }, [initialize, initialized]);

  useEffect(() => {
    if (mcpError) {
      addToast({ type: "error", message: mcpError });
      clearError();
    }
  }, [addToast, clearError, mcpError]);

  useEffect(() => {
    if (!currentProject && draft.scope === "project") {
      setDraft((current) => ({ ...current, scope: "global" }));
    }
  }, [currentProject, draft.scope]);

  const normalizedConfigs = useMemo(
    () =>
      PROVIDERS.reduce<Record<LLMProvider, LLMConfig>>((configs, provider) => {
        const fallback = defaultLLMConfigFor(provider.id);
        const current = llmConfigs?.[provider.id];
        configs[provider.id] = {
          ...fallback,
          ...current,
          provider: provider.id,
          model: current?.model || fallback.model,
        };
        return configs;
      }, {} as Record<LLMProvider, LLMConfig>),
    [llmConfigs]
  );
  const safeProvider = PROVIDERS.some((provider) => provider.id === currentProvider)
    ? currentProvider
    : "anthropic";
  const safeApiKeys = apiKeys || {};
  const currentConfig = normalizedConfigs[safeProvider];

  useEffect(() => {
    if (safeProvider !== currentProvider) {
      setCurrentProvider(safeProvider);
    }
  }, [currentProvider, safeProvider, setCurrentProvider]);

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

  const renderContent = () => {
    switch (activeTab) {
      case "models":
        return (
          <ModelsSettings
            currentProvider={safeProvider}
            currentConfig={currentConfig}
            llmConfigs={normalizedConfigs}
            apiKeys={safeApiKeys}
            setCurrentProvider={setCurrentProvider}
            setLLMConfig={setLLMConfig}
            setApiKey={setApiKey}
          />
        );
      case "mcp":
        return (
          <MCPSettings
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
                  onClick={() => setActiveTab(item.id)}
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
