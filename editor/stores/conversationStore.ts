import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Message, ContentBlock } from '../services/llm/types';

// 会话
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  provider?: string;
}

// 会话状态
export interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;

  // Actions
  createConversation: (title?: string) => string;
  deleteConversation: (id: string) => void;
  setCurrentConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageIndex: number, content: string | ContentBlock[]) => void;
  appendToMessage: (conversationId: string, messageIndex: number, content: string) => void;
  clearMessages: (conversationId: string) => void;
  renameConversation: (id: string, title: string) => void;
  getCurrentConversation: () => Conversation | null;
  getConversation: (id: string) => Conversation | undefined;
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      conversations: [],
      currentConversationId: null,

      createConversation: (title) => {
        const id = uuidv4();
        const now = Date.now();
        const newConversation: Conversation = {
          id,
          title: title || `新对话 ${get().conversations.length + 1}`,
          messages: [],
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          currentConversationId: id,
        }));

        return id;
      },

      deleteConversation: (id) =>
        set((state) => {
          const newConversations = state.conversations.filter((c) => c.id !== id);
          const newCurrentId =
            state.currentConversationId === id
              ? newConversations[0]?.id || null
              : state.currentConversationId;

          return {
            conversations: newConversations,
            currentConversationId: newCurrentId,
          };
        }),

      setCurrentConversation: (id) => set({ currentConversationId: id }),

      addMessage: (conversationId, message) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [...c.messages, message],
                  updatedAt: Date.now(),
                }
              : c
          ),
        })),

      updateMessage: (conversationId, messageIndex, content) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m, i) =>
                    i === messageIndex ? { ...m, content } as Message : m
                  ) as Message[],
                  updatedAt: Date.now(),
                }
              : c
          ),
        })),

      appendToMessage: (conversationId, messageIndex, content) =>
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;

            return {
              ...c,
              messages: c.messages.map((m, i) => {
                if (i !== messageIndex) return m;

                const currentContent =
                  typeof m.content === 'string' ? m.content : '';
                return {
                  ...m,
                  content: currentContent + content,
                };
              }),
              updatedAt: Date.now(),
            };
          }),
        })),

      clearMessages: (conversationId) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [], updatedAt: Date.now() }
              : c
          ),
        })),

      renameConversation: (id, title) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title } : c
          ),
        })),

      getCurrentConversation: () => {
        const state = get();
        return (
          state.conversations.find((c) => c.id === state.currentConversationId) ||
          null
        );
      },

      getConversation: (id) => {
        return get().conversations.find((c) => c.id === id);
      },
    }),
    {
      name: 'protagonist-conversations',
      // 限制存储的会话数量
      partialize: (state) => ({
        conversations: state.conversations.slice(0, 50), // 最多保存 50 个会话
        currentConversationId: state.currentConversationId,
      }),
    }
  )
);
