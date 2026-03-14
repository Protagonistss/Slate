export type McpConfigScope = 'global' | 'project';

export type McpServerStatusKind =
  | 'disabled'
  | 'approvalRequired'
  | 'unsupported'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface McpCapabilitySummary {
  tools: boolean;
  resources: boolean;
  prompts: boolean;
}

export type McpTransportConfig =
  | {
      type: 'stdio';
      command: string;
      args: string[];
    }
  | {
      type: 'sse';
      url: string;
    };

export interface McpServerConfig {
  id: string;
  name: string;
  enabled: boolean;
  transport: McpTransportConfig;
  cwd?: string | null;
  env: Record<string, string>;
  approvalFingerprint?: string | null;
}

export interface McpServerStatus {
  id: string;
  name: string;
  enabled: boolean;
  scope: McpConfigScope;
  config: McpServerConfig;
  status: McpServerStatusKind;
  transportType: string;
  transportSummary: string;
  toolCount: number;
  requiresApproval: boolean;
  unsupportedReason?: string | null;
  error?: string | null;
  capabilities: McpCapabilitySummary;
}

export interface McpToolDescriptor {
  serverId: string;
  serverName: string;
  name: string;
  description?: string | null;
  registrationName: string;
  inputSchema: Record<string, unknown>;
}

export interface McpCallToolResult {
  content: unknown[];
  structuredContent?: unknown;
  isError: boolean;
}

export interface McpServerMutationResponse {
  servers: McpServerStatus[];
  targetServer?: McpServerStatus | null;
}

export interface UpsertMcpServerInput {
  scope: McpConfigScope;
  server: McpServerConfig;
  approve?: boolean;
}

export interface RemoveMcpServerInput {
  scope: McpConfigScope;
  id: string;
}

export interface SetMcpServerEnabledInput {
  scope: McpConfigScope;
  id: string;
  enabled: boolean;
  approve?: boolean;
}

export interface RetryMcpServerInput {
  scope: McpConfigScope;
  id: string;
  approve?: boolean;
}
