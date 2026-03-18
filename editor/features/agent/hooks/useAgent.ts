import { useCallback } from 'react';
import { useAgentStore, useConversationStore, useUIStore } from '@/stores';

/**
 * Agent 操作 Hook
 */
export function useAgent() {
  const status = useAgentStore((state) => state.status);
  const isProcessing = useAgentStore((state) => state.isProcessing);
  const currentStreamContent = useAgentStore((state) => state.currentStreamContent);
  const currentToolCalls = useAgentStore((state) => state.currentToolCalls);
  const runsByConversation = useAgentStore((state) => state.runsByConversation);
  const error = useAgentStore((state) => state.error);
  const sendMessage = useAgentStore((state) => state.sendMessage);
  const resumeRun = useAgentStore((state) => state.resumeRun);
  const retryStep = useAgentStore((state) => state.retryStep);
  const stopGeneration = useAgentStore((state) => state.stopGeneration);
  const clearError = useAgentStore((state) => state.clearError);
  const reset = useAgentStore((state) => state.reset);

  const currentConversationId = useConversationStore((state) => state.currentConversationId);

  const { addToast } = useUIStore();

  console.log('[useAgent] currentConversationId:', currentConversationId);
  console.log('[useAgent] runsByConversation keys:', Object.keys(runsByConversation));

  const currentRun = currentConversationId ? runsByConversation[currentConversationId] || null : null;

  const send = useCallback(
    async (content: string) => {
      if (!content.trim()) {
        addToast({ type: 'warning', message: '请输入消息内容' });
        return;
      }

      try {
        await sendMessage(content);
      } catch (err) {
        addToast({
          type: 'error',
          message: err instanceof Error ? err.message : '发送失败',
        });
      }
    },
    [sendMessage, addToast]
  );

  const resume = useCallback(
    async (instruction?: string) => {
      try {
        await resumeRun(instruction);
      } catch (err) {
        addToast({
          type: 'error',
          message: err instanceof Error ? err.message : '恢复执行失败',
        });
      }
    },
    [resumeRun, addToast]
  );

  const stop = useCallback(() => {
    stopGeneration();
    addToast({ type: 'info', message: '已停止生成' });
  }, [stopGeneration, addToast]);

  const retry = useCallback(
    (stepId: string) => {
      retryStep(stepId);
      addToast({ type: 'info', message: '步骤已重置，可继续执行' });
    },
    [retryStep, addToast]
  );

  return {
    status,
    isProcessing,
    currentStreamContent,
    currentToolCalls,
    currentRun,
    error,
    sendMessage: send,
    resumeRun: resume,
    retryStep: retry,
    stopGeneration: stop,
    clearError,
    reset,
  };
}
