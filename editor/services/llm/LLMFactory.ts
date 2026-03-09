import type { ILLMAdapter, LLMConfig, LLMProvider } from './types';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { OllamaAdapter } from './OllamaAdapter';

/**
 * LLM 适配器工厂
 * 根据配置创建对应的 LLM 适配器实例
 */
export class LLMFactory {
  private static adapters: Map<string, ILLMAdapter> = new Map();

  /**
   * 创建 LLM 适配器
   */
  static createAdapter(config: LLMConfig): ILLMAdapter {
    const key = this.getConfigKey(config);

    // 如果已存在相同配置的适配器，返回缓存
    if (this.adapters.has(key)) {
      return this.adapters.get(key)!;
    }

    let adapter: ILLMAdapter;

    switch (config.provider) {
      case 'openai':
        adapter = new OpenAIAdapter(config as import('./types').OpenAIConfig);
        break;
      case 'anthropic':
        adapter = new AnthropicAdapter(config as import('./types').AnthropicConfig);
        break;
      case 'ollama':
        adapter = new OllamaAdapter({
          ...config,
          provider: 'ollama',
          baseUrl: config.baseUrl || 'http://localhost:11434',
        } as import('./types').OllamaConfig);
        break;
      default:
        throw new Error(`Unknown LLM provider: ${(config as { provider: string }).provider}`);
    }

    this.adapters.set(key, adapter);
    return adapter;
  }

  /**
   * 获取或创建适配器
   */
  static getAdapter(config: LLMConfig): ILLMAdapter {
    return this.createAdapter(config);
  }

  /**
   * 清除适配器缓存
   */
  static clearCache(): void {
    this.adapters.clear();
  }

  /**
   * 移除指定配置的适配器
   */
  static removeAdapter(config: LLMConfig): void {
    const key = this.getConfigKey(config);
    this.adapters.delete(key);
  }

  /**
   * 获取配置的唯一键
   */
  private static getConfigKey(config: LLMConfig): string {
    return `${config.provider}:${config.model}:${config.baseUrl || 'default'}`;
  }
}

/**
 * 创建默认配置
 */
export function createDefaultConfig(provider: LLMProvider): LLMConfig {
  switch (provider) {
    case 'openai':
      return {
        provider: 'openai',
        model: 'gpt-4o-mini',
        maxTokens: 4096,
        temperature: 0.7,
      };
    case 'anthropic':
      return {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6-20250514',
        maxTokens: 4096,
        temperature: 0.7,
      };
    case 'ollama':
      return {
        provider: 'ollama',
        model: 'llama3.2',
        baseUrl: 'http://localhost:11434',
        maxTokens: 4096,
        temperature: 0.7,
      };
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
