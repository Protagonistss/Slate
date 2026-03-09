import { motion } from "motion/react";
import { Cpu, Plug, Server, Key, Save, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/configStore";
import type { LLMProvider } from "@/services/llm/types";

const providers: { id: LLMProvider; name: string; models: string[] }[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      "claude-sonnet-4-6-20250514",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229"
    ]
  },
  {
    id: "openai",
    name: "OpenAI",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-3.5-turbo"
    ]
  },
  {
    id: "ollama",
    name: "Ollama",
    models: [
      "llama3.2",
      "qwen2.5",
      "mistral",
      "codellama"
    ]
  }
];

interface MCPServer {
  id: string;
  name: string;
  type: "stdio" | "sse";
  command: string;
  status: "active" | "inactive";
}

const mockMCPServers: MCPServer[] = [
  {
    id: "1",
    name: "Local Filesystem",
    type: "stdio",
    command: "/usr/local/bin/mcp-fs",
    status: "active"
  },
  {
    id: "2",
    name: "GitHub MCP",
    type: "stdio",
    command: "npx @github/mcp",
    status: "inactive"
  }
];

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<"models" | "mcp">("models");
  const [isSaved, setIsSaved] = useState(false);

  const {
    llmConfigs,
    currentProvider,
    setCurrentProvider,
    setLLMConfig,
    apiKeys,
    setApiKey
  } = useConfigStore();

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const currentConfig = llmConfigs[currentProvider];

  return (
    <div className="flex-1 h-full flex flex-col items-center p-6 overflow-y-auto w-full">
      <div className="max-w-[720px] w-full pt-12 space-y-10 pb-24">
        {/* Header */}
        <div className="space-y-2">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-[28px] font-medium tracking-tight text-zinc-100"
          >
            Settings
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-[14px] text-zinc-500"
          >
            Configure your AI models and manage Model Context Protocol connections.
          </motion.p>
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex items-center gap-1 border-b border-graphite pb-4"
        >
          <button
            onClick={() => setActiveTab("models")}
            className={cn(
              "px-3 py-1.5 text-[14px] font-medium rounded-md transition-colors flex items-center gap-2",
              activeTab === "models"
                ? "bg-white/10 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            )}
          >
            <Cpu size={16} />
            AI Models
          </button>
          <button
            onClick={() => setActiveTab("mcp")}
            className={cn(
              "px-3 py-1.5 text-[14px] font-medium rounded-md transition-colors flex items-center gap-2",
              activeTab === "mcp"
                ? "bg-white/10 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            )}
          >
            <Plug size={16} />
            MCP Servers
          </button>
        </motion.div>

        {/* Content Area */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          {activeTab === "models" && (
            <div className="space-y-8">
              <section className="space-y-4">
                <h3 className="text-[14px] font-medium text-zinc-300">Provider Selection</h3>

                <div className="grid gap-4">
                  {providers.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => setCurrentProvider(provider.id)}
                      className={cn(
                        "slate-panel p-4 rounded-xl space-y-3 text-left transition-all",
                        currentProvider === provider.id
                          ? "border-l-2 border-l-zinc-400"
                          : "border-l-2 border-l-transparent opacity-70 hover:opacity-100"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-medium text-zinc-200">
                          {provider.name}
                        </span>
                        {currentProvider === provider.id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-300 font-medium">
                            Active
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[14px] font-medium text-zinc-300">Model Configuration</h3>

                <div className="slate-panel p-4 rounded-xl space-y-3">
                  <label className="text-[13px] text-zinc-500">
                    Model
                  </label>
                  <select
                    value={currentConfig.model}
                    onChange={(e) => setLLMConfig(currentProvider, { model: e.target.value })}
                    className="w-full bg-black/40 border border-graphite rounded-lg px-3 py-2 text-[14px] text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors appearance-none cursor-pointer"
                  >
                    {providers.find((p) => p.id === currentProvider)?.models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="slate-panel p-4 rounded-xl space-y-3">
                  <label className="text-[13px] text-zinc-500 flex justify-between">
                    <span>Temperature</span>
                    <span className="text-zinc-600">{currentConfig.temperature}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={currentConfig.temperature ?? 0.7}
                    onChange={(e) => setLLMConfig(currentProvider, { temperature: parseFloat(e.target.value) })}
                    className="w-full accent-zinc-400"
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[14px] font-medium text-zinc-300">API Keys</h3>
                <div className="slate-panel p-4 rounded-xl space-y-4">
                  {providers.map((provider) => (
                    <div key={provider.id} className="space-y-2">
                      <label className="text-[13px] text-zinc-500 flex items-center gap-2">
                        <Key size={14} /> {provider.name} API Key
                      </label>
                      <input
                        type="password"
                        value={apiKeys[provider.id] || ""}
                        onChange={(e) => setApiKey(provider.id, e.target.value)}
                        placeholder={provider.id === "anthropic" ? "sk-ant-..." : provider.id === "openai" ? "sk-proj-..." : "Not required"}
                        className="w-full bg-black/40 border border-graphite rounded-lg px-3 py-2 text-[14px] text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-zinc-700"
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === "mcp" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-medium text-zinc-300">Connected Servers</h3>
                <button className="text-[13px] text-zinc-400 hover:text-zinc-200 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md transition-colors">
                  Add Server
                </button>
              </div>

              <div className="grid gap-4">
                {mockMCPServers.map((server) => (
                  <div
                    key={server.id}
                    className={cn(
                      "slate-panel p-4 rounded-xl border-l-2 flex items-start justify-between group",
                      server.status === "active"
                        ? "border-l-emerald-500/50"
                        : "border-l-zinc-700"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Server size={16} className="text-zinc-400" />
                        <span
                          className={cn(
                            "text-[14px] font-medium",
                            server.status === "active"
                              ? "text-zinc-200"
                              : "text-zinc-400"
                          )}
                        >
                          {server.name}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            server.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-zinc-800 text-zinc-500"
                          )}
                        >
                          {server.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className={cn(
                        "text-[13px] pl-6",
                        server.status === "active"
                          ? "text-zinc-500"
                          : "text-zinc-600"
                      )}>
                        {server.type} • {server.command}
                      </p>
                    </div>
                    <button
                      className={cn(
                        "text-[13px] opacity-0 group-hover:opacity-100 transition-opacity",
                        server.status === "active"
                          ? "text-red-400 hover:text-red-300"
                          : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      {server.status === "active" ? "Disconnect" : "Connect"}
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-3 items-start">
                <div className="mt-0.5 w-2 h-2 rounded-full bg-blue-500/50" />
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  Model Context Protocol (MCP) allows your agents to safely interact with external tools and data sources. Ensure you only connect to trusted servers.
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Global Action */}
        <div className="pt-8 border-t border-graphite flex justify-end">
          <button
            onClick={handleSave}
            className={cn(
              "px-4 py-2 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-all",
              isSaved
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-white/10 text-zinc-200 hover:bg-white/20"
            )}
          >
            {isSaved ? (
              <>
                <CheckCircle2 size={16} />
                Saved
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
