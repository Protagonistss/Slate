// AgentView - 主视图组件（已重构，还原原型时间线布局）
import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Play, Plus, ChevronDown, CornerLeftUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AgentEmptyState,
  AgentStepList,
  AgentModelSelect,
} from "@/features/agent/components";
import {
  TimelineReasoningNode,
  TimelineToolCallNode,
  TimelineFileNode,
  TimelineCodeStreamNode,
  TimelinePendingNode,
} from "@/features/agent/components";
import type { DisplayStep, ArtifactSection } from "@/features/agent/components";
import type { ToolCallRecord } from "@/features/agent/store/types";
import { useAgentState, useAgentCalculations, useAgentEffects, useAgentHandlers } from "./hooks";

export function AgentView() {
  const state = useAgentState();

  const calculations = useAgentCalculations({
    currentRun: state.currentRun,
    currentStreamContent: state.currentStreamContent,
    conversation: state.conversation,
    currentProvider: state.currentProvider,
    llmConfigs: state.llmConfigs,
    catalogProviders: state.catalogProviders,
    accessToken: state.accessToken,
    isProcessing: state.isProcessing,
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

  if (!calculations.hasSession) {
    return (
      <div className="flex h-full flex-1 flex-col justify-center space-y-8 overflow-y-auto p-4 pb-24 scrollbar-thin scrollbar-thumb-zinc-800 lg:p-6">
        <AgentEmptyState onStart={(goal) => void handlers.handleRun(goal)} />
      </div>
    );
  }

  const hasStreamContent = state.currentStreamContent.trim().length > 0;
  const toolCalls = state.currentToolCalls || [];
  const artifactSections = calculations.artifactSections || [];

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && state.goalDraft.trim()) {
      event.preventDefault();
      handlers.handlePrimaryAction();
    }
  };

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
                <TimelineReasoningNode
                  entry={calculations.latestReasoning}
                  isExpanded={state.isReasoningExpanded}
                  onToggle={() => state.setIsReasoningExpanded((v) => !v)}
                />

                {toolCalls.map((toolCall: ToolCallRecord) => (
                  <TimelineToolCallNode
                    key={toolCall.id}
                    toolCall={toolCall}
                    isExpanded={expandedToolCall === toolCall.id}
                    onToggle={() =>
                      setExpandedToolCall(expandedToolCall === toolCall.id ? null : toolCall.id)
                    }
                    onConfirm={() => {
                      state.resumeRun();
                    }}
                    onReject={() => {
                      state.stopGeneration();
                    }}
                  />
                ))}

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
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="shrink-0 py-3 px-4 lg:py-4 lg:px-6 border-t border-zinc-800/50 bg-[#0a0a0a]/90 backdrop-blur-md z-10 w-full relative">
        <div className="rounded-xl bg-charcoal border border-graphite relative group focus-within:border-zinc-700 focus-within:bg-zinc-900/50 transition-colors flex flex-col shadow-lg max-w-5xl mx-auto">
          <textarea
            ref={state.goalInputRef}
            className="w-full bg-transparent border-none focus:outline-none text-[14px] text-zinc-300 placeholder-zinc-600 resize-none font-normal leading-[1.5] min-h-[24px] px-3 pt-2.5 pb-0"
            value={state.goalDraft}
            onChange={(e) => {
              state.setGoalDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Refine your request or add new instructions..."
            rows={1}
          />

          <div className="flex items-center justify-between p-1.5">
            <div className="flex items-center gap-1.5 pl-1 text-zinc-500">
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
            </div>

            <div className="flex items-center gap-3 pr-1">
              <AgentModelSelect className="hidden sm:block mr-2" disabled={state.isProcessing} />

              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-500">
                <span>Press</span>
                <kbd className="px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800/50 flex items-center justify-center">
                  <CornerLeftUp size={10} className="rotate-90" />
                </kbd>
              </div>

              <button
                onClick={handlers.handlePrimaryAction}
                disabled={!state.goalDraft.trim() && !calculations.canResumeCurrentRun}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 font-medium text-[12px]",
                  state.goalDraft.trim() || calculations.canResumeCurrentRun
                    ? "bg-zinc-300 text-zinc-900 hover:bg-white"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
              >
                <Play size={12} fill="currentColor" />
                {calculations.canResumeCurrentRun ? "Continue" : "Run"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
