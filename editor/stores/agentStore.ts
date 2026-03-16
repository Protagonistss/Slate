import { create } from 'zustand';
import { toolRegistry } from '../services/tools';
import { streamBackendLLMChat } from '@/services/backend/llm';
import type {
  ContentBlock,
  LLMConfig,
  Message,
  StreamChunk,
  ToolDefinition,
  ToolResultContentBlock,
  ToolUseContentBlock,
} from '../services/llm/types';
import type { ToolContext, ToolResult } from '../services/tools';
import { useAuthStore } from './authStore';
import { useConfigStore } from './configStore';
import { useConversationStore } from './conversationStore';

export type AgentStatus = 'idle' | 'thinking' | 'streaming' | 'tool_call' | 'error';

export interface ToolCallRecord {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: unknown;
  error?: string;
}

interface MessageContext {
  conversationId: string;
  tools: ToolDefinition[];
  toolContext: ToolContext;
  llmConfig: LLMConfig;
  accessToken: string;
  systemPrompt?: string;
}

interface AssistantAccumulator {
  plainText: string;
  blocks: ContentBlock[];
  toolUses: ToolUseContentBlock[];
}

export interface AgentState {
  status: AgentStatus;
  isProcessing: boolean;
  currentStreamContent: string;
  currentToolCalls: ToolCallRecord[];
  error: string | null;
  abortController: AbortController | null;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  executeToolCall: (name: string, input: Record<string, unknown>) => Promise<ToolResult>;
  setStatus: (status: AgentStatus) => void;
  clearError: () => void;
  reset: () => void;
}

function getCurrentMessages(
  conversationId: string,
  systemPrompt?: string
): Message[] {
  const conversationStore = useConversationStore.getState();
  const conversation = conversationStore.getConversation(conversationId);
  const messages = conversation ? [...conversation.messages] : [];

  if (systemPrompt) {
    messages.unshift({
      role: 'system',
      content: systemPrompt,
    });
  }

  return messages;
}

function appendAssistantText(
  conversationId: string,
  assistantMessageIndex: number,
  accumulator: AssistantAccumulator,
  chunk: string
): void {
  const conversationStore = useConversationStore.getState();

  if (accumulator.blocks.length === 0) {
    accumulator.plainText += chunk;
    conversationStore.updateMessage(
      conversationId,
      assistantMessageIndex,
      accumulator.plainText
    );
    return;
  }

  const lastBlock = accumulator.blocks[accumulator.blocks.length - 1];
  if (lastBlock?.type === 'text') {
    lastBlock.text += chunk;
  } else {
    accumulator.blocks.push({
      type: 'text',
      text: chunk,
    });
  }

  conversationStore.updateMessage(
    conversationId,
    assistantMessageIndex,
    [...accumulator.blocks]
  );
}

function appendAssistantToolUse(
  conversationId: string,
  assistantMessageIndex: number,
  accumulator: AssistantAccumulator,
  toolUse: ToolUseContentBlock
): void {
  const conversationStore = useConversationStore.getState();

  if (accumulator.blocks.length === 0 && accumulator.plainText) {
    accumulator.blocks.push({
      type: 'text',
      text: accumulator.plainText,
    });
  }

  accumulator.blocks.push(toolUse);
  accumulator.toolUses.push(toolUse);

  conversationStore.updateMessage(
    conversationId,
    assistantMessageIndex,
    [...accumulator.blocks]
  );
}

function createAssistantMessage(
  conversationId: string
): number {
  const conversationStore = useConversationStore.getState();
  const conversation = conversationStore.getConversation(conversationId);
  const assistantMessageIndex = conversation?.messages.length || 0;
  conversationStore.addMessage(conversationId, {
    role: 'assistant',
    content: '',
  });
  return assistantMessageIndex;
}

function buildConversationTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '新对话';
  }

  const title = normalized.slice(0, 48);
  return normalized.length > 48 ? `${title}...` : title;
}

function prepareMessageContext(content: string): MessageContext | null {
  const conversationStore = useConversationStore.getState();
  const configStore = useConfigStore.getState();
  const authStore = useAuthStore.getState();

  const accessToken = authStore.accessToken;
  if (!accessToken) {
    return null;
  }

  let conversationId = conversationStore.currentConversationId;
  const suggestedTitle = buildConversationTitle(content);

  if (!conversationId) {
    conversationId = conversationStore.createConversation(suggestedTitle);
  } else {
    const currentConversation = conversationStore.getConversation(conversationId);
    const canReplacePlaceholderTitle =
      currentConversation &&
      currentConversation.messages.length === 0 &&
      /^新对话(?:\s+\d+)?$/.test(currentConversation.title);

    if (canReplacePlaceholderTitle) {
      conversationStore.renameConversation(conversationId, suggestedTitle);
    }
  }

  conversationStore.addMessage(conversationId, {
    role: 'user',
    content,
  });

  const llmConfig = configStore.getCurrentLLMConfig();
  if (!llmConfig.provider || !llmConfig.model) {
    return null;
  }

  return {
    conversationId,
    accessToken,
    llmConfig,
    tools: toolRegistry.getAllDefinitions(),
    toolContext: {
      workingDirectory: configStore.workingDirectory,
    },
    systemPrompt: configStore.llmConfigs[configStore.currentProvider].systemPrompt,
  };
}

function serializeToolResult(toolResult: ToolResult): string {
  if (toolResult.data !== undefined) {
    return typeof toolResult.data === 'string'
      ? toolResult.data
      : JSON.stringify(toolResult.data);
  }

  return toolResult.error || 'Tool execution failed';
}

