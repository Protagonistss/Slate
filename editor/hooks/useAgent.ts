import { useCallback } from 'react';
import { useAgentStore, useUIStore } from '../stores';

/**
 * Agent 操作 Hook
 */
export function useAgent() {
  const {
    status,
    isProcessing,
    currentStreamContent,
    currentToolCalls,
    error,
    sendMessage,
    stopGeneration,
    clearError,
    reset,
  } = useAgentStore();

  const { addToast } = useUIStore();

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

  const stop = useCallback(() => {
    stopGeneration();
    addToast({ type: 'info', message: '已停止生成' });
  }, [stopGeneration, addToast]);

  return {
    status,
    isProcessing,
    currentStreamContent,
    currentToolCalls,
    error,
    sendMessage: send,
    stopGeneration: stop,
    clearError,
    reset,
  };
}
