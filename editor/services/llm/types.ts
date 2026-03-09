// LLM Provider 类型
export type LLMProvider = 'openai' | 'anthropic' | 'ollama';

// 消息角色
export type MessageRole = 'system' | 'user' | 'assistant';

// 内容块类型
export type ContentBlockType = 'text' | 'image' | 'tool_use' | 'tool_result';

// 基础内容块
export interface BaseContentBlock {
  type: ContentBlockType;
}

// 文本内容块
export interface TextContentBlock extends BaseContentBlock {
  type: 'text';
  text: string;
}

// 图片内容块
export interface ImageContentBlock extends BaseContentBlock {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type: string;
    data: string;
  };
}

// 工具调用内容块
export interface ToolUseContentBlock extends BaseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// 工具结果内容块
export interface ToolResultContentBlock extends BaseContentBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// 内容块联合类型
export type ContentBlock =
  | TextContentBlock
  | ImageContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock;

// 基础消息
export interface BaseMessage {
  role: MessageRole;
  content: string | ContentBlock[];
}

// 系统消息
export interface SystemMessage extends BaseMessage {
  role: 'system';
  content: string;
}

// 用户消息
export interface UserMessage extends BaseMessage {
  role: 'user';
  content: string | ContentBlock[];
}

// 助手消息
export interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  content: string | ContentBlock[];
}

// 消息联合类型
export type Message = SystemMessage | UserMessage | AssistantMessage;

// 工具定义
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

// LLM 配置
export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

// 流式响应块
export interface StreamChunk {
  type: 'content' | 'tool_use' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolUse?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
  toolResult?: {
    tool_use_id: string;
    content: string;
    is_error?: boolean;
  };
  error?: string;
}

// LLM 适配器接口
export interface ILLMAdapter {
  // 发送消息并获取流式响应
  sendMessage(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal
  ): AsyncGenerator<StreamChunk>;

  // 停止生成
  stopGeneration(): void;

  // 获取可用模型列表
  getAvailableModels(): Promise<string[]>;

  // 验证配置
  validateConfig(): Promise<boolean>;
}

// OpenAI 特定配置
export interface OpenAIConfig extends LLMConfig {
  provider: 'openai';
}

// Anthropic 特定配置
export interface AnthropicConfig extends LLMConfig {
  provider: 'anthropic';
}

// Ollama 特定配置
export interface OllamaConfig extends LLMConfig {
  provider: 'ollama';
  baseUrl: string;
}