async function executeToolUses(
  toolUses: ToolUseContentBlock[],
  conversationId: string,
  setState: (partial: Partial<AgentState> | ((state: AgentState) => Partial<AgentState>)) => void,
  executeToolCallFn: (name: string, input: Record<string, unknown>) => Promise<ToolResult>
): Promise<void> {
  const conversationStore = useConversationStore.getState();

  for (const toolUse of toolUses) {
    const pendingRecord: ToolCallRecord = {
      id: toolUse.id,
      name: toolUse.name,
      input: toolUse.input,
      status: 'running',
    };

    setState((state) => ({
      status: 'tool_call',
      currentToolCalls: [...state.currentToolCalls, pendingRecord],
    }));

    const toolResult = await executeToolCallFn(toolUse.name, toolUse.input);
    const resultContent = serializeToolResult(toolResult);
    const resultBlock: ToolResultContentBlock = {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: resultContent,
      is_error: !toolResult.success,
    };

    conversationStore.addMessage(conversationId, {
      role: 'user',
      content: [resultBlock],
    });

    if (toolResult.success) {
      setState((state) => ({
        currentToolCalls: state.currentToolCalls.map((toolCall) =>
          toolCall.id === toolUse.id
            ? {
                ...toolCall,
                status: 'success',
                result: toolResult.data,
              }
            : toolCall
        ),
      }));
    } else {
      setState((state) => ({
        currentToolCalls: state.currentToolCalls.map((toolCall) =>
          toolCall.id === toolUse.id
            ? {
                ...toolCall,
                status: 'error',
                result: toolResult.data,
                error: toolResult.error,
              }
            : toolCall
        ),
      }));
    }
  }
}

export const useAgentStore = create<AgentState>((set, get) => ({
  status: 'idle',
  isProcessing: false,
  currentStreamContent: '',
  currentToolCalls: [],
  error: null,
  abortController: null,

  sendMessage: async (content: string) => {
    const accessToken = useAuthStore.getState().accessToken;

    if (!accessToken) {
      set({
        status: 'error',
        error: '请先登录 backend 账号',
        isProcessing: false,
      });
      return;
    }

    const context = prepareMessageContext(content);
    if (!context) {
      set({
        status: 'error',
        error: '无法准备模型调用上下文',
        isProcessing: false,
      });
      return;
    }

    const abortController = new AbortController();

    set({
      status: 'thinking',
      isProcessing: true,
      currentStreamContent: '',
      currentToolCalls: [],
      error: null,
      abortController,
    });

    try {
      while (!abortController.signal.aborted) {
        const messages = getCurrentMessages(
          context.conversationId,
          context.systemPrompt
        );
        const assistantMessageIndex = createAssistantMessage(context.conversationId);
        const accumulator: AssistantAccumulator = {
          plainText: '',
          blocks: [],
          toolUses: [],
        };
        let streamFailed = false;

        for await (const chunk of streamBackendLLMChat(
          context.accessToken,
          {
            // 当前会话只保存在本地 store，不能把本地 UUID 当作 backend conversation_id 传过去。
            provider: context.llmConfig.provider,
            model: context.llmConfig.model,
            messages,
            tools: context.tools,
            temperature: context.llmConfig.temperature,
            max_tokens: context.llmConfig.maxTokens,
          },
          abortController.signal
        )) {
          if (abortController.signal.aborted) {
            break;
          }

          switch (chunk.type) {
            case 'content':
              set({ status: 'streaming' });
              appendAssistantText(
                context.conversationId,
                assistantMessageIndex,
                accumulator,
                chunk.content || ''
              );
              set({
                currentStreamContent: accumulator.plainText,
              });
              break;

            case 'tool_use':
              if (chunk.toolUse) {
                appendAssistantToolUse(
                  context.conversationId,
                  assistantMessageIndex,
                  accumulator,
                  {
                    type: 'tool_use',
                    id: chunk.toolUse.id,
                    name: chunk.toolUse.name,
                    input: chunk.toolUse.input,
                  }
                );
              }
              break;

            case 'error':
              set({
                status: 'error',
                error: chunk.error || 'Unknown error',
                isProcessing: false,
                abortController: null,
              });
              streamFailed = true;
              break;

            case 'done':
              break;

            default:
              break;
          }

          if (streamFailed) {
            break;
          }
        }

        if (streamFailed || abortController.signal.aborted) {
          return;
        }

        set({ currentStreamContent: '' });

        if (accumulator.toolUses.length === 0) {
          break;
        }

        await executeToolUses(
          accumulator.toolUses,
          context.conversationId,
          set,
          get().executeToolCall
        );

        set({ status: 'thinking' });
      }

      set({
        status: 'idle',
        isProcessing: false,
        currentStreamContent: '',
        abortController: null,
      });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        isProcessing: false,
        abortController: null,
      });
    }
  },

  stopGeneration: () => {
    const { abortController } = get();
    abortController?.abort();
    set({
      status: 'idle',
      isProcessing: false,
      currentStreamContent: '',
      abortController: null,
    });
  },

  executeToolCall: async (name: string, input: Record<string, unknown>) => {
    const configStore = useConfigStore.getState();
    const context: ToolContext = {
      workingDirectory: configStore.workingDirectory,
    };

    return toolRegistry.execute(name, input, context);
  },

  setStatus: (status) => set({ status }),

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      status: 'idle',
      isProcessing: false,
      currentStreamContent: '',
      currentToolCalls: [],
      error: null,
      abortController: null,
    }),
}));
