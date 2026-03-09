import type { ToolDefinition } from '../llm/types';
import type { ITool, IToolRegistry, ToolContext, ToolResult } from './types';

/**
 * 工具注册表
 * 管理所有可用工具，提供注册、查询和执行功能
 */
export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, ITool> = new Map();

  /**
   * 注册工具
   */
  register(tool: ITool): void {
    if (this.tools.has(tool.definition.name)) {
      console.warn(`Tool "${tool.definition.name}" is already registered. Overwriting.`);
    }
    this.tools.set(tool.definition.name, tool);
  }

  /**
   * 注销工具
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }

  /**
   * 获取工具
   */
  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取所有工具
   */
  getAll(): ITool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取所有工具定义（用于 LLM 调用）
   */
  getAllDefinitions(): ToolDefinition[] {
    return this.getAll().map((tool) => tool.definition);
  }

  /**
   * 执行工具
   */
  async execute(
    name: string,
    params: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found. Available tools: ${this.getToolNames().join(', ')}`,
      };
    }

    // 验证参数
    if (tool.validateParams && !tool.validateParams(params)) {
      return {
        success: false,
        error: `Invalid parameters for tool "${name}"`,
      };
    }

    try {
      const result = await tool.execute(params, context);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * 获取所有工具名称
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * 获取需要确认的工具
   */
  getToolsRequiringConfirmation(): ITool[] {
    return this.getAll().filter((tool) => tool.requiresConfirmation);
  }

  /**
   * 获取危险等级高的工具
   */
  getHighDangerTools(): ITool[] {
    return this.getAll().filter((tool) => tool.dangerLevel === 'high');
  }
}

// 全局工具注册表实例
export const toolRegistry = new ToolRegistry();
