// useAgentCalculations - Agent View 计算逻辑
import { useMemo, useEffect } from "react";
import type { AgentRun, ReasoningEntry, ToolCallRecord } from "@/stores";
import type { Message } from "@/services/llm/types";
import {
  buildStepSummary,
  buildReasoningFallback,
  buildTopActionLabel,
  toPreviewLines,
  normalizeReasoningText,
  extractTextContent,
} from "@/features/agent/components/utils/agentViewUtils";
import { buildArtifactSections } from "@/features/editor/views/utils/buildArtifactSections";
import type { DisplayStep, ArtifactSection } from "@/features/agent/components";
import { parsePlanToolInput } from "@/services/agent/run/planParser";
import { INTERNAL_AGENT_TOOL_NAMES, INTERNAL_AGENT_TOOL_SET } from "@/services/agent/internal/tools";

interface UseAgentCalculationsParams {
  currentRun: AgentRun | null;
  currentStreamContent: string;
  conversation: { messages: Message[] } | null;
  currentProvider: string | null;
  llmConfigs: Record<string, { model?: string }>;
  catalogProviders: Array<{ name: string; configured: boolean; models: string[] }>;
  accessToken: string | null;
  isProcessing: boolean;
  currentToolCalls: ToolCallRecord[];
  error: string | null;
  expandedFile: string | null;
}

function parseToolResultContent(content: string): unknown {
  const normalized = content.trim();
  if (!normalized) {
    return "";
  }

  try {
    return JSON.parse(normalized);
  } catch {
    return normalized;
  }
}

function isSummaryLikeReasoning(text: string): boolean {
  const normalized = normalizeReasoningText(text).toLowerCase();
  if (!normalized) {
    return false;
  }

  const summarySignals = [
    "summary",
    "final summary",
    "task complete",
    "execution complete",
    "work completed",
    "完成总结",
    "任务完成",
    "执行完成",
    "最终总结",
    "总结一下",
    "以下是",
    "下面总结",
    "已成功",
    "已完成",
    "完成了",
    "让我们总结",
  ];

  if (summarySignals.some((signal) => normalized.includes(signal))) {
    return true;
  }

  const hasStructuredSummary =
    (text.includes("##") || text.includes("###")) &&
    (normalized.includes("完成") || normalized.includes("summary"));
  const hasListSummary =
    (/^\s*[-*]\s+/m.test(text) || /^\s*\d+\.\s+/m.test(text)) &&
    (normalized.includes("完成") || normalized.includes("summary"));

  return hasStructuredSummary || hasListSummary;
}

function isGeneratedWorkingNote(entry: ReasoningEntry, currentRun: AgentRun | null): boolean {
  if (!currentRun || !entry.stepId) {
    return false;
  }

  const targetStep = currentRun.steps.find((step) => step.id === entry.stepId);
  if (!targetStep) {
    return false;
  }

  return normalizeReasoningText(entry.text) === normalizeReasoningText(`Working on ${targetStep.title}...`);
}

