import { invoke } from '@tauri-apps/api/core';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type {
  McpCallToolResult,
  McpServerMutationResponse,
  McpServerStatus,
  McpToolDescriptor,
  RemoveMcpServerInput,
  RetryMcpServerInput,
  SetMcpServerEnabledInput,
  UpsertMcpServerInput,
} from './types';

const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

export async function listMcpServers(): Promise<McpServerStatus[]> {
  if (!isTauri) return [];
  return invoke('list_mcp_servers');
}

export async function upsertMcpServer(
  request: UpsertMcpServerInput
): Promise<McpServerMutationResponse> {
  return invoke('upsert_mcp_server', { request });
}

export async function removeMcpServer(
  request: RemoveMcpServerInput
): Promise<McpServerMutationResponse> {
  return invoke('remove_mcp_server', { request });
}

export async function setMcpServerEnabled(
  request: SetMcpServerEnabledInput
): Promise<McpServerMutationResponse> {
  return invoke('set_mcp_server_enabled', { request });
}

export async function retryMcpServer(
  request: RetryMcpServerInput
): Promise<McpServerMutationResponse> {
  return invoke('retry_mcp_server', { request });
}

export async function listMcpTools(): Promise<McpToolDescriptor[]> {
  if (!isTauri) return [];
  return invoke('list_mcp_tools');
}

export async function callMcpTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<McpCallToolResult> {
  return invoke('call_mcp_tool', {
    request: {
      serverId,
      toolName,
      arguments: args,
    },
  });
}

export async function subscribeMcpServersUpdated(
  onUpdate: (servers: McpServerStatus[]) => void
): Promise<UnlistenFn> {
  if (!isTauri) {
    return () => {};
  }

  const { listen } = await import('@tauri-apps/api/event');
  return listen<McpServerStatus[]>('mcp://servers-updated', (event) => {
    onUpdate(event.payload);
  });
}

export async function subscribeMcpToolsUpdated(
  onUpdate: (tools: McpToolDescriptor[]) => void
): Promise<UnlistenFn> {
  if (!isTauri) {
    return () => {};
  }

  const { listen } = await import('@tauri-apps/api/event');
  return listen<McpToolDescriptor[]>('mcp://tools-updated', (event) => {
    onUpdate(event.payload);
  });
}

export * from './types';
