// ConversationStore - 会话存储服务（文件存储)
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { sessionStorage } from '@/services/storage';
import type { StoredMessage } from '@/services/storage';
import type { Message, ContentBlock } from '@/services/llm/types';

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  provider?: string;
}

export interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoaded: boolean;

  createConversation: (title?: string) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  setCurrentConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Message) => Promise<void>;
  updateMessage: (conversationId: string, messageIndex: number, content: string | ContentBlock[]) => void;
  appendToMessage: (conversationId: string, messageIndex: number, content: string) => void;
  clearMessages: (conversationId: string) => Promise<void>;
  renameConversation: (id: string, title: string) => void;
  getCurrentConversation: () => Conversation | null;
  getConversation: (id: string) => Conversation | undefined;
  loadFromStorage: () => Promise<void>;
}

const persistQueues = new Map<string, Promise<void>>();

function toStoredMessage(message: Message): StoredMessage {
  return {
    role: message.role,
    content: message.content,
    timestamp: Date.now(),
  };
}

function toRuntimeMessage(message: StoredMessage): Message {
  switch (message.role) {
    case 'system':
      return {
        role: 'system',
        content: typeof message.content === 'string' ? message.content : '',
      };
    case 'user':
      return {
        role: 'user',
        content: message.content,
      };
    case 'assistant':
      return {
        role: 'assistant',
        content: message.content,
      };
    default:
      return {
        role: 'assistant',
        content: typeof message.content === 'string' ? message.content : '',
      };
  }
}

function enqueuePersistMessages(
  conversationId: string,
  getState: () => ConversationState
): Promise<void> {
  const previous = persistQueues.get(conversationId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      if (!sessionStorage.isAvailable()) {
        return;
      }

      const conversation = getState().conversations.find((item) => item.id === conversationId);
      if (!conversation) {
        return;
      }

      await sessionStorage.replaceMessages(
        conversationId,
        conversation.messages.map(toStoredMessage)
      );
    })
    .catch((error) => {
      console.error('[ConversationStore] Failed to persist messages:', error);
    })
    .finally(() => {
      if (persistQueues.get(conversationId) === next) {
        persistQueues.delete(conversationId);
      }
    });

  persistQueues.set(conversationId, next);
  return next;
}

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: [],
  currentConversationId: null,
  isLoaded: false,

  createConversation: async (title) => {
    const id = uuidv4();
    const now = Date.now();
    const newConversation: Conversation = {
      id,
      title: title || `新对话`,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      conversations: [newConversation, ...state.conversations],
      currentConversationId: id,
    }));

    await sessionStorage.createSession({
      id,
      title: title || '新对话',
      projectPath: '',
      goal: '',
      provider: '',
      model: '',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },

  deleteConversation: async (id) => {
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
    });

    await sessionStorage.deleteSession(id);
  },

  setCurrentConversation: (id) => set({ currentConversationId: id }),

  addMessage: async (conversationId, message) => {
    let shouldUpdateTitle = false;
    let newTitle: string | undefined;

    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c;

        const messages = [...c.messages, message];
        let title = c.title;

        if (
          message.role === 'user' &&
          c.messages.length === 0 &&
          typeof message.content === 'string' &&
          c.title.startsWith('新对话')
        ) {
          shouldUpdateTitle = true;
          newTitle = message.content.slice(0, 50);
          title = newTitle;
        }

        return {
          ...c,
          messages,
          title,
          updatedAt: Date.now(),
        };
      }),
    }));

    await enqueuePersistMessages(conversationId, get);

    if (shouldUpdateTitle && newTitle) {
      await sessionStorage.updateSessionMeta(conversationId, { title: newTitle });
    }
  },

  updateMessage: (conversationId, messageIndex, content) => {
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
    }));

    void enqueuePersistMessages(conversationId, get);
  },

  appendToMessage: (conversationId, messageIndex, content) => {
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
    }));

    void enqueuePersistMessages(conversationId, get);
  },

  clearMessages: async (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [], updatedAt: Date.now() }
          : c
      ),
    }));

    await enqueuePersistMessages(conversationId, get);
  },

  renameConversation: (id, title) => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title: nextTitle, updatedAt: Date.now() } : c
      ),
    }));

    if (!sessionStorage.isAvailable()) {
      return;
    }

    void sessionStorage.updateSessionMeta(id, { title: nextTitle }).catch((error) => {
      console.error('[ConversationStore] Failed to rename session:', error);
    });
  },

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

  loadFromStorage: async () => {
    if (!sessionStorage.isAvailable()) {
      set({ isLoaded: true });
      return;
    }

    try {
      const sessions = await sessionStorage.listSessions();
      const conversations: Conversation[] = await Promise.all(
        sessions.map(async (session) => {
          let storedMessages: StoredMessage[] = [];
          try {
            storedMessages = await sessionStorage.getMessages(session.id);
          } catch (error) {
            console.error(`[ConversationStore] Failed to load messages for session ${session.id}:`, error);
          }

          return {
            id: session.id,
            title: session.title,
            messages: storedMessages.map(toRuntimeMessage),
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            model: session.model,
            provider: session.provider,
          };
        })
      );

      set({ conversations, isLoaded: true });
    } catch (error) {
      console.error('[ConversationStore] Failed to load from storage:', error);
      set({ isLoaded: true });
    }
  },
}));
