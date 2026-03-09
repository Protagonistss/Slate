import { BaseAdapter } from './BaseAdapter';
import type {
  Message,
  StreamChunk,
  ToolDefinition,
  OpenAIConfig,
} from './types';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

const DEFAULT_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
];

/**
 * OpenAI API 适配器
 * 支持 GPT-4、GPT-3.5 等模型
 */
export class OpenAIAdapter extends BaseAdapter {
  constructor(config: OpenAIConfig) {
    super(config);
  }

  async *sendMessage(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal
  ): AsyncGenerator<StreamChunk> {
    const controller = this.createAbortController(signal);
    const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: this.formatMessages(messages),
      max_tokens: this.config.maxTokens || 4096,
      temperature: this.config.temperature ?? 0.7,
      stream: true,
    };

    // 添加工具定义
    if (tools && tools.length > 0) {
      body.tools = this.formatTools(tools);
      body.tool_choice = 'auto';
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.error?.message || `OpenAI API error: ${response.status}`
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
            if (data === '[DONE]') {
              yield { type: 'done' };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.content) {
                yield { type: 'content', content: delta.content };
              }

              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (toolCall.function?.name) {
                    yield {
                      type: 'tool_use',
                      toolUse: {
                        id: toolCall.id,
                        name: toolCall.function.name,
                        input: JSON.parse(toolCall.function.arguments || '{}'),
                      },
                    };
                  }
                }
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
    if (!this.config.apiKey) {
      return DEFAULT_MODELS;
    }

    try {
      const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      if (!response.ok) {
        return DEFAULT_MODELS;
      }

      const data = await response.json();
      return data.data
        .filter((model: { id: string }) =>
          model.id.includes('gpt') || model.id.includes('o1')
        )
        .map((model: { id: string }) => model.id)
        .sort();
    } catch {
      return DEFAULT_MODELS;
    }
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false;
    }

    try {
      const models = await this.getAvailableModels();
      return models.length > 0;
    } catch {
      return false;
    }
  }

  // 格式化消息为 OpenAI 格式
  private formatMessages(messages: Message[]): unknown[] {
    return messages.map((msg) => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      }

      // 处理多内容块
      const content = (msg.content as unknown[]).map((block: unknown) => {
        const b = block as { type: string; text?: string; source?: { data: string; media_type: string } };
        if (b.type === 'text') {
          return { type: 'text', text: b.text };
        }
        if (b.type === 'image') {
          return {
            type: 'image_url',
            image_url: {
              url: `data:${b.source?.media_type};base64,${b.source?.data}`,
            },
          };
        }
        return b;
      });

      return { role: msg.role, content };
    });
  }

  // 格式化工具定义为 OpenAI 格式
  private formatTools(tools: ToolDefinition[]): unknown[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }
}
