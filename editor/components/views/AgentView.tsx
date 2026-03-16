import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Circle,
  CornerLeftUp,
  ExternalLink,
  FileCode,
  GitBranch,
  Globe,
  History,
  Layout,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentModelSelect } from "@/components/agent";
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

type StepStatus = "completed" | "running" | "pending" | "blocked";

interface AgentStep {
  id: number;
  label: string;
  status: StepStatus;
  result: string;
}

function extractTextContent(message: Message | undefined): string {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;

  return message.content
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "tool_use") return `Tool ${block.name}`;
      if (block.type === "tool_result") return block.content;
      return "";
    })
    .join(" ")
    .trim();
}

function truncateText(value: string, maxLength: number): string {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function toPreviewLines(content: string, maxLines = 18): string[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return ["Waiting for output..."];
  return normalized.split("\n").slice(0, maxLines);
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "completed") {
    return (
      <div className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400">
        <CheckCircle2 size={10} />
      </div>
    );
  }

  if (status === "running") {
    return (
      <div className="flex h-4 w-4 items-center justify-center rounded-full border border-white bg-zinc-200 text-zinc-900 ai-pulse">
        <Circle size={8} fill="currentColor" />
      </div>
    );
  }

  if (status === "blocked") {
    return (
      <div className="flex h-4 w-4 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
        <AlertCircle size={10} />
      </div>
    );
  }

  return (
    <div className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-700 text-zinc-700">
      <Circle size={8} />
    </div>
  );
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
    <div className="mx-auto flex w-full max-w-[640px] flex-col">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-graphite bg-charcoal text-zinc-400">
          <Bot size={18} />
        </div>
        <div>
          <h1 className="text-[14px] font-medium tracking-tight text-zinc-200">New Agent Session</h1>
          <p className="text-[13px] text-zinc-500">Describe your goal and let the agent build it for you.</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8 rounded-xl border border-graphite bg-charcoal"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="What do you want to build today?"
          className="min-h-[120px] w-full resize-none bg-transparent p-4 pb-0 text-[15px] text-zinc-200 placeholder-zinc-600 focus:outline-none"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && input.trim()) {
              event.preventDefault();
              onStart(input.trim());
            }
          }}
        />
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-1 text-zinc-500">
            <button className="rounded-lg p-2 hover:bg-white/5 hover:text-zinc-300">
              <Plus size={16} />
            </button>
            <button className="rounded-lg p-2 hover:bg-white/5 hover:text-zinc-300">
              <Settings size={16} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <AgentModelSelect className="mr-2" />
            <button
              onClick={() => input.trim() && onStart(input.trim())}
              disabled={!input.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 py-1.5 text-[13px] font-semibold text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={14} fill="currentColor" />
              Initialize
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <div className="mb-2 mt-2 flex items-center gap-3 px-1">
          <span className="text-[11px] font-medium text-zinc-600">Suggestions</span>
          <div className="h-px flex-1 bg-zinc-800/40" />
        </div>
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {suggestions.map((item, index) => (
            <button
              key={index}
              onClick={() => onStart(item.text)}
              className="group flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left text-[12px] text-zinc-500 transition-all hover:border-zinc-800/60 hover:bg-zinc-800/20 hover:text-zinc-300"
            >
              <div className="scale-[0.85] text-zinc-600 group-hover:text-zinc-400">{item.icon}</div>
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
  const goalInputRef = useRef<HTMLTextAreaElement | null>(null);
  const { currentProject, openProject } = useProjectStore();
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
  const createConversation = useConversationStore((state) => state.createConversation);
  const conversation = useConversationStore((state) =>
    state.currentConversationId
      ? state.conversations.find((item) => item.id === state.currentConversationId) || null
      : null
  );
  const activeFile = useEditorStore((state) =>
    state.activeFilePath ? state.openFiles.find((item) => item.path === state.activeFilePath) || null : null
  );
  const {
    status,
    isProcessing,
    currentStreamContent,
    currentToolCalls,
    sendMessage,
    stopGeneration,
    reset,
    error,
  } = useAgent();

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
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(true);
  const [expandedArtifact, setExpandedArtifact] = useState<string | null>(activeFile?.path || "agent/output.md");

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
    if (text) setGoalDraft(text);
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

  useEffect(() => {
    const node = goalInputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 220)}px`;
  }, [goalDraft]);

  useEffect(() => {
    if (activeFile?.path) {
      setExpandedArtifact(activeFile.path);
    }
  }, [activeFile?.path]);

  const hasSession = visibleMessages.length > 0;
  const connectedServers = servers.filter((server) => server.status === "connected").length;
  const assistantSummary = truncateText(extractTextContent(latestAssistantMessage), 180);
  const latestToolCall = currentToolCalls[currentToolCalls.length - 1] || null;
  const artifactTitle = activeFile?.name || conversation?.title || latestToolCall?.name || currentProject?.name || "Agent Session";
  const activeModelLabel =
    providerReady && currentProvider && currentLLMConfig?.model
      ? `${currentProvider} · ${currentLLMConfig.model}`
      : accessToken
      ? "No model"
      : "Sign in";

  const ensureAgentReady = () => {
    if (!accessToken) {
      addToast({ type: "error", message: "请先登录 backend 账号" });
      return false;
    }
    if (catalogLoading && configuredProviders.length === 0) {
      addToast({ type: "info", message: "模型目录加载中，请稍后再试。" });
      return false;
    }
    if (catalogError && configuredProviders.length === 0) {
      addToast({ type: "error", message: catalogError });
      return false;
    }
    if (!providerReady) {
      addToast({ type: "error", message: "当前没有可用模型，请先在 Settings > AI Models 选择可用模型。" });
      return false;
    }
    return true;
  };

  const handleRun = async (content: string) => {
    const next = content.trim();
    if (!next || isProcessing || !ensureAgentReady()) return;
    setGoalDraft(next);
    await sendMessage(next);
  };

  const handleNewSession = () => {
    if (isProcessing) return;
    createConversation();
    reset();
    setGoalDraft("");
  };

  const handleRefineStep = (step: AgentStep) => {
    const prefix = `@Step ${step.id} (${step.label}): `;
    const nextGoal = goalDraft.trim() ? `${goalDraft.trim()}\n\n${prefix}` : prefix;
    setGoalDraft(nextGoal);
    window.requestAnimationFrame(() => {
      const node = goalInputRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(nextGoal.length, nextGoal.length);
    });
  };

  const steps = useMemo<AgentStep[]>(() => [
    {
      id: 1,
      label: "Workspace context ready",
      status: currentProject ? "completed" : "pending",
      result: currentProject ? `Working in ${currentProject.name}` : "Open a project to give the agent workspace context.",
    },
    {
      id: 2,
      label: "Execution model ready",
      status: providerReady ? "completed" : accessToken ? "blocked" : "pending",
      result: providerReady ? `Using ${activeModelLabel}` : !accessToken ? "Backend account not signed in." : catalogError || "No available model selected yet.",
    },
    {
      id: 3,
      label: "Agent execution status",
      status: error ? "blocked" : isProcessing ? "running" : hasSession ? "completed" : "pending",
      result: error || (isProcessing ? "Agent is working on the current task." : hasSession ? "Last run completed." : "Session not started yet."),
    },
    {
      id: 4,
      label: "Tool calls captured",
      status: status === "tool_call" ? "running" : currentToolCalls.length > 0 ? "completed" : "pending",
      result: currentToolCalls.length > 0
        ? `${currentToolCalls.length} tool calls recorded in this run.`
        : connectedServers > 0
        ? `${connectedServers} MCP servers online, ${tools.length} tools available.`
        : "No tool activity in the current session yet.",
    },
  ], [accessToken, activeModelLabel, catalogError, connectedServers, currentProject, currentToolCalls.length, error, hasSession, isProcessing, providerReady, status, tools.length]);

  const reasoningEntries = [
    currentProject ? `Workspace anchored to ${currentProject.name}.` : "No workspace attached yet.",
    providerReady ? `Using ${activeModelLabel}.` : !accessToken ? "Backend account is not signed in." : catalogError || "A working model still needs to be selected.",
    connectedServers > 0 ? `${connectedServers} MCP servers connected with ${tools.length} registered tools.` : "No MCP server connected yet.",
    status === "tool_call" && latestToolCall
      ? `Executing ${latestToolCall.name} with ${Object.keys(latestToolCall.input).length} input fields.`
      : currentToolCalls.length > 0
      ? `${currentToolCalls.length} tool calls have been captured in this run.`
      : assistantSummary || "Waiting for the next instruction.",
    currentStreamContent.trim() || assistantSummary || "Ready for the next instruction.",
  ].filter(Boolean);

  const artifactStatusLabel = error ? "Blocked" : isProcessing ? "Generating" : hasSession ? "Ready" : "Idle";
  const decisionMessage = error
    ? error
    : status === "tool_call"
    ? "AI is executing tools to continue the task..."
    : isProcessing
    ? "AI is working on the current task..."
    : latestAssistantMessage
    ? "AI is waiting for your approval or next instruction."
    : "Agent is ready for the next instruction.";

  const completedSteps = steps.filter((step) => step.status === "completed");
  const pendingStep = steps.find((step) => step.status === "pending") || steps.find((step) => step.status === "blocked") || null;
  const successfulTool = [...currentToolCalls].reverse().find((toolCall) => toolCall.status === "success") || null;
  const mainArtifactPath = activeFile?.path || "agent/output.md";
  const mainArtifactContent = activeFile?.content || currentStreamContent || assistantSummary || decisionMessage;
  const artifactSections = [
    {
      id: "completed",
      path: successfulTool ? `agent/tools/${successfulTool.name}.json` : "agent/plan.md",
      state: "completed" as const,
      added: successfulTool ? Object.keys(successfulTool.input).length + 1 : completedSteps.length,
      removed: successfulTool?.status === "error" ? 1 : 0,
      preview: successfulTool
        ? JSON.stringify(
            {
              input: successfulTool.input,
              result: successfulTool.result ?? successfulTool.status,
            },
            null,
            2
          )
        : completedSteps.map((step) => `- ${step.label}: ${step.result}`).join("\n"),
    },
    {
      id: "active",
      path: mainArtifactPath,
      state: isProcessing ? "active" as const : "completed" as const,
      added: Math.max(1, toPreviewLines(mainArtifactContent, 30).length),
      removed: 0,
      preview: mainArtifactContent,
    },
    {
      id: "pending",
      path: pendingStep ? `agent/next/${pendingStep.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md` : "agent/review.md",
      state: "pending" as const,
      added: 0,
      removed: 0,
      preview: pendingStep?.result || decisionMessage,
    },
  ];

  if (!hasSession) {
    return (
      <div className="mx-auto flex h-full w-full max-w-6xl flex-1 flex-col justify-center space-y-10 overflow-y-auto p-6 pb-32 scrollbar-thin scrollbar-thumb-zinc-800 lg:p-10">
        <AgentEmptyState onStart={handleRun} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-1 flex-col space-y-6 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800 lg:p-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700/50 bg-zinc-800/50 text-zinc-400">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Active Agent Task</h2>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Autonomous Implementation</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={isProcessing ? stopGeneration : () => void handleRun(goalDraft)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                isProcessing ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-900 hover:bg-white"
              )}
            >
              {isProcessing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              <span>{isProcessing ? "Pause Session" : "Resume Session"}</span>
            </button>
            <button
              onClick={handleNewSession}
              disabled={isProcessing}
              className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition-all hover:bg-zinc-800 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-graphite bg-charcoal shadow-lg">
          <textarea
            ref={goalInputRef}
            value={goalDraft}
            onChange={(event) => setGoalDraft(event.target.value)}
            placeholder="Describe what you want the agent to achieve..."
            className="min-h-[28px] w-full resize-none bg-transparent px-4 pt-4 pb-0 text-[14px] leading-[1.6] text-zinc-300 placeholder-zinc-600 focus:outline-none"
            rows={1}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && goalDraft.trim()) {
                event.preventDefault();
                void handleRun(goalDraft);
              }
            }}
          />
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-1 pl-1 text-zinc-500">
              <button className="rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-300"><Plus size={15} /></button>
              <button onClick={() => navigate("/settings?tab=models")} className="rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-300"><Settings size={15} /></button>
            </div>
            <div className="flex items-center gap-3">
              <AgentModelSelect className="mr-2" disabled={isProcessing} />
              <div className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:flex">
                <span>Press</span>
                <kbd className="flex items-center justify-center rounded border border-zinc-700 bg-zinc-800/50 px-1.5 py-0.5"><CornerLeftUp size={10} className="rotate-90" /></kbd>
              </div>
              <button
                onClick={() => void handleRun(goalDraft)}
                disabled={!goalDraft.trim() || isProcessing}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
                  goalDraft.trim() && !isProcessing ? "bg-zinc-300 text-zinc-900 hover:bg-white" : "cursor-not-allowed bg-zinc-800 text-zinc-500"
                )}
              >
                <Play size={12} fill="currentColor" />
                Update Goal
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 pb-10 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Execution Steps</h3>
            <span className="text-[10px] font-bold text-zinc-600">{steps.filter((step) => step.status === "completed").length} / {steps.length} COMPLETE</span>
          </div>
          <div className="space-y-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "group rounded-xl p-3.5 transition-all",
                  step.status === "completed" ? "border border-white/[0.05] bg-white/[0.02]" :
                  step.status === "running" ? "border border-white/[0.08] bg-white/[0.04]" :
                  step.status === "blocked" ? "border border-red-500/15 bg-red-500/[0.04]" :
                  "border border-transparent bg-transparent opacity-70"
                )}
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5"><StepIcon status={step.status} /></div>
                  <div className="flex-1 space-y-1.5">
                    <h4 className={cn("text-[13px] font-medium", step.status === "running" ? "text-zinc-100" : step.status === "blocked" ? "text-red-300" : step.status === "completed" ? "text-zinc-300" : "text-zinc-500")}>{step.label}</h4>
                    <p className="text-[12px] leading-relaxed text-zinc-500">{step.result}</p>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => handleRefineStep(step)} className="rounded border border-zinc-800 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:border-zinc-700 hover:text-zinc-300">Refine</button>
                    {step.status === "running" && (
                      <button onClick={stopGeneration} className="rounded bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-300 hover:bg-red-500/25">Stop</button>
                    )}
                    {step.id === 1 && !currentProject && (
                      <button onClick={() => void openProject()} className="rounded bg-zinc-800/80 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-300 hover:bg-zinc-700">Open</button>
                    )}
                    {step.id === 2 && !providerReady && (
                      <button onClick={() => navigate(accessToken ? "/settings?tab=models" : "/settings?tab=account")} className="rounded bg-zinc-800/80 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-300 hover:bg-zinc-700">Fix</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Live Artifacts</h3>
            <button onClick={() => navigate("/editor")} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-200">
              <ExternalLink size={10} />
              Open Editor
            </button>
          </div>

          <div className="flex h-[620px] flex-col overflow-hidden rounded-xl border border-graphite bg-obsidian shadow-2xl shadow-black/40">
            <div className="border-b border-graphite bg-[#141414]">
              <div onClick={() => setIsReasoningExpanded((value) => !value)} className="group flex cursor-pointer items-center gap-2 px-4 py-2.5 text-[11px] font-medium text-zinc-400 hover:bg-white/[0.02] hover:text-zinc-300">
                {isProcessing ? <Loader2 size={12} className="animate-spin text-zinc-500" /> : error ? <AlertCircle size={12} className="text-red-400" /> : <Bot size={12} className="text-zinc-500" />}
                <span>Agent Reasoning</span>
                <div className={cn("ml-3 flex flex-1 items-center gap-2 overflow-hidden rounded border border-zinc-800/50 bg-black/40 px-3 py-0.5 transition-opacity", isReasoningExpanded ? "pointer-events-none opacity-0" : "opacity-100")}>
                  <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-zinc-500" /></span>
                  <span className="truncate font-mono text-[10px] text-zinc-500">{truncateText(reasoningEntries[reasoningEntries.length - 1] || "Waiting for instructions.", 84)}</span>
                </div>
                <span className="ml-2 font-mono text-[10px] text-zinc-600">{artifactStatusLabel}</span>
                <ChevronDown size={12} className={cn("transition-transform", isReasoningExpanded ? "rotate-180" : "rotate-0")} />
              </div>
              <AnimatePresence initial={false}>
                {isReasoningExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <div className="max-h-[170px] overflow-y-auto px-4 pb-4 pt-1 font-mono text-[12px] leading-relaxed text-zinc-400 scrollbar-thin scrollbar-thumb-zinc-800">
                      <div className="space-y-3 py-1">
                        {reasoningEntries.map((entry, index) => <p key={`${index}-${entry.slice(0, 16)}`}>{entry}</p>)}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex h-10 items-center justify-between border-b border-graphite bg-charcoal px-4">
              <div className="flex items-center gap-3 text-[11px] font-medium text-zinc-500">
                <span className="font-semibold uppercase tracking-wide text-zinc-500">Execution Plan</span>
                <div className="h-3.5 w-px bg-zinc-800" />
                <span>{steps.filter((step) => step.status === "completed").length} completed</span>
                <span>{steps.filter((step) => step.status === "running").length} running</span>
                <span>{steps.filter((step) => step.status === "pending").length} pending</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-md border border-graphite bg-zinc-900 p-0.5">
                  <button className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-bold text-zinc-500"><History size={10} />Session</button>
                  <div className="mx-0.5 h-3 w-px bg-zinc-800" />
                  <button className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-100"><GitBranch size={10} className="text-zinc-400" />{truncateText(artifactTitle, 20)}</button>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-1">
                  <div className={cn("h-1.5 w-1.5 rounded-full", isProcessing ? "animate-pulse bg-zinc-400" : error ? "bg-red-400" : "bg-zinc-500")} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{artifactStatusLabel}</span>
                </div>
              </div>
            </div>

            <div className="flex h-10 items-center justify-between border-b border-graphite bg-obsidian/60 px-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                  <FileCode size={12} className="text-zinc-500" />
                  <span className="truncate">{artifactTitle}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                  <Terminal size={12} />
                  <span>{truncateText(activeModelLabel, 28)}</span>
                </div>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden bg-obsidian">
              <div className="flex h-full flex-col overflow-y-auto bg-obsidian font-mono text-[13px] leading-relaxed text-zinc-300 scrollbar-thin scrollbar-thumb-zinc-800">
                <div className="flex flex-col pb-32">
                  {artifactSections.map((section) => {
                    const isExpanded = (expandedArtifact || mainArtifactPath) === section.path;
                    const previewLines = toPreviewLines(section.preview, section.state === "active" ? 22 : 8);

                    return (
                      <div key={section.id} className="flex flex-col border-b border-graphite">
                        <div
                          onClick={() => setExpandedArtifact(isExpanded ? null : section.path)}
                          className={cn(
                            "flex cursor-pointer select-none items-center gap-3 px-4 py-2.5 transition-colors",
                            section.state === "active"
                              ? "border-l-2 border-zinc-400 bg-white/[0.03]"
                              : section.state === "completed"
                              ? "bg-charcoal hover:bg-zinc-800/50"
                              : "bg-charcoal text-zinc-600 opacity-70 hover:bg-zinc-800/30"
                          )}
                        >
                          <div className="flex w-4 justify-center">
                            <div
                              className={cn(
                                "rounded-full",
                                section.state === "active"
                                  ? "h-1.5 w-1.5 animate-pulse bg-zinc-400 shadow-[0_0_8px_rgba(161,161,170,0.3)]"
                                  : section.state === "completed"
                                  ? "h-1.5 w-1.5 bg-zinc-600"
                                  : "h-1 w-1 bg-zinc-700"
                              )}
                            />
                          </div>
                          <span
                            className={cn(
                              "text-[12px] transition-colors",
                              section.state === "active"
                                ? "text-zinc-200"
                                : section.state === "completed"
                                ? "text-zinc-500 hover:text-zinc-400"
                                : "text-zinc-600"
                            )}
                          >
                            {section.path}
                          </span>
                          <div className="ml-auto flex items-center gap-2">
                            {section.state !== "pending" && (
                              <>
                                <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400">+{section.added}</span>
                                <span className="rounded bg-white/[0.02] px-1.5 py-0.5 text-[10px] text-zinc-500">-{section.removed}</span>
                              </>
                            )}
                            <span
                              className={cn(
                                "text-[10px] font-sans uppercase tracking-wider",
                                section.state === "active"
                                  ? "text-zinc-400"
                                  : section.state === "completed"
                                  ? "text-zinc-600"
                                  : "text-zinc-600"
                              )}
                            >
                              {section.state === "active" ? "Generating" : section.state === "completed" ? "Completed" : "Pending"}
                            </span>
                          </div>
                        </div>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className={cn(
                                "overflow-hidden border-t border-graphite",
                                section.state === "active" ? "bg-obsidian" : "bg-obsidian/80"
                              )}
                            >
                              {section.state === "active" ? (
                                <div className="flex overflow-hidden">
                                  <div className="min-w-[3rem] select-none border-r border-graphite bg-charcoal px-4 py-4 text-right text-[12px] leading-[1.6] text-zinc-600/40">
                                    {previewLines.map((_, index) => (
                                      <span key={`${section.id}-line-${index}`} className={index >= 4 ? "block text-zinc-400" : "block"}>
                                        {index + 1}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex-1 overflow-x-auto bg-obsidian py-4">
                                    <pre className="whitespace-pre px-6 text-[12px] leading-[1.6] text-zinc-300">
                                      {previewLines.join("\n")}
                                      {isProcessing && (
                                        <span className="ml-1 inline-block h-3.5 w-2 animate-[pulse_1s_ease-in-out_infinite] align-middle bg-zinc-400" />
                                      )}
                                    </pre>
                                  </div>
                                </div>
                              ) : (
                                <div className={cn("overflow-x-auto p-6 text-[12px]", section.state === "pending" ? "italic text-zinc-600" : "text-zinc-500")}>
                                  <pre>{previewLines.join("\n")}</pre>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-0 inset-x-0 bg-gradient-to-t from-obsidian via-obsidian to-transparent p-4 pt-12">
                <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-between rounded-full border border-graphite bg-charcoal/90 p-1.5 shadow-2xl backdrop-blur">
                  <div className="flex items-center gap-2 pl-3">
                    <div className="flex items-center gap-1.5">
                      <div className={cn("h-1.5 w-1.5 rounded-full", isProcessing ? "animate-pulse bg-zinc-400" : "bg-zinc-500")} />
                      <span className="text-[11px] font-medium text-zinc-300">
                        {isProcessing ? "Writing artifacts..." : "Artifacts ready for review"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={isProcessing ? stopGeneration : () => void handleRun(goalDraft)}
                    className="flex items-center gap-1.5 rounded-full border border-transparent bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-white/10"
                  >
                    {isProcessing ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                    {isProcessing ? "Pause" : "Resume"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-graphite bg-charcoal p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                {error ? <AlertCircle size={14} className="text-red-400" /> : isProcessing ? <Loader2 size={14} className="animate-spin text-zinc-500" /> : <AlertCircle size={14} className="text-zinc-500" />}
                <span>{decisionMessage}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate("/editor")} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white">Edit Code</button>
                <button onClick={() => void handleRun(goalDraft)} disabled={isProcessing || !goalDraft.trim()} className="rounded-lg bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">Approve & Continue</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