export function useAgentCalculations(params: UseAgentCalculationsParams) {
  const {
    currentRun,
    currentStreamContent,
    conversation,
    currentProvider,
    llmConfigs,
    catalogProviders,
    accessToken,
    isProcessing,
    currentToolCalls,
    error,
    expandedFile,
  } = params;

  const visibleMessages = useMemo(
    () => (conversation?.messages || []).filter((message) => message.role !== "system"),
    [conversation?.messages]
  );

  const latestAssistantMessage = useMemo(
    () => [...visibleMessages].reverse().find((message) => message.role === "assistant"),
    [visibleMessages]
  );

  const latestUserMessage = useMemo(
    () => [...visibleMessages].reverse().find((message) => message.role === "user"),
    [visibleMessages]
  );

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

  const displaySteps = useMemo<DisplayStep[]>(() => {
    console.log('[useAgentCalculations] displaySteps useMemo - currentRun:', currentRun?.id, 'phase:', currentRun?.phase, 'steps:', currentRun?.steps?.length);
    if (!currentRun) return [];

    if (currentRun.steps.length === 0) {
      const recoveredPlan = [...visibleMessages].reverse().find((message) => {
        return Array.isArray(message.content) && message.content.some(
          (block) => block.type === "tool_use" && block.name === INTERNAL_AGENT_TOOL_NAMES.submitPlan
        );
      });

      if (recoveredPlan && Array.isArray(recoveredPlan.content)) {
        const submitPlanBlock = recoveredPlan.content.find(
          (block) => block.type === "tool_use" && block.name === INTERNAL_AGENT_TOOL_NAMES.submitPlan
        );

        if (submitPlanBlock?.type === "tool_use") {
          const parsedPlan = parsePlanToolInput(submitPlanBlock.input);
          if (parsedPlan) {
            return parsedPlan.steps.map((step) => ({
              id: step.id,
              order: step.order,
              title: step.title,
              status: currentRun.phase === "completed" ? "completed" as const : step.status,
              summary: buildStepSummary(step),
            }));
          }
        }
      }

      const syntheticStep: DisplayStep = {
        id: "planning",
        order: 1,
        title: "Draft execution plan",
        status: currentRun.phase === "planning" ? "running" as const : "pending" as const,
        summary: "Generating a structured execution plan for the current goal.",
        synthetic: true,
      };
      console.log('[useAgentCalculations] returning synthetic step:', syntheticStep);
      return [syntheticStep];
    }

    const steps = currentRun.steps.map((step) => ({
      id: step.id,
      order: step.order,
      title: step.title,
      status: step.status,
      summary: buildStepSummary(step),
    }));
    console.log('[useAgentCalculations] returning steps:', steps.length);
    return steps;
  }, [currentRun, visibleMessages]);

  const rawReasoningEntries = useMemo<ReasoningEntry[]>(() => {
    if (!currentRun) return [];

    const baseEntries =
      currentRun.reasoningEntries.length > 0
        ? currentRun.reasoningEntries
        : buildReasoningFallback(currentRun);
    const normalizedPreview = normalizeReasoningText(currentStreamContent);
    const normalizedLastEntry = baseEntries.length > 0
      ? normalizeReasoningText(baseEntries[baseEntries.length - 1].text)
      : "";

    if (!normalizedPreview || normalizedPreview === normalizedLastEntry) {
      return baseEntries;
    }

    return [
      ...baseEntries,
      {
        id: "stream-preview",
        phase: (currentRun.phase === "planning" ? "planning" : "execution") as ReasoningEntry["phase"],
        text: currentStreamContent.trim(),
        stepId: currentRun.activeStepId,
        createdAt: currentRun.updatedAt,
      },
    ];
  }, [currentRun, currentStreamContent, isProcessing, visibleMessages.length]);

  const artifactPreviewSet = useMemo(() => {
    const previews = new Set<string>();
    currentRun?.artifacts.forEach((artifact) => {
      const normalizedPreview = normalizeReasoningText(artifact.preview || "");
      if (normalizedPreview) {
        previews.add(normalizedPreview);
      }
    });
    return previews;
  }, [currentRun?.artifacts]);

  const hiddenSummaryReasoning = useMemo(() => {
    for (let index = rawReasoningEntries.length - 1; index >= 0; index -= 1) {
      const entry = rawReasoningEntries[index];
      const normalizedText = normalizeReasoningText(entry.text);
      if (!normalizedText) {
        continue;
      }

      if (artifactPreviewSet.has(normalizedText) || isSummaryLikeReasoning(entry.text)) {
        return entry;
      }
    }

    return null;
  }, [artifactPreviewSet, rawReasoningEntries]);

  const reasoningEntries = useMemo<ReasoningEntry[]>(() => {
    const visibleEntries: ReasoningEntry[] = [];

    rawReasoningEntries.forEach((entry, index) => {
      const normalizedText = normalizeReasoningText(entry.text);
      if (!normalizedText) {
        return;
      }

      const previousVisibleEntry = visibleEntries[visibleEntries.length - 1];
      if (
        previousVisibleEntry &&
        previousVisibleEntry.stepId === entry.stepId &&
        normalizeReasoningText(previousVisibleEntry.text) === normalizedText
      ) {
        return;
      }

      const nextEntry = rawReasoningEntries[index + 1] || null;
      if (
        isGeneratedWorkingNote(entry, currentRun) &&
        nextEntry &&
        nextEntry.stepId === entry.stepId &&
        normalizeReasoningText(nextEntry.text) !== normalizedText
      ) {
        return;
      }

      if (
        hiddenSummaryReasoning &&
        entry.id === hiddenSummaryReasoning.id &&
        rawReasoningEntries.length > 1
      ) {
        return;
      }

      visibleEntries.push(entry);
    });

    return visibleEntries;
  }, [currentRun, hiddenSummaryReasoning, rawReasoningEntries]);

  const shouldShowReasoningError =
    Boolean(currentRun?.error) &&
    (Boolean(currentRun?.reasoningEntries.length) || Boolean(currentRun?.lastAssistantMessage.trim()));

  const timelineToolCalls = useMemo<ToolCallRecord[]>(() => {
    const toolCalls: ToolCallRecord[] = [];
    const toolCallMap = new Map<string, ToolCallRecord>();

    visibleMessages.forEach((message) => {
      if (!Array.isArray(message.content)) {
        return;
      }

      if (message.role === "assistant") {
        message.content.forEach((block) => {
          if (block.type !== "tool_use" || INTERNAL_AGENT_TOOL_SET.has(block.name)) {
            return;
          }

          if (toolCallMap.has(block.id)) {
            return;
          }

          const nextToolCall: ToolCallRecord = {
            id: block.id,
            name: block.name,
            input: block.input,
            status: "pending",
          };
          toolCallMap.set(block.id, nextToolCall);
          toolCalls.push(nextToolCall);
        });
        return;
      }

      if (message.role === "user") {
        message.content.forEach((block) => {
          if (block.type !== "tool_result") {
            return;
          }

          const matchedToolCall = toolCallMap.get(block.tool_use_id);
          if (!matchedToolCall) {
            return;
          }

          const parsedResult = parseToolResultContent(block.content);
          if (block.is_error) {
            matchedToolCall.status = "error";
            matchedToolCall.error =
              typeof parsedResult === "string" ? parsedResult : block.content;
            return;
          }

          matchedToolCall.status = "success";
          matchedToolCall.result = parsedResult;
        });
      }
    });

    currentToolCalls.forEach((toolCall) => {
      const existingToolCall = toolCallMap.get(toolCall.id);
      if (existingToolCall) {
        existingToolCall.status = toolCall.status;
        existingToolCall.result = toolCall.result;
        existingToolCall.error = toolCall.error;
        return;
      }

      toolCalls.push({ ...toolCall });
    });

    return toolCalls;
  }, [currentToolCalls, visibleMessages]);

  const processTimelineItems = useMemo(() => {
    const artifactToolCallQueues = new Map<string, number[]>();
    currentRun?.artifacts
      .filter((artifact) => artifact.kind === "tool_result")
      .sort((left, right) => left.createdAt - right.createdAt)
      .forEach((artifact) => {
        const queue = artifactToolCallQueues.get(artifact.title) || [];
        queue.push(artifact.createdAt);
        artifactToolCallQueues.set(artifact.title, queue);
      });

    const reasoningItems = reasoningEntries.map((entry, index) => ({
      id: `reasoning:${entry.id}`,
      type: "reasoning" as const,
      createdAt: entry.createdAt,
      sequence: index,
      entry,
    }));

    const toolItems = timelineToolCalls.map((toolCall, index) => {
      const toolArtifactQueue = artifactToolCallQueues.get(toolCall.name) || [];
      const createdAt = toolArtifactQueue.shift() ?? currentRun?.updatedAt ?? Date.now();
      artifactToolCallQueues.set(toolCall.name, toolArtifactQueue);

      return {
        id: `tool:${toolCall.id}`,
        type: "tool_call" as const,
        createdAt,
        sequence: index,
        toolCall,
      };
    });

    return [...reasoningItems, ...toolItems].sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return left.createdAt - right.createdAt;
      }

      if (left.type !== right.type) {
        return left.type === "reasoning" ? -1 : 1;
      }

      return left.sequence - right.sequence;
    });
  }, [currentRun?.artifacts, currentRun?.updatedAt, reasoningEntries, timelineToolCalls]);

  const artifactSections = useMemo(
    () => buildArtifactSections(currentRun, currentStreamContent),
    [currentRun, currentStreamContent]
  );

  const activeStep = useMemo(() => {
    if (!currentRun) return null;
    if (currentRun.activeStepId) {
      return currentRun.steps.find((step) => step.id === currentRun.activeStepId) || null;
    }
    return currentRun.steps.find((step) => step.status === "running") || null;
  }, [currentRun]);

  const activeArtifactPath =
    activeStep?.artifactRefs[activeStep.artifactRefs.length - 1]?.path ||
    artifactSections.find((section) => section.state === "active")?.path ||
    artifactSections[0]?.path ||
    null;

  const activeStreamingSection = useMemo(
    () =>
      currentStreamContent.trim() && activeArtifactPath
        ? artifactSections.find((section) => section.path === activeArtifactPath && section.state === "active") || null
        : null,
    [activeArtifactPath, artifactSections, currentStreamContent]
  );

  const latestReasoning = reasoningEntries[reasoningEntries.length - 1] || null;
  const latestAssistantText = extractTextContent(latestAssistantMessage);
  const normalizedLatestReasoning = latestReasoning
    ? normalizeReasoningText(latestReasoning.text)
    : "";
  const normalizedLatestAssistant = latestAssistantText
    ? normalizeReasoningText(latestAssistantText)
    : "";
  const shouldHideLatestAssistantMessage =
    Boolean(normalizedLatestReasoning && normalizedLatestAssistant && normalizedLatestReasoning === normalizedLatestAssistant);
  const finalAssistantSummary =
    !isProcessing
      ? !shouldHideLatestAssistantMessage && latestAssistantText.trim()
        ? latestAssistantText.trim()
        : hiddenSummaryReasoning?.text.trim() || ""
      : "";
  const completedSteps = displaySteps.filter((step) => step.status === "completed").length;
  const hasSession = Boolean(conversation || currentRun || visibleMessages.length > 0);
  console.log('[useAgentCalculations] hasSession:', hasSession, 'currentRun:', currentRun?.id);
  const hasPendingSteps = Boolean(
    currentRun?.steps.some((step) => step.status === "pending") &&
    currentRun?.phase !== "completed" &&
    currentRun?.phase !== "error"
  );
  const canResumeCurrentRun =
    Boolean(currentRun) &&
    currentRun?.phase === "paused" &&
    hasPendingSteps;

  const topActionLabel = buildTopActionLabel(currentRun, isProcessing);

  const activeModelLabel =
    providerReady && currentProvider && currentLLMConfig?.model
      ? `${currentProvider} · ${currentLLMConfig.model}`
      : accessToken
      ? "No model"
      : "Sign in";

  const footerMessage = error || currentRun?.error
    ? error || currentRun?.error || "Run blocked."
    : isProcessing
    ? `Writing ${activeArtifactPath || activeStep?.title || "artifacts"}...`
    : canResumeCurrentRun
    ? "Review the artifacts and approve when ready."
    : currentRun?.phase === "completed"
    ? "Execution completed. Update the goal to start a new run."
    : "Agent is ready for the next instruction.";

  const expandedArtifactSection = useMemo(
    () => (expandedFile ? artifactSections.find((section) => section.path === expandedFile) || null : null),
    [artifactSections, expandedFile]
  );
  const expandedArtifactPath = expandedArtifactSection?.path || null;
  const expandedArtifactCacheKey = expandedArtifactSection?.cacheKey || null;
  const isExpandedArtifactStreaming =
    Boolean(currentStreamContent.trim()) &&
    expandedArtifactSection?.path === activeArtifactPath;

  return {
    visibleMessages,
    latestUserMessage,
    configuredProviders,
    currentLLMConfig,
    providerReady,
    displaySteps,
    reasoningEntries,
    timelineToolCalls,
    processTimelineItems,
    finalAssistantSummary,
    shouldShowReasoningError,
    shouldHideLatestAssistantMessage,
    latestReasoningNormalized: normalizedLatestReasoning,
    artifactSections,
    activeStep,
    activeArtifactPath,
    activeStreamingSection,
    latestReasoning,
    completedSteps,
    hasSession,
    hasPendingSteps,
    canResumeCurrentRun,
    topActionLabel,
    activeModelLabel,
    footerMessage,
    expandedArtifactPath,
    expandedArtifactCacheKey,
    expandedArtifactSection,
    isExpandedArtifactStreaming,
  };
}
