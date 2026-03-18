// useAgentHandlers - Agent View 事件处理
import type { DisplayStep } from "@/features/agent/components";
import { useNavigate } from "react-router";
import { useConversationStore } from "@/stores/conversationStore";
import { buildConversationTitle } from "@/services/agent/internal/utils";

interface UseAgentHandlersParams {
  goalDraft: string;
  setGoalDraft: (value: string) => void;
  goalInputRef: React.RefObject<HTMLTextAreaElement | null>;
  isProcessing: boolean;
  currentRun: { goal?: string; phase?: string } | null;
  routeConversationId?: string | null;
  canResumeCurrentRun: boolean;
  accessToken: string | null;
  catalogLoading: boolean;
  catalogError: string | null;
  configuredProviders: Array<{ name: string; configured: boolean; models: string[] }>;
  providerReady: boolean;
  sendMessage: (message: string) => Promise<void>;
  resumeRun: (instruction?: string) => Promise<void>;
  stopGeneration: () => void;
  createConversation: (title?: string) => Promise<string>;
  reset: () => void;
  setExpandedFile: (value: string | null) => void;
  retryStep: (stepId: string) => void;
}

export function useAgentHandlers(params: UseAgentHandlersParams) {
  const navigate = useNavigate();
  const {
    goalDraft,
    setGoalDraft,
    goalInputRef,
    isProcessing,
    currentRun,
    routeConversationId,
    canResumeCurrentRun,
    accessToken,
    catalogLoading,
    catalogError,
    configuredProviders,
    providerReady,
    sendMessage,
    resumeRun,
    stopGeneration,
    createConversation,
    reset,
    setExpandedFile,
    retryStep,
  } = params;

  const ensureAgentReady = () => {
    if (!accessToken) {
      console.log('[ensureAgentReady] No access token');
      return false;
    }
    if (catalogLoading && configuredProviders.length === 0) {
      console.log('[ensureAgentReady] Catalog loading and no providers');
      return false;
    }
    if (catalogError && configuredProviders.length === 0) {
      console.log('[ensureAgentReady] Catalog error:', catalogError);
      return false;
    }
    if (!providerReady) {
      console.log('[ensureAgentReady] Provider not ready');
      return false;
    }
    return true;
  };

  const handleRun = async (content: string) => {
    const next = content.trim();
    if (!next || isProcessing || !ensureAgentReady()) {
      return;
    }

    const conversationStore = useConversationStore.getState();
    let targetConversationId = routeConversationId || null;
    const targetConversation =
      targetConversationId ? conversationStore.getConversation(targetConversationId) : undefined;

    if (!targetConversationId || !targetConversation) {
      targetConversationId = await createConversation(buildConversationTitle(next));
    }

    if (targetConversationId) {
      navigate(`/agent/${targetConversationId}`, { replace: true });
    }

    setGoalDraft(next);
    await sendMessage(next);
  };

  const handleContinue = async () => {
    if (isProcessing || !currentRun || !canResumeCurrentRun || !ensureAgentReady()) return;

    const hasDraftInstruction =
      Boolean(currentRun) &&
      goalDraft.trim() &&
      goalDraft.trim() !== currentRun?.goal?.trim();

    const instruction = hasDraftInstruction ? goalDraft.trim() : undefined;
    await resumeRun(instruction);

    if (instruction) {
      setGoalDraft(currentRun.goal || "");
    }
  };

  const handlePrimaryAction = async () => {
    if (isProcessing) {
      stopGeneration();
      return;
    }

    if (canResumeCurrentRun) {
      await handleContinue();
      return;
    }

    await handleRun(goalDraft);
  };

  const handleNewSession = () => {
    if (isProcessing) return;

    useConversationStore.getState().setCurrentConversation(null);
    reset();
    setGoalDraft("");
    setExpandedFile(null);
    navigate("/agent");
  };

  const handleEditStep = (step: DisplayStep) => {
    const prefix = `@Step ${step.order} (${step.title}): `;
    const nextGoal = goalDraft.trim() ? `${goalDraft.trim()}\n\n${prefix}` : prefix;
    setGoalDraft(nextGoal);

    window.requestAnimationFrame(() => {
      const node = goalInputRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(nextGoal.length, nextGoal.length);
    });
  };

  const handleRetryStep = (step: DisplayStep) => {
    if (step.synthetic || isProcessing) return;
    retryStep(step.id);
  };

  return {
    handleRun,
    handleContinue,
    handlePrimaryAction,
    handleNewSession,
    handleEditStep,
    handleRetryStep,
    ensureAgentReady,
  };
}
