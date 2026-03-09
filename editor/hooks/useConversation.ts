import { useCallback } from 'react';
import { useConversationStore } from '../stores';
import type { Message } from '../services/llm/types';

/**
 * 会话操作 Hook
 */
export function useConversation() {
  const {
    conversations,
    currentConversationId,
    createConversation,
    deleteConversation,
    setCurrentConversation,
    addMessage,
    clearMessages,
    renameConversation,
    getCurrentConversation,
    getConversation,
  } = useConversationStore();

  const create = useCallback(
    (title?: string) => {
      const id = createConversation(title);
      return id;
    },
    [createConversation]
  );

  const del = useCallback(
    (id: string) => {
      deleteConversation(id);
    },
    [deleteConversation]
  );

  const select = useCallback(
    (id: string | null) => {
      setCurrentConversation(id);
    },
    [setCurrentConversation]
  );

  const add = useCallback(
    (conversationId: string, message: Message) => {
      addMessage(conversationId, message);
    },
    [addMessage]
  );

  const clear = useCallback(
    (conversationId: string) => {
      clearMessages(conversationId);
    },
    [clearMessages]
  );

  const rename = useCallback(
    (id: string, title: string) => {
      renameConversation(id, title);
    },
    [renameConversation]
  );

  const current = getCurrentConversation();

  return {
    conversations,
    currentConversationId,
    currentConversation: current,
    createConversation: create,
    deleteConversation: del,
    selectConversation: select,
    addMessage: add,
    clearMessages: clear,
    renameConversation: rename,
    getConversation,
  };
}
