// useAgentState - Agent View 状态管理
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useConfigStore } from "@/stores/configStore";
import { useLLMCatalogStore } from "@/stores/llmCatalogStore";
import { useProjectStore } from "@/stores/projectStore";
import { useConversationStore } from "@/stores/conversationStore";
import { useAgent } from "@/features/agent/hooks";
import type { Message } from "@/services/llm/types";
import { extractTextContent } from "@/features/agent/components/utils/agentViewUtils";
import type { ArtifactFileContentState } from "@/features/agent/components";

export function useAgentState() {
  const goalInputRef = useRef<HTMLTextAreaElement | null>(null);
  const reasoningScrollRef = useRef<HTMLDivElement | null>(null);
  const artifactLastVisibleContentRef = useRef<Record<string, string>>({});
  const [goalDraft, setGoalDraft] = useState("");
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [artifactFileContents, setArtifactFileContents] = useState<Record<string, ArtifactFileContentState>>({});

  const accessToken = useAuthStore((state) => state.accessToken);
  const currentProvider = useConfigStore((state) => state.currentProvider);
  const workingDirectory = useConfigStore((state) => state.workingDirectory);
  const llmConfigs = useConfigStore((state) => state.llmConfigs);
  const syncLLMProviders = useConfigStore((state) => state.syncLLMProviders);
  const currentProjectPath = useProjectStore((state) => state.currentProject?.path || null);
  const catalogProviders = useLLMCatalogStore((state) => state.providers);
  const catalogLoading = useLLMCatalogStore((state) => state.isLoading);
  const catalogError = useLLMCatalogStore((state) => state.error);
  const initializeCatalog = useLLMCatalogStore((state) => state.initialize);
  const clearCatalog = useLLMCatalogStore((state) => state.clear);
  const createConversation = useConversationStore((state) => state.createConversation);
  const currentConversationId = useConversationStore((state) => state.currentConversationId);
  const conversation = useConversationStore((state) =>
    state.currentConversationId
      ? state.conversations.find((item) => item.id === state.currentConversationId) || null
      : null
  );

  const {
    isProcessing,
    currentStreamContent,
    currentToolCalls,
    currentRun,
    error,
    sendMessage,
    resumeRun,
    retryStep,
    stopGeneration,
    reset,
  } = useAgent();

  return {
    // Refs
    goalInputRef,
    reasoningScrollRef,
    artifactLastVisibleContentRef,
    // State
    goalDraft,
    setGoalDraft,
    expandedFile,
    setExpandedFile,
    isReasoningExpanded,
    setIsReasoningExpanded,
    artifactFileContents,
    setArtifactFileContents,
    // Store values
    accessToken,
    currentProvider,
    workingDirectory,
    llmConfigs,
    syncLLMProviders,
    currentProjectPath,
    catalogProviders,
    catalogLoading,
    catalogError,
    initializeCatalog,
    clearCatalog,
    createConversation,
    currentConversationId,
    conversation,
    // Agent hook values
    isProcessing,
    currentStreamContent,
    currentToolCalls,
    currentRun,
    error,
    sendMessage,
    resumeRun,
    retryStep,
    stopGeneration,
    reset,
  };
}
