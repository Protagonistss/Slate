import { BaseAdapter } from './BaseAdapter';
import type {
  Message,
  StreamChunk,
  ToolDefinition,
  AnthropicConfig,
  ContentBlock,
} from './types';

const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';

const DEFAULT_MODELS = [
  'claude-sonnet-4-6-20250514',
  'claude-opus-4-6-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
];

/**
 * Anthropic Claude API 适配器
 * 支持 Claude 3.5、Claude 4 等模型
 */
export class AnthropicAdapter extends BaseAdapter {
  constructor(config: AnthropicConfig) {
    super(config);
  }

  async *sendMessage(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal
  ): AsyncGenerator<StreamChunk> {
    const controller = this.createAbortController(signal);
    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;

    // 提取系统消息
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: this.formatMessages(conversationMessages),
      max_tokens: this.config.maxTokens || 4096,
      stream: true,
    };

    if (systemMessage) {
      body.system = typeof systemMessage.content === 'string'
        ? systemMessage.content
        : '';
    }

    if (this.config.temperature !== undefined) {
      body.temperature = this.config.temperature;
    }

    // 添加工具定义
    if (tools && tools.length > 0) {
      body.tools = this.formatTools(tools);
    }

    try {
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.error?.message || `Anthropic API error: ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            try {
              const event = JSON.parse(data);

              if (event.type === 'content_block_delta') {
                if (event.delta?.type === 'text_delta') {
                  yield { type: 'content', content: event.delta.text };
                }
              }

              if (event.type === 'content_block_start') {
                const block = event.content_block;
                if (block?.type === 'tool_use') {
                  yield {
                    type: 'tool_use',
                    toolUse: {
                      id: block.id,
                      name: block.name,
                      input: block.input || {},
                    },
                  };
                }
              }

              if (event.type === 'message_stop') {
                yield { type: 'done' };
                return;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      yield { type: 'done' };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        yield { type: 'done' };
        return;
      }
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getAvailableModels(): Promise<string[]> {
    // Anthropic 不提供模型列表 API，返回默认模型
    return DEFAULT_MODELS;
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false;
    }

    // 发送一个简单的测试请求
    try {
      const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });

      return response.ok || response.status === 400; // 400 可能是 token 太少
    } catch {
      return false;
    }
  }

  // 格式化消息为 Anthropic 格式
  private formatMessages(messages: Message[]): unknown[] {
    return messages.map((msg) => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      }

      // 处理多内容块
      const content: ContentBlock[] = (msg.content as ContentBlock[]).map((block) => {
        if (block.type === 'text') {
          return { type: 'text', text: block.text };
        }
        if (block.type === 'image') {
          return {
            type: 'image',
            source: block.source,
          };
        }
        if (block.type === 'tool_result') {
          return {
            type: 'tool_result',
            tool_use_id: block.tool_use_id,
            content: block.content,
            is_error: block.is_error,
          };
        }
        return block;
      });

      return { role: msg.role, content };
    });
  }

  // 格式化工具定义为 Anthropic 格式
  private formatTools(tools: ToolDefinition[]): unknown[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));
  }
}
