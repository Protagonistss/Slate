import type { ToolDefinition } from '../llm/types';

// 工具执行结果
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

// 工具执行上下文
export interface ToolContext {
  workingDirectory?: string;
  editorContent?: string;
  editorSelection?: {
    text: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
  openFiles?: string[];
  activeFile?: string;
  abortSignal?: AbortSignal;
}

// 工具接口
export interface ITool {
  // 工具定义（用于 LLM 调用）
  definition: ToolDefinition;

  // 执行工具
  execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;

  // 验证参数
  validateParams?(params: Record<string, unknown>): boolean;

  // 是否需要用户确认
  requiresConfirmation?: boolean;

  // 危险等级
  dangerLevel?: 'low' | 'medium' | 'high';
}

// 工具注册表类型
export interface IToolRegistry {
  register(tool: ITool): void;
  unregister(name: string): void;
  get(name: string): ITool | undefined;
  getAll(): ITool[];
  getAllDefinitions(): ToolDefinition[];
  execute(name: string, params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

// 文件操作类型
export interface FileReadParams {
  path: string;
  encoding?: 'utf-8' | 'binary';
}

export interface FileWriteParams {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'binary';
}

export interface DirectoryListParams {
  path: string;
  recursive?: boolean;
}

export interface FileDeleteParams {
  path: string;
  recursive?: boolean;
}

// Shell 命令类型
export interface ShellExecuteParams {
  command: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
}

// 编辑器操作类型
export interface EditorGetContentParams {
  // 无参数，获取当前内容
}

export interface EditorSetContentParams {
  content: string;
  language?: string;
}

export interface EditorInsertTextParams {
  text: string;
  position?: {
    line: number;
    column: number;
  };
}

export interface EditorReplaceSelectionParams {
  text: string;
}

// HTTP 请求类型
export interface HttpFetchParams {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  timeout?: number;
}
