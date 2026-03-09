import { BaseAdapter } from './BaseAdapter';
import type {
  Message,
  StreamChunk,
  ToolDefinition,
  OllamaConfig,
} from './types';

const DEFAULT_BASE_URL = 'http://localhost:11434';

/**
 * Ollama 本地模型适配器
 * 支持本地运行的 LLaMA、Mistral、CodeLlama 等模型
 */
export class OllamaAdapter extends BaseAdapter {
  constructor(config: OllamaConfig) {
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
      stream: true,
    };

    if (this.config.temperature !== undefined) {
      body.options = { temperature: this.config.temperature };
    }

    // Ollama 对工具的支持有限，仅在支持的模型中启用
    if (tools && tools.length > 0) {
      body.tools = this.formatTools(tools);
    }

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Ollama API error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.message?.content) {
              yield { type: 'content', content: data.message.content };
            }

            if (data.message?.tool_calls) {
              for (const toolCall of data.message.tool_calls) {
                yield {
                  type: 'tool_use',
                  toolUse: {
                    id: toolCall.function?.name || Date.now().toString(),
                    name: toolCall.function?.name || 'unknown',
                    input: JSON.parse(toolCall.function?.arguments || '{}'),
                  },
                };
              }
            }

            if (data.done) {
              yield { type: 'done' };
              return;
            }
          } catch {
            // 忽略解析错误
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
    try {
      const baseUrl = this.config.baseUrl || DEFAULT_BASE_URL;
      const response = await fetch(`${baseUrl}/api/tags`);

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.models?.map((model: { name: string }) => model.name) || [];
    } catch {
      return [];
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      const models = await this.getAvailableModels();
      return models.length > 0;
    } catch {
      return false;
    }
  }

  // 格式化消息为 Ollama 格式
  private formatMessages(messages: Message[]): unknown[] {
    return messages.map((msg) => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      }

      // Ollama 对多内容块的支持有限，转换为文本
      const textContent = (msg.content as unknown[])
        .map((block: unknown) => {
          const b = block as { type: string; text?: string };
          if (b.type === 'text' && b.text) {
            return b.text;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');

      return { role: msg.role, content: textContent };
    });
  }

  // 格式化工具定义为 Ollama 格式
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
