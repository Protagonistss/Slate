import { create } from 'zustand';
import { LLMFactory, createDefaultConfig } from '../services/llm';
import { toolRegistry } from '../services/tools';
import type {
  LLMConfig,
  Message,
  StreamChunk,
  ToolDefinition,
  ContentBlock,
} from '../services/llm/types';
import type { ToolContext } from '../services/tools';
import { useConfigStore } from './configStore';
import { useConversationStore } from './conversationStore';

// Agent 处理状态
export type AgentStatus = 'idle' | 'thinking' | 'streaming' | 'tool_call' | 'error';

// 工具调用记录
export interface ToolCallRecord {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: unknown;
  error?: string;
}

// Agent 状态
export interface AgentState {
  // 处理状态
  status: AgentStatus;
  isProcessing: boolean;

  // 当前流式内容
  currentStreamContent: string;

  // 当前工具调用
  currentToolCalls: ToolCallRecord[];

  // 错误信息
  error: string | null;

  // AbortController
  abortController: AbortController | null;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  executeToolCall: (name: string, input: Record<string, unknown>) => Promise<unknown>;
  setStatus: (status: AgentStatus) => void;
  clearError: () => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  status: 'idle',
  isProcessing: false,
  currentStreamContent: '',
  currentToolCalls: [],
  error: null,
  abortController: null,

  sendMessage: async (content: string) => {
    const conversationStore = useConversationStore.getState();
    const configStore = useConfigStore.getState();

    // 确保有当前会话
    let conversationId = conversationStore.currentConversationId;
    if (!conversationId) {
      conversationId = conversationStore.createConversation();
    }

    // 添加用户消息
    const userMessage: Message = {
      role: 'user',
      content,
    };
    conversationStore.addMessage(conversationId, userMessage);

    // 获取 LLM 配置
    const llmConfig = configStore.getCurrentLLMConfig();

    if (!llmConfig.apiKey && llmConfig.provider !== 'ollama') {
      set({
        status: 'error',
        error: '请先配置 API Key',
        isProcessing: false,
      });
      return;
    }

    // 创建适配器
    const adapter = LLMFactory.createAdapter(llmConfig);

    // 准备消息历史
    const conversation = conversationStore.getConversation(conversationId);
    const messages: Message[] = conversation
      ? conversation.messages
      : [userMessage];

    // 添加系统提示
    const systemPrompt = configStore.llmConfigs[configStore.currentProvider].systemPrompt;
    if (systemPrompt && !messages.find((m) => m.role === 'system')) {
      messages.unshift({
        role: 'system',
        content: systemPrompt,
      });
    }

    // 获取工具定义
    const tools = toolRegistry.getAllDefinitions();

    // 创建 AbortController
    const abortController = new AbortController();
    set({
      status: 'thinking',
      isProcessing: true,
      currentStreamContent: '',
      currentToolCalls: [],
      error: null,
      abortController,
    });

    // 添加助手消息占位
    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
    };
    conversationStore.addMessage(conversationId, assistantMessage);
    const assistantMessageIndex = (conversation?.messages.length || 0) + 1;

    try {
      // 构建工具上下文
      const toolContext: ToolContext = {
        workingDirectory: configStore.workingDirectory,
      };

      // 流式处理响应
      for await (const chunk of adapter.sendMessage(messages, tools, abortController.signal)) {
        if (abortController.signal.aborted) break;

        switch (chunk.type) {
          case 'content':
            set({ status: 'streaming' });
            const newContent = get().currentStreamContent + (chunk.content || '');
            set({ currentStreamContent: newContent });
            conversationStore.updateMessage(conversationId, assistantMessageIndex, newContent);
            break;

          case 'tool_use':
            set({ status: 'tool_call' });
            if (chunk.toolUse) {
              // 记录工具调用
              const toolCall: ToolCallRecord = {
                id: chunk.toolUse.id,
                name: chunk.toolUse.name,
                input: chunk.toolUse.input,
                status: 'pending',
              };
              set((state) => ({
                currentToolCalls: [...state.currentToolCalls, toolCall],
              }));

              // 执行工具
              try {
                const result = await get().executeToolCall(
                  chunk.toolUse.name,
                  chunk.toolUse.input
                );

                // 更新工具调用状态
                set((state) => ({
                  currentToolCalls: state.currentToolCalls.map((tc) =>
                    tc.id === chunk.toolUse!.id
                      ? { ...tc, status: 'success', result }
                      : tc
                  ),
                }));

                // 将工具结果添加到消息
                const toolResultMessage: Message = {
                  role: 'user',
                  content: [
                    {
                      type: 'tool_result',
                      tool_use_id: chunk.toolUse.id,
                      content: JSON.stringify(result),
                    },
                  ],
                };
                conversationStore.addMessage(conversationId, toolResultMessage);
              } catch (error) {
                set((state) => ({
                  currentToolCalls: state.currentToolCalls.map((tc) =>
                    tc.id === chunk.toolUse!.id
                      ? {
                          ...tc,
                          status: 'error',
                          error: error instanceof Error ? error.message : 'Unknown error',
                        }
                      : tc
                  ),
                }));
              }
            }
            break;

          case 'error':
            set({
              status: 'error',
              error: chunk.error || 'Unknown error',
              isProcessing: false,
            });
            return;

          case 'done':
            set({
              status: 'idle',
              isProcessing: false,
              currentStreamContent: '',
            });
            return;
        }
      }
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        isProcessing: false,
      });
    }
  },

  stopGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      status: 'idle',
      isProcessing: false,
      currentStreamContent: '',
    });
  },

  executeToolCall: async (name: string, input: Record<string, unknown>) => {
    const configStore = useConfigStore.getState();

    const context: ToolContext = {
      workingDirectory: configStore.workingDirectory,
    };

    const result = await toolRegistry.execute(name, input, context);

    if (!result.success) {
      throw new Error(result.error || 'Tool execution failed');
    }

    return result.data;
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
