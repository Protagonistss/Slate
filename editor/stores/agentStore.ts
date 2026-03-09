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

// 消息处理上下文
interface MessageContext {
  conversationId: string;
  messages: Message[];
  assistantMessageIndex: number;
  tools: ToolDefinition[];
  toolContext: ToolContext;
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

// ========== 辅助函数 ==========

/**
 * 准备消息处理上下文
 */
function prepareMessageContext(content: string): MessageContext | null {
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
    return null;
  }

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

  // 构建工具上下文
  const toolContext: ToolContext = {
    workingDirectory: configStore.workingDirectory,
  };

  // 添加助手消息占位
  const assistantMessage: Message = {
    role: 'assistant',
    content: '',
  };
  conversationStore.addMessage(conversationId, assistantMessage);
  const assistantMessageIndex = (conversation?.messages.length || 0) + 1;

  return {
    conversationId,
    messages,
    assistantMessageIndex,
    tools,
    toolContext,
  };
}

/**
 * 处理工具执行
 */
async function handleToolExecution(
  chunk: { toolUse: { id: string; name: string; input: Record<string, unknown> } },
  conversationId: string,
  context: MessageContext,
  setState: (partial: Partial<AgentState> | ((state: AgentState) => Partial<AgentState>)) => void,
  executeToolCallFn: (name: string, input: Record<string, unknown>) => Promise<unknown>
): Promise<void> {
  const conversationStore = useConversationStore.getState();

  // 记录工具调用
  const toolCall: ToolCallRecord = {
    id: chunk.toolUse.id,
    name: chunk.toolUse.name,
    input: chunk.toolUse.input,
    status: 'pending',
  };
  setState((state) => ({
    currentToolCalls: [...state.currentToolCalls, toolCall],
  }));

  // 执行工具
  try {
    const result = await executeToolCallFn(
      chunk.toolUse.name,
      chunk.toolUse.input
    );

    // 更新工具调用状态
    setState((state) => ({
      currentToolCalls: state.currentToolCalls.map((tc) =>
        tc.id === chunk.toolUse!.id
          ? { ...tc, status: 'success' as const, result }
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
        } as ContentBlock,
      ],
    };
    conversationStore.addMessage(conversationId, toolResultMessage);
  } catch (error) {
    setState((state) => ({
      currentToolCalls: state.currentToolCalls.map((tc) =>
        tc.id === chunk.toolUse!.id
          ? {
              ...tc,
              status: 'error' as const,
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          : tc
      ),
    }));
  }
}

/**
 * 处理流式响应块
 */
async function processStreamChunk(
  chunk: StreamChunk,
  context: MessageContext,
  abortController: AbortController,
  setState: (partial: Partial<AgentState> | ((state: AgentState) => Partial<AgentState>)) => void,
  executeToolCallFn: (name: string, input: Record<string, unknown>) => Promise<unknown>
): Promise<boolean> {
  const conversationStore = useConversationStore.getState();
  const get = useAgentStore.getState();

  switch (chunk.type) {
    case 'content':
      setState({ status: 'streaming' });
      const newContent = get.currentStreamContent + (chunk.content || '');
      setState({ currentStreamContent: newContent });
      conversationStore.updateMessage(
        context.conversationId,
        context.assistantMessageIndex,
        newContent
      );
      return true;

    case 'tool_use':
      setState({ status: 'tool_call' });
      if (chunk.toolUse) {
        await handleToolExecution(
          { toolUse: chunk.toolUse },
          context.conversationId,
          context,
          setState,
          executeToolCallFn
        );
      }
      return true;

    case 'error':
      setState({
        status: 'error',
        error: chunk.error || 'Unknown error',
        isProcessing: false,
      });
      return false;

    case 'done':
      setState({
        status: 'idle',
        isProcessing: false,
        currentStreamContent: '',
      });
      return false;

    default:
      return true;
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
    const configStore = useConfigStore.getState();
    const llmConfig = configStore.getCurrentLLMConfig();

    // 验证 API Key
    if (!llmConfig.apiKey && llmConfig.provider !== 'ollama') {
      set({
        status: 'error',
        error: '请先配置 API Key',
        isProcessing: false,
      });
      return;
    }

    // 准备消息上下文
    const context = prepareMessageContext(content);
    if (!context) {
      set({
        status: 'error',
        error: '无法准备消息上下文',
        isProcessing: false,
      });
      return;
    }

    // 创建适配器
    const adapter = LLMFactory.createAdapter(llmConfig);

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

    try {
      // 流式处理响应
      for await (const chunk of adapter.sendMessage(
        context.messages,
        context.tools,
        abortController.signal
      )) {
        if (abortController.signal.aborted) break;

        const shouldContinue = await processStreamChunk(
          chunk,
          context,
          abortController,
          set,
          get().executeToolCall
        );

        if (!shouldContinue) break;
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
