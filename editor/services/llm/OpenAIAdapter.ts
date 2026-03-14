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
      const pendingToolCalls = new Map<number, {
        id: string;
        name: string;
        arguments: string;
      }>();

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
              const finishReason = parsed.choices?.[0]?.finish_reason;

              if (delta?.content) {
                yield { type: 'content', content: delta.content };
              }

              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  const index = toolCall.index ?? 0;
                  const current = pendingToolCalls.get(index) || {
                    id: '',
                    name: '',
                    arguments: '',
                  };

                  pendingToolCalls.set(index, {
                    id: toolCall.id || current.id,
                    name: toolCall.function?.name || current.name,
                    arguments: current.arguments + (toolCall.function?.arguments || ''),
                  });
                }
              }

              if (finishReason === 'tool_calls') {
                for (const toolCall of Array.from(pendingToolCalls.values())) {
                  if (!toolCall.name) continue;
                  yield {
                    type: 'tool_use',
                    toolUse: {
                      id: toolCall.id,
                      name: toolCall.name,
                      input: JSON.parse(toolCall.arguments || '{}'),
                    },
                  };
                }
                pendingToolCalls.clear();
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
    const formatted: unknown[] = [];

    for (const message of messages) {
      if (typeof message.content === 'string') {
        formatted.push({ role: message.role, content: message.content });
        continue;
      }

      const textBlocks = message.content.filter((block) => block.type === 'text');
      const toolUseBlocks = message.content.filter((block) => block.type === 'tool_use');
      const toolResultBlocks = message.content.filter((block) => block.type === 'tool_result');
      const imageBlocks = message.content.filter((block) => block.type === 'image');

      if (message.role === 'assistant' && toolUseBlocks.length > 0) {
        formatted.push({
          role: 'assistant',
          content: textBlocks
            .map((block) => ('text' in block ? block.text : ''))
            .join('') || null,
          tool_calls: toolUseBlocks.map((block) => ({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          })),
        });
        continue;
      }

      if (message.role === 'user' && toolResultBlocks.length > 0) {
        const textContent = textBlocks
          .map((block) => ('text' in block ? block.text : ''))
          .join('');

        if (textContent) {
          formatted.push({ role: 'user', content: textContent });
        }

        for (const block of toolResultBlocks) {
          formatted.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: block.content,
          });
        }
        continue;
      }

      if (imageBlocks.length > 0) {
        formatted.push({
          role: message.role,
          content: [
            ...textBlocks.map((block) => ({
              type: 'text',
              text: ('text' in block ? block.text : ''),
            })),
            ...imageBlocks.map((block) => ({
              type: 'image_url',
              image_url: {
                url: `data:${block.source.media_type};base64,${block.source.data}`,
              },
            })),
          ],
        });
        continue;
      }

      formatted.push({
        role: message.role,
        content: textBlocks
          .map((block) => ('text' in block ? block.text : ''))
          .join(''),
      });
    }

    return formatted;
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
