import { toolRegistry } from './ToolRegistry';

// 导出类型
export type {
  ToolResult,
  ToolContext,
  ITool,
  IToolRegistry,
} from './types';

// 导出工具注册表
export { ToolRegistry, toolRegistry } from './ToolRegistry';

/**
 * 初始化工具注册表
 * 注册所有可用工具
 */
export function initializeTools(): void {
  // 工具将在后续实现
}

// 自动初始化
initializeTools();
