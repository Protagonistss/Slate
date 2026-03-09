import type {
  ILLMAdapter,
  LLMConfig,
  Message,
  StreamChunk,
  ToolDefinition,
} from './types';

/**
 * LLM 适配器基类
 * 提供通用的配置管理和验证逻辑
 */
export abstract class BaseAdapter implements ILLMAdapter {
  protected abortController: AbortController | null = null;

  constructor(protected config: LLMConfig) {}

  // 抽象方法，子类必须实现
  abstract sendMessage(
    messages: Message[],
    tools?: ToolDefinition[],
    signal?: AbortSignal
  ): AsyncGenerator<StreamChunk>;

  abstract getAvailableModels(): Promise<string[]>;

  abstract validateConfig(): Promise<boolean>;

  // 停止生成
  stopGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // 更新配置
  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 获取当前配置
  getConfig(): LLMConfig {
    return this.config;
  }

  // 构建请求头
  protected buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  // 解析消息为 API 格式
  protected parseMessages(messages: Message[]): unknown[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  // 创建 AbortController
  protected createAbortController(signal?: AbortSignal): AbortController {
    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }
    this.abortController = controller;
    return controller;
  }
}
