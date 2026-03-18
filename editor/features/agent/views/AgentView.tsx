// AgentView - 主视图组件（已重构，还原原型时间线布局）
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { matchPath, useLocation, useNavigate, useParams } from "react-router";
import { Bot, Play, Plus, ChevronDown, CornerLeftUp, Square, User } from "lucide-react";
import {
  AgentEmptyState,
  AgentStepList,
  TimelineCodeBlock,
  TimelineNode,
} from "@/features/agent/components";
import { AgentComposer } from "@/features/agent/components/AgentComposer";
import {
  TimelineReasoningNode,
  TimelineToolCallNode,
  TimelineFileNode,
  TimelineCodeStreamNode,
  TimelinePendingNode,
} from "@/features/agent/components";
import type { DisplayStep, ArtifactSection } from "@/features/agent/components";
import type { ToolCallRecord } from "@/features/agent/store/types";
import { useAuthStore, useConversationStore } from "@/stores";
import { useAgentState, useAgentCalculations, useAgentEffects, useAgentHandlers } from "./hooks";

export function AgentView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { conversationId: routeConversationIdParam } = useParams<{ conversationId?: string }>();
  const routeConversationIdFromPath =
    matchPath("/agent/:conversationId", location.pathname)?.params?.conversationId ?? null;
  const runtimePathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  const routeConversationIdFromRuntimePath =
    matchPath("/agent/:conversationId", runtimePathname)?.params?.conversationId ?? null;
  const routeConversationId =
    routeConversationIdParam ??
    routeConversationIdFromPath ??
    routeConversationIdFromRuntimePath ??
    undefined;
  const authUser = useAuthStore((state) => state.user);
  const currentConversationId = useConversationStore((state) => state.currentConversationId);
  const routeConversationExists = useConversationStore((state) =>
    routeConversationId ? state.conversations.some((conversation) => conversation.id === routeConversationId) : false
  );
  const currentConversationExists = useConversationStore((state) =>
    currentConversationId ? state.conversations.some((conversation) => conversation.id === currentConversationId) : false
  );
  const setCurrentConversation = useConversationStore((state) => state.setCurrentConversation);
  const state = useAgentState();
  const [historyAvatarFailed, setHistoryAvatarFailed] = useState(false);

  useEffect(() => {
    if (!routeConversationId) {
      // Keep current conversation id untouched on `/agent` to avoid
      // racing with "create -> navigate" flow and accidentally clearing it.
      return;
    }

    if (!routeConversationExists) {
      if (currentConversationId && currentConversationExists) {
        navigate(`/agent/${currentConversationId}`, { replace: true });
        return;
      }

      setCurrentConversation(null);
      navigate("/agent", { replace: true });
      return;
    }

    if (routeConversationId !== currentConversationId) {
      setCurrentConversation(routeConversationId);
    }
  }, [
    currentConversationExists,
    currentConversationId,
    navigate,
    routeConversationExists,
    routeConversationId,
    setCurrentConversation,
  ]);

  useEffect(() => {
    setHistoryAvatarFailed(false);
  }, [authUser?.avatarUrl]);

  const calculations = useAgentCalculations({
    currentRun: state.currentRun,
    currentStreamContent: state.currentStreamContent,
    conversation: state.conversation,
    currentProvider: state.currentProvider,
    llmConfigs: state.llmConfigs,
    catalogProviders: state.catalogProviders,
    accessToken: state.accessToken,
    isProcessing: state.isProcessing,
    currentToolCalls: state.currentToolCalls || [],
    error: state.error,
    expandedFile: state.expandedFile,
  });

  useAgentEffects({
    goalDraft: state.goalDraft,
    setGoalDraft: state.setGoalDraft,
    goalInputRef: state.goalInputRef,
    reasoningScrollRef: state.reasoningScrollRef,
    accessToken: state.accessToken,
    catalogProviders: state.catalogProviders,
    syncLLMProviders: state.syncLLMProviders,
    initializeCatalog: state.initializeCatalog,
    clearCatalog: state.clearCatalog,
    currentRun: state.currentRun,
    latestUserMessage: calculations.latestUserMessage,
    streamContent: state.currentStreamContent,
    isReasoningExpanded: state.isReasoningExpanded,
    reasoningEntries: calculations.reasoningEntries,
    shouldShowReasoningError: calculations.shouldShowReasoningError,
    currentProjectPath: state.currentProjectPath,
    workingDirectory: state.workingDirectory,
    artifactSections: calculations.artifactSections,
    expandedFile: state.expandedFile,
    setExpandedFile: state.setExpandedFile,
    setArtifactFileContents: state.setArtifactFileContents,
    artifactFileContents: state.artifactFileContents,
    artifactLastVisibleContentRef: state.artifactLastVisibleContentRef,
    activeArtifactPath: calculations.activeArtifactPath,
    activeStreamingSection: calculations.activeStreamingSection,
    expandedArtifactSection: calculations.expandedArtifactSection,
    expandedArtifactPath: calculations.expandedArtifactPath,
    expandedArtifactCacheKey: calculations.expandedArtifactCacheKey,
    isExpandedArtifactStreaming: calculations.isExpandedArtifactStreaming,
  });

  const handlers = useAgentHandlers({
    goalDraft: state.goalDraft,
    setGoalDraft: state.setGoalDraft,
    goalInputRef: state.goalInputRef,
    isProcessing: state.isProcessing,
    currentRun: state.currentRun,
    routeConversationId,
    canResumeCurrentRun: calculations.canResumeCurrentRun,
    accessToken: state.accessToken,
    catalogLoading: state.catalogLoading,
    catalogError: state.catalogError,
    configuredProviders: calculations.configuredProviders,
    providerReady: calculations.providerReady,
    sendMessage: state.sendMessage,
    resumeRun: state.resumeRun,
    stopGeneration: state.stopGeneration,
    createConversation: state.createConversation,
    reset: state.reset,
    setExpandedFile: state.setExpandedFile,
    retryStep: state.retryStep,
  });

  const [expandedToolCall, setExpandedToolCall] = useState<string | null>(null);
  const [expandedHistoryMessage, setExpandedHistoryMessage] = useState<string | null>(null);
  const [expandedReasoningId, setExpandedReasoningId] = useState<string | null>(null);
  // Enter detail view whenever route has conversation id.
  // A fresh conversation may not have run/messages yet, but should still
  // render the secondary page instead of falling back to empty state.
  const shouldShowEmptyState = !routeConversationId;

  if (shouldShowEmptyState) {
    return (
      <div className="flex h-full flex-1 flex-col justify-center space-y-8 overflow-y-auto p-4 pb-24 scrollbar-thin scrollbar-thumb-zinc-800 lg:p-6">
        <AgentEmptyState 
          onStart={(goal) => {
            void handlers.handleRun(goal);
          }} 
        />
      </div>
    );
  }

  const hasStreamContent = state.currentStreamContent.trim().length > 0;
  const artifactSections = calculations.artifactSections || [];
  const historyMessages = calculations.visibleMessages.flatMap((message, index) => {
      if (message.role !== "user") {
        return [];
      }

      const textContent = typeof message.content === "string"
        ? message.content.trim()
        : message.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n\n")
            .trim();

      if (!textContent) {
        return [];
      }

      return [{
        id: `history-${index}`,
        role: message.role,
        content: textContent,
      }];
    }).filter((message, index, list) => {
      if (index === 0) {
        return true;
      }

      const previous = list[index - 1];
      return previous.role !== message.role || previous.content !== message.content;
    });

  const userInitial = authUser?.username.trim().charAt(0).toUpperCase() || "";
  const userHistoryIcon = authUser?.avatarUrl && !historyAvatarFailed ? (
    <img
      src={authUser.avatarUrl}
      alt={authUser.username || "User avatar"}
      className="h-full w-full rounded-full object-cover"
      onError={() => setHistoryAvatarFailed(true)}
    />
  ) : authUser ? (
    <span className="text-[10px] font-semibold text-zinc-100">{userInitial}</span>
  ) : (
    <User size={12} />
  );

  return (
    <div className="flex h-full flex-1 flex-col w-full mx-auto overflow-hidden bg-obsidian">
      <div className="flex-1 p-4 lg:p-6 pb-2 flex flex-col space-y-6 min-h-0">
        <section className="flex flex-col lg:grid lg:grid-cols-5 gap-6 items-stretch flex-1 min-h-0 pb-4">
          <div className="lg:col-span-2 flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between px-2 mb-4 shrink-0">
              <h3 className="text-xs font-semibold text-zinc-300">Execution Plan</h3>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {calculations.completedSteps} / {calculations.displaySteps.length} Complete
              </span>
            </div>
            <AgentStepList
              displaySteps={calculations.displaySteps}
              onEditStep={handlers.handleEditStep}
              onRetryStep={handlers.handleRetryStep}
            />
          </div>

          <div className="lg:col-span-3 flex flex-col h-full min-h-0">
            <div className="flex flex-col h-full min-h-0 pl-2 lg:pl-6 text-zinc-300 font-sans">
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800/50 pr-4 pb-12 pt-2">
                {historyMessages.map((message) => (
                  <TimelineNode
                    key={message.id}
                    icon={message.role === "user" ? userHistoryIcon : <Bot size={12} />}
                    iconBg={message.role === "user" ? "bg-blue-950/40" : "bg-emerald-950/40"}
                    iconBorder={message.role === "user" ? "border-blue-900/80" : "border-emerald-900/80"}
                    label={message.role === "user" ? "You" : "Assistant"}
                    preview={message.content}
                    isExpanded={expandedHistoryMessage === message.id}
                    onToggle={() =>
                      setExpandedHistoryMessage(expandedHistoryMessage === message.id ? null : message.id)
                    }
                  >
                    <TimelineCodeBlock>
                      <pre className="whitespace-pre-wrap break-words font-sans text-zinc-300">
                        {message.content}
                      </pre>
                    </TimelineCodeBlock>
                  </TimelineNode>
                ))}

                {calculations.processTimelineItems.map((item) =>
                  item.type === "reasoning" ? (
                    <TimelineReasoningNode
                      key={item.id}
                      entry={item.entry}
                      isExpanded={expandedReasoningId === item.entry.id}
                      onToggle={() =>
                        setExpandedReasoningId(expandedReasoningId === item.entry.id ? null : item.entry.id)
                      }
                    />
                  ) : (
                    <TimelineToolCallNode
                      key={item.id}
                      toolCall={item.toolCall}
                      isExpanded={expandedToolCall === item.toolCall.id}
                      onToggle={() =>
                        setExpandedToolCall(expandedToolCall === item.toolCall.id ? null : item.toolCall.id)
                      }
                      onConfirm={() => {
                        state.resumeRun();
                      }}
                      onReject={() => {
                        state.stopGeneration();
                      }}
                    />
                  )
                )}

                {artifactSections.slice(0, -1).map((section: ArtifactSection) => (
                  <TimelineFileNode
                    key={section.id}
                    path={section.path}
                    action={section.state === "completed" ? "modified" : "created"}
                    preview={section.preview}
                    content={section.contentSnapshot}
                    linesAdded={section.added}
                    linesRemoved={section.removed}
                    isExpanded={state.expandedFile === section.path}
                    onToggle={() =>
                      state.setExpandedFile(state.expandedFile === section.path ? null : section.path)
                    }
                  />
                ))}

                {hasStreamContent && calculations.activeArtifactPath && (
                  <TimelineCodeStreamNode
                    path={calculations.activeArtifactPath}
                    content={state.currentStreamContent}
                  />
                )}

                {calculations.hasPendingSteps && (
                  <TimelinePendingNode path="Next task awaiting..." />
                )}

                {calculations.finalAssistantSummary && (
                  <TimelineNode
                    icon={<Bot size={12} />}
                    iconBg="bg-emerald-950/40"
                    iconBorder="border-emerald-900/80"
                    label="Final Summary"
                    preview={calculations.finalAssistantSummary}
                    isExpanded={expandedHistoryMessage === "assistant-summary"}
                    onToggle={() =>
                      setExpandedHistoryMessage(expandedHistoryMessage === "assistant-summary" ? null : "assistant-summary")
                    }
                    isLast
                  >
                    <TimelineCodeBlock>
                      <pre className="whitespace-pre-wrap break-words font-sans text-zinc-300">
                        {calculations.finalAssistantSummary}
                      </pre>
                    </TimelineCodeBlock>
                  </TimelineNode>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="shrink-0 py-3 px-4 lg:py-4 lg:px-6 border-t border-zinc-800/50 bg-[#0a0a0a]/90 backdrop-blur-md z-10 w-full relative">
        <AgentComposer
          value={state.goalDraft}
          textareaRef={state.goalInputRef}
          onChange={(next, el) => {
            state.setGoalDraft(next);
            if (el) {
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }
          }}
          onSubmit={handlers.handlePrimaryAction}
          primaryVariant={state.isProcessing ? "danger" : "primary"}
          primaryLabel={
            state.isProcessing ? (
              <>
                <Square size={12} className="fill-current" />
                Stop
              </>
            ) : (
              <>
                <Play size={12} fill="currentColor" />
                {calculations.canResumeCurrentRun ? "Continue" : "Run"}
              </>
            )
          }
          canSubmit={state.isProcessing || Boolean(state.goalDraft.trim()) || calculations.canResumeCurrentRun}
          showModelSelect
          modelSelectDisabled={state.isProcessing}
          containerClassName="max-w-5xl mx-auto"
          leftSlot={
            <>
              <button
                type="button"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                title="Add context"
              >
                <Plus size={15} />
              </button>

              <div className="w-px h-3.5 bg-zinc-800 mx-1" />

              <div className="relative group/mode">
                <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 transition-colors text-xs font-medium">
                  <Bot size={13} className="text-zinc-500 group-hover/mode:text-zinc-400 transition-colors" />
                  <span>Agent Mode</span>
                  <ChevronDown size={12} className="opacity-50 group-hover/mode:opacity-100 transition-opacity" />
                </button>
              </div>
            </>
          }
          hintSlot={
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800/50 flex items-center justify-center">
                <CornerLeftUp size={10} className="rotate-90" />
              </kbd>
            </div>
          }
        />
      </div>
    </div>
  );
}
