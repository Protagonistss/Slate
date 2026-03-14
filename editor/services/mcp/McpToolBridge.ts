import type { ToolDefinition } from '../llm/types';
import type { ITool, ToolResult } from '../tools';
import { toolRegistry } from '../tools';
import type { ToolContext } from '../tools/types';
import { callMcpTool } from './index';
import type { McpToolDescriptor } from './types';

function normalizeSchema(
  schema: Record<string, unknown> | undefined
): ToolDefinition['input_schema'] {
  const nextSchema =
    schema && typeof schema === 'object'
      ? { ...schema }
      : {};

  return {
    ...(nextSchema as ToolDefinition['input_schema']),
    type: 'object',
    properties:
      typeof nextSchema.properties === 'object' && nextSchema.properties !== null
        ? (nextSchema.properties as ToolDefinition['input_schema']['properties'])
        : {},
    required: Array.isArray(nextSchema.required)
      ? (nextSchema.required as string[])
      : undefined,
  };
}

class McpRemoteTool implements ITool {
  readonly definition;
  readonly requiresConfirmation = false;
  readonly dangerLevel = 'medium' as const;

  constructor(private readonly tool: McpToolDescriptor) {
    this.definition = {
      name: tool.registrationName,
      description: `[MCP:${tool.serverName}] ${tool.description || tool.name}`,
      input_schema: normalizeSchema(tool.inputSchema),
    };
  }

  async execute(
    params: Record<string, unknown>,
    _context: ToolContext
  ): Promise<ToolResult> {
    const result = await callMcpTool(this.tool.serverId, this.tool.name, params);
    if (result.isError) {
      return {
        success: false,
        error: JSON.stringify(result),
        data: result,
      };
    }

    return {
      success: true,
      data: result,
      metadata: {
        serverId: this.tool.serverId,
        toolName: this.tool.name,
      },
    };
  }
}

class McpToolBridge {
  private registeredTools = new Map<string, McpToolDescriptor>();

  sync(tools: McpToolDescriptor[]): void {
    const next = new Map(tools.map((tool) => [tool.registrationName, tool]));

    for (const [registrationName] of this.registeredTools) {
      if (!next.has(registrationName)) {
        toolRegistry.unregister(registrationName);
        this.registeredTools.delete(registrationName);
      }
    }

    for (const tool of tools) {
      const current = this.registeredTools.get(tool.registrationName);
      if (!current || JSON.stringify(current) !== JSON.stringify(tool)) {
        toolRegistry.register(new McpRemoteTool(tool));
        this.registeredTools.set(tool.registrationName, tool);
      }
    }
  }
}

export const mcpToolBridge = new McpToolBridge();
