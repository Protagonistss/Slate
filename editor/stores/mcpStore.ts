import { create } from 'zustand';
import type { UnlistenFn } from '@tauri-apps/api/event';
import {
  listMcpServers,
  listMcpTools,
  removeMcpServer,
  retryMcpServer,
  setMcpServerEnabled,
  subscribeMcpServersUpdated,
  subscribeMcpToolsUpdated,
  upsertMcpServer,
} from '../services/mcp';
import { mcpToolBridge } from '../services/mcp/McpToolBridge';
import type {
  McpServerStatus,
  McpToolDescriptor,
  RetryMcpServerInput,
  SetMcpServerEnabledInput,
  UpsertMcpServerInput,
} from '../services/mcp';

interface McpState {
  servers: McpServerStatus[];
  tools: McpToolDescriptor[];
  initialized: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  saveServer: (request: UpsertMcpServerInput) => Promise<McpServerStatus | null>;
  deleteServer: (scope: 'global' | 'project', id: string) => Promise<void>;
  toggleServer: (request: SetMcpServerEnabledInput) => Promise<McpServerStatus | null>;
  retryServer: (request: RetryMcpServerInput) => Promise<McpServerStatus | null>;
  clearError: () => void;
}

let serverUnlisten: UnlistenFn | null = null;
let toolUnlisten: UnlistenFn | null = null;
let initializePromise: Promise<void> | null = null;

function getTargetServer(
  response: { targetServer?: McpServerStatus | null }
): McpServerStatus | null {
  return response.targetServer ?? null;
}

export const useMcpStore = create<McpState>((set, get) => ({
  servers: [],
  tools: [],
  initialized: false,
  isLoading: false,
  error: null,

  initialize: async () => {
    if (get().initialized) {
      return;
    }

    if (!initializePromise) {
      initializePromise = (async () => {
        set({ isLoading: true, error: null });

        try {
          const [servers, tools] = await Promise.all([listMcpServers(), listMcpTools()]);
          mcpToolBridge.sync(tools);
          set({
            servers,
            tools,
            initialized: true,
            isLoading: false,
          });

          serverUnlisten?.();
          toolUnlisten?.();

          serverUnlisten = await subscribeMcpServersUpdated((nextServers) => {
            set({ servers: nextServers });
          });

          toolUnlisten = await subscribeMcpToolsUpdated((nextTools) => {
            mcpToolBridge.sync(nextTools);
            set({ tools: nextTools });
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '初始化 MCP 失败',
            isLoading: false,
          });
        } finally {
          initializePromise = null;
        }
      })();
    }

    await initializePromise;
  },

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const [servers, tools] = await Promise.all([listMcpServers(), listMcpTools()]);
      mcpToolBridge.sync(tools);
      set({ servers, tools, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '刷新 MCP 状态失败',
        isLoading: false,
      });
    }
  },

  saveServer: async (request) => {
    const response = await upsertMcpServer(request);
    set({ servers: response.servers, error: null });
    return getTargetServer(response);
  },

  deleteServer: async (scope, id) => {
    const response = await removeMcpServer({ scope, id });
    set({ servers: response.servers, error: null });
  },

  toggleServer: async (request) => {
    const response = await setMcpServerEnabled(request);
    set({ servers: response.servers, error: null });
    return getTargetServer(response);
  },

  retryServer: async (request) => {
    const response = await retryMcpServer(request);
    set({ servers: response.servers, error: null });
    return getTargetServer(response);
  },

  clearError: () => set({ error: null }),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    serverUnlisten?.();
    toolUnlisten?.();
  });
}
