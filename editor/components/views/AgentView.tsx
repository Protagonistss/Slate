import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileCode,
  Globe,
  Layout,
  MoreVertical,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentModelSelect, ChatPanel, ToolCallDisplay } from "@/components/agent";
import { useAgent } from "@/hooks";
import {
  useAuthStore,
  useConversationStore,
  useEditorStore,
  useLLMCatalogStore,
  useMcpStore,
  useProjectStore,
  useUIStore,
} from "@/stores";
import { useConfigStore } from "@/stores/configStore";
import type { Message } from "@/services/llm/types";

function extractTextContent(message: Message | undefined): string {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;

  return message.content
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "tool_use") return `${block.name}`;
      return "";
    })
    .join(" ")
    .trim();
}

function getStepStatus(condition: "completed" | "running" | "pending") {
  return condition;
}

function AgentEmptyState({ onStart }: { onStart: (goal: string) => void }) {
  const [input, setInput] = useState("");

  const suggestions = [
    { icon: <Layout size={16} />, text: "Build a complete authentication flow with Next.js and Supabase" },
    { icon: <FileCode size={16} />, text: "Create a Kanban board application using React and Tailwind" },
    { icon: <Globe size={16} />, text: "Set up a landing page with dark mode and smooth scrolling" },
    { icon: <Terminal size={16} />, text: "Write a Python script to scrape hacker news and save to CSV" },
  ];

  return (
    <div className="w-full max-w-[640px] flex flex-col z-10 mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3 mb-6"
      >
        <div className="w-9 h-9 rounded-lg bg-charcoal border border-graphite flex items-center justify-center text-zinc-400 shrink-0 shadow-sm">
          <Bot size={18} />
        </div>
        <div className="flex flex-col">
          <h1 className="text-[14px] font-medium text-zinc-200 tracking-tight leading-tight">New Agent Session</h1>
          <p className="text-[13px] text-zinc-500 leading-tight mt-0.5">
            Describe your goal and let the agent build it for you.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex flex-col bg-charcoal border border-graphite rounded-xl shadow-sm focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600/20 transition-all mb-8"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="What do you want to build today?"
          className="w-full min-h-[120px] bg-transparent p-4 pb-0 text-[15px] text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none leading-relaxed"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && input.trim()) {
              event.preventDefault();
              onStart(input.trim());
            }
          }}
        />
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-1 text-zinc-500">
            <button className="p-2 rounded-lg hover:bg-white/5 hover:text-zinc-300 transition-colors" title="Add context">
              <Plus size={16} />
            </button>
            <button className="p-2 rounded-lg hover:bg-white/5 hover:text-zinc-300 transition-colors" title="Settings">
              <Settings size={16} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <AgentModelSelect className="mr-2" />

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 select-none mr-1">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900 font-sans">↵</kbd>
            </div>
            <button
              onClick={() => input.trim() && onStart(input.trim())}
              disabled={!input.trim()}
              className="px-3.5 py-1.5 bg-zinc-100 hover:bg-white text-zinc-900 text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Play size={14} fill="currentColor" />
              Initialize
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-2 mt-2 px-1">
          <span className="text-[11px] font-medium text-zinc-600">Suggestions</span>
          <div className="h-px flex-1 bg-zinc-800/40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {suggestions.map((item, index) => (
            <button
              key={index}
              onClick={() => onStart(item.text)}
              className="text-left px-2.5 py-2 rounded-lg border border-transparent hover:border-zinc-800/60 bg-transparent hover:bg-zinc-800/20 transition-all text-[12px] text-zinc-500 hover:text-zinc-300 flex items-center gap-2.5 group"
            >
              <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 scale-[0.85]">
                {item.icon}
              </div>
              <span className="truncate">{item.text}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export function AgentView() {
  const navigate = useNavigate();
  const { currentProject } = useProjectStore();
  const { servers, tools } = useMcpStore();
  const addToast = useUIStore((state) => state.addToast);
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentProvider = useConfigStore((state) => state.currentProvider);
  const llmConfigs = useConfigStore((state) => state.llmConfigs);
  const syncLLMProviders = useConfigStore((state) => state.syncLLMProviders);
  const catalogProviders = useLLMCatalogStore((state) => state.providers);
  const catalogLoading = useLLMCatalogStore((state) => state.isLoading);
  const catalogError = useLLMCatalogStore((state) => state.error);
  const initializeCatalog = useLLMCatalogStore((state) => state.initialize);
  const clearCatalog = useLLMCatalogStore((state) => state.clear);
  const { status, isProcessing, currentToolCalls, sendMessage, stopGeneration, reset, error, clearError } =
    useAgent();
  const activeFile = useEditorStore((state) =>
    state.activeFilePath
      ? state.openFiles.find((item) => item.path === state.activeFilePath) || null
      : null
  );
  const createConversation = useConversationStore((state) => state.createConversation);
  const conversation = useConversationStore((state) =>
    state.currentConversationId
      ? state.conversations.find((item) => item.id === state.currentConversationId) || null
      : null
  );

  const visibleMessages = useMemo(
    () => (conversation?.messages || []).filter((message) => message.role !== "system"),
    [conversation?.messages]
  );
  const latestUserMessage = useMemo(
    () => [...visibleMessages].reverse().find((message) => message.role === "user"),
    [visibleMessages]
  );
  const latestAssistantMessage = useMemo(
    () => [...visibleMessages].reverse().find((message) => message.role === "assistant"),
    [visibleMessages]
  );
  const [goalDraft, setGoalDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const configuredProviders = useMemo(
    () => catalogProviders.filter((provider) => provider.configured && provider.models.length > 0),
    [catalogProviders]
  );
  const currentLLMConfig = currentProvider ? llmConfigs[currentProvider] : null;
  const providerReady =
    Boolean(accessToken) &&
    Boolean(currentProvider) &&
    Boolean(currentLLMConfig?.model) &&
    configuredProviders.some(
      (provider) => provider.name === currentProvider && provider.models.includes(currentLLMConfig.model)
    );

  useEffect(() => {
    const text = extractTextContent(latestUserMessage);
    if (text) {
      setGoalDraft(text);
    }
  }, [latestUserMessage]);

  useEffect(() => {
    if (accessToken) {
      void initializeCatalog();
    } else {
      clearCatalog();
    }
  }, [accessToken, clearCatalog, initializeCatalog]);

  useEffect(() => {
    if (catalogProviders.length > 0) {
      syncLLMProviders(catalogProviders);
    }
  }, [catalogProviders, syncLLMProviders]);

  const hasSession = visibleMessages.length > 0;
  const connectedServers = servers.filter((server) => server.status === "connected").length;
  const latestToolCall = currentToolCalls[currentToolCalls.length - 1] || null;
  const artifactTitle = activeFile?.name || latestToolCall?.name || currentProject?.name || "Agent Session";
  const artifactStatusLabel = isProcessing ? "Live" : "Idle";
  const decisionMessage =
    status === "tool_call"
      ? "AI is executing tools to continue the task..."
      : isProcessing
      ? "AI is working on the current task..."
      : latestAssistantMessage
      ? "AI is waiting for your approval..."
      : "Agent is ready for the next instruction.";

  useEffect(() => {
    if (error && !hasSession) {
      addToast({ type: "error", message: error });
      clearError();
    }
  }, [addToast, clearError, error, hasSession]);

  const steps = [
    {
      id: 1,
      label: "Workspace context ready",
      status: getStepStatus(currentProject ? "completed" : "pending"),
      result: currentProject
        ? `Working in ${currentProject.name}`
        : "Open a project to give the agent file and workspace context.",
    },
    {
      id: 2,
      label: "MCP runtime connected",
      status: getStepStatus(
        connectedServers > 0 ? "completed" : servers.length > 0 ? "running" : "pending"
      ),
      result:
        connectedServers > 0
          ? `${connectedServers} servers online, ${tools.length} tools registered.`
          : servers.length > 0
          ? "Servers are configured but not all are connected."
          : "No MCP server configured yet.",
    },
    {
      id: 3,
      label: "Agent execution status",
      status: getStepStatus(
        status === "thinking" || status === "streaming" || status === "tool_call"
          ? "running"
          : hasSession
          ? "completed"
          : "pending"
      ),
      result:
        status === "thinking"
          ? "Model is reasoning about the next action."
          : status === "streaming"
          ? "Assistant response is streaming."
          : status === "tool_call"
          ? "Agent is executing one or more tools."
          : hasSession
          ? "Last run completed. You can refine the goal and continue."
          : "Session not started yet.",
    },
    {
      id: 4,
      label: "Tool calls captured",
      status: getStepStatus(currentToolCalls.length > 0 ? "completed" : "pending"),
      result:
        currentToolCalls.length > 0
          ? `${currentToolCalls.length} tool calls recorded in this run.`
          : "No tool activity has happened in the current session yet.",
    },
  ];

  const ensureAgentReady = () => {
    if (!accessToken) {
      addToast({
        type: "error",
        message: "请先登录 backend 账号",
      });
      return false;
    }

    if (catalogLoading && configuredProviders.length === 0) {
      addToast({
        type: "info",
        message: "模型目录加载中，请稍后再试。",
      });
      return false;
    }

    if (catalogError && configuredProviders.length === 0) {
      addToast({
        type: "error",
        message: catalogError,
      });
      return false;
    }

    if (!providerReady) {
      addToast({
        type: "error",
        message: "当前没有可用模型，请先在 Settings > AI Models 选择可用模型。",
      });
      return false;
    }

    return true;
  };

  const handleStart = async (goal: string) => {
    const nextGoal = goal.trim();
    if (!nextGoal) {
      return;
    }

    if (!ensureAgentReady()) {
      return;
    }

    setGoalDraft(nextGoal);
    setMessageDraft("");
    await sendMessage(nextGoal);
  };

  const handleRunGoal = async () => {
    if (!goalDraft.trim() || isProcessing) return;
    if (!ensureAgentReady()) {
      return;
    }
    await sendMessage(goalDraft.trim());
  };

  const handleSendMessage = async () => {
    const nextMessage = messageDraft.trim();
    if (!nextMessage || isProcessing) {
      return;
    }

    if (!ensureAgentReady()) {
      return;
    }

    setMessageDraft("");
    setGoalDraft(nextMessage);
    await sendMessage(nextMessage);
  };

  const handleNewSession = () => {
    createConversation();
    reset();
    setGoalDraft("");
    setMessageDraft("");
  };

  const handleEditCode = () => {
    navigate("/editor");
  };

  const handleApproveAndContinue = async () => {
    if (!goalDraft.trim() || isProcessing) {
      return;
    }
    await handleRunGoal();
  };

  if (!hasSession) {
    return (
      <div className="flex-1 h-full flex flex-col p-6 lg:p-10 w-full max-w-6xl mx-auto space-y-10 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 justify-center pb-32">
        <AgentEmptyState onStart={handleStart} />
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col p-6 lg:p-10 w-full max-w-6xl mx-auto space-y-10 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-zinc-400">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Active Agent Task</h2>
              <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Autonomous Implementation</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={isProcessing ? stopGeneration : handleRunGoal}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                isProcessing
                  ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  : "bg-zinc-100 text-zinc-900 hover:bg-white"
              )}
            >
              {isProcessing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              <span>{isProcessing ? "Pause Session" : "Resume Session"}</span>
            </button>
            <button
              onClick={handleNewSession}
              className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
              title="Start a new session"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-charcoal border border-graphite relative group">
          <textarea
            className="w-full bg-transparent border-none focus:outline-none text-[15px] text-zinc-300 placeholder-zinc-600 resize-none font-normal leading-[1.6] h-16"
            value={goalDraft}
            onChange={(event) => setGoalDraft(event.target.value)}
            placeholder="Describe what you want the agent to achieve..."
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && goalDraft.trim()) {
                event.preventDefault();
                void handleRunGoal();
              }
            }}
          />
          <div className="absolute bottom-3 right-4 flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
            <kbd className="px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900">⌘</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900">ENTER</kbd>
            <span className="ml-2">to update goal</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start pb-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Execution Steps</h3>
            <span className="text-[10px] font-bold text-zinc-600">
              {steps.filter((step) => step.status === "completed").length} / {steps.length} COMPLETE
            </span>
          </div>

          <div className="space-y-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "p-3.5 rounded-xl transition-all duration-300 group",
                  step.status === "completed"
                    ? "bg-white/[0.02] border border-white/[0.05]"
                    : step.status === "running"
                    ? "bg-white/[0.04] border border-white/[0.08]"
                    : "bg-transparent border border-transparent opacity-50"
                )}
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5">
                    {step.status === "completed" ? (
                      <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 border border-zinc-700">
                        <CheckCircle2 size={10} />
                      </div>
                    ) : step.status === "running" ? (
                      <div className="w-4 h-4 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-900 border border-white ai-pulse">
                        <Circle size={8} fill="currentColor" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-700">
                        <Circle size={8} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <h4
                      className={cn(
                        "text-[13px] font-medium transition-colors",
                        step.status === "completed"
                          ? "text-zinc-300"
                          : step.status === "running"
                          ? "text-zinc-100"
                          : "text-zinc-500"
                      )}
                    >
                      {step.label}
                    </h4>
                    <p className="text-[12px] text-zinc-500 leading-relaxed">{step.result}</p>
                  </div>
                  <button className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300">
                    <MoreVertical size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Artifacts</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handleEditCode}
                className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest hover:text-zinc-200 transition-colors"
              >
                <ExternalLink size={10} />
                Preview URL
              </button>
            </div>
          </div>

          <div className="h-[500px] flex flex-col overflow-hidden rounded-xl border border-graphite bg-charcoal shadow-sm">
            <div className="h-10 border-b border-graphite bg-obsidian/50 flex items-center justify-between px-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-300 uppercase tracking-widest min-w-0">
                  <FileCode size={12} className="text-zinc-500 shrink-0" />
                  <span className="truncate">{artifactTitle}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  <Terminal size={12} />
                  <span>Agent Conversation</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", isProcessing ? "bg-zinc-400 ai-pulse" : "bg-zinc-500")} />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{artifactStatusLabel}</span>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <ChatPanel
                messages={visibleMessages}
                inputValue={messageDraft}
                isProcessing={isProcessing}
                error={error}
                onInputChange={setMessageDraft}
                onSubmit={handleSendMessage}
                onStop={stopGeneration}
                onClearError={clearError}
              />
            </div>

            <div className="p-3 border-t border-graphite bg-charcoal flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                <AlertCircle size={14} className="text-zinc-500" />
                <span>{decisionMessage}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleEditCode}
                  className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all"
                >
                  Edit Code
                </button>
                <button
                  onClick={() => void handleApproveAndContinue()}
                  disabled={isProcessing || !goalDraft.trim()}
                  className="px-4 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 text-xs font-semibold hover:bg-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Approve & Continue
                </button>
              </div>
            </div>
          </div>

          {currentToolCalls.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tool Calls</h3>
                <span className="text-[10px] font-bold text-zinc-600">{currentToolCalls.length} RECORDED</span>
              </div>
              <div className="space-y-3">
                {currentToolCalls.map((toolCall) => (
                  <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
