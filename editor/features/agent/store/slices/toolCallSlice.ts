// Tool Call Slice - handles tool execution and tracking
import { StateCreator } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ToolCallRecord } from '../types';
import type { ToolResult } from '@/services/tools';
import { INTERNAL_AGENT_TOOL_SET, INTERNAL_AGENT_TOOL_NAMES } from '../types';
import type { ArtifactKind, AgentStepStatus, AgentReasoningPhase } from '../types';
import { toolRegistry } from '@/services/tools';
import { useConfigStore } from '@/stores/configStore';
import { useEditorStore } from '@/stores/editorStore';
import { setStepStatus, appendStepSummary, attachArtifactToRun, addReasoningEntry } from '../utils';

function now(): number {
  return Date.now();
}

function serializeToolResult(toolResult: ToolResult): string {
  if (toolResult.data !== undefined) {
    return typeof toolResult.data === 'string'
      ? toolResult.data
      : JSON.stringify(toolResult.data, null, 2);
  }

  return toolResult.error || 'Tool execution failed';
}

export interface ToolCallSlice {
  // Tool call state
  currentToolCalls: ToolCallRecord[];

  // Tool call actions
  addToolCall: (toolCall: Omit<ToolCallRecord, 'id'>) => string;
  updateToolCall: (id: string, updates: Partial<ToolCallRecord>) => void;
  removeToolCall: (id: string) => void;
  clearToolCalls: () => void;
  setToolCallStatus: (id: string, status: ToolCallRecord['status']) => void;

  // Tool execution helpers
  executeToolCall: (
    name: string,
    input: Record<string, unknown>,
    conversationId: string,
    updateRunState: (
      conversationId: string,
      updater: (run: import('../types').AgentRun) => import('../types').AgentRun
    ) => void
  ) => Promise<ToolResult>;
}

export const createToolCallSlice: StateCreator<ToolCallSlice> = (set, get) => ({
  currentToolCalls: [],

  addToolCall: (toolCall) => {
    const id = uuidv4();
    set((state) => ({
      currentToolCalls: [
        ...state.currentToolCalls,
        {
          ...toolCall,
          id,
        },
      ],
    }));
    return id;
  },

  updateToolCall: (id, updates) => {
    set((state) => ({
      currentToolCalls: state.currentToolCalls.map((call) =>
        call.id === id ? { ...call, ...updates } : call
      ),
    }));
  },

  removeToolCall: (id) => {
    set((state) => ({
      currentToolCalls: state.currentToolCalls.filter((call) => call.id !== id),
    }));
  },

  clearToolCalls: () => {
    set({ currentToolCalls: [] });
  },

  setToolCallStatus: (id, status) => {
    get().updateToolCall(id, { status });
  },

  executeToolCall: async (name, input, conversationId, updateRunState) => {
    // Handle internal agent tools
    if (INTERNAL_AGENT_TOOL_SET.has(name)) {
      switch (name) {
        case INTERNAL_AGENT_TOOL_NAMES.updateStepStatus: {
          const stepId = typeof input.step_id === 'string' ? input.step_id : '';
          const status = typeof input.status === 'string' ? input.status as AgentStepStatus : null;
          const summary = typeof input.summary === 'string' ? input.summary : undefined;

          if (!stepId || !status) {
            return { success: false, error: 'Invalid step status update input' };
          }

          updateRunState(conversationId, (run) => {
            return setStepStatus(run, stepId, status, summary);
          });

          return {
            success: true,
            data: { step_id: stepId, status },
            metadata: { internalAgentTool: true },
          };
        }

        case INTERNAL_AGENT_TOOL_NAMES.appendStepSummary: {
          const stepId = typeof input.step_id === 'string' ? input.step_id : '';
          const summary = typeof input.summary === 'string' ? input.summary : '';

          if (!stepId || !summary.trim()) {
            return { success: false, error: 'Invalid step summary input' };
          }

          updateRunState(conversationId, (run) => {
            return appendStepSummary(run, stepId, summary);
          });

          return {
            success: true,
            data: { step_id: stepId },
            metadata: { internalAgentTool: true },
          };
        }

        case INTERNAL_AGENT_TOOL_NAMES.attachArtifact: {
          const kind = typeof input.kind === 'string' ? input.kind as ArtifactKind : null;
          const path = typeof input.path === 'string' ? input.path : '';
          const stepId = typeof input.step_id === 'string' ? input.step_id : undefined;
          const title = typeof input.title === 'string' ? input.title : undefined;
          const preview = typeof input.preview === 'string' ? input.preview : undefined;

          if (!kind || !path) {
            return { success: false, error: 'Invalid artifact input' };
          }

          // This will be handled by the artifact slice
          updateRunState(conversationId, (run) => {
            return attachArtifactToRun(run, { stepId, path, kind, title, preview });
          });

          return {
            success: true,
            data: { path, kind },
            metadata: { internalAgentTool: true },
          };
        }

        case INTERNAL_AGENT_TOOL_NAMES.appendReasoning: {
          const text = typeof input.text === 'string' ? input.text : '';
          const phase = typeof input.phase === 'string' ? input.phase as AgentReasoningPhase : 'execution';
          const stepId = typeof input.step_id === 'string' ? input.step_id : undefined;

          if (!text.trim()) {
            return { success: false, error: 'Invalid reasoning input' };
          }

          updateRunState(conversationId, (run) => {
            return addReasoningEntry(run, phase, text, stepId);
          });

          return {
            success: true,
            data: { phase },
            metadata: { internalAgentTool: true },
          };
        }

        default:
          break;
      }
    }

    // Execute external tools through tool registry
    const configStore = useConfigStore.getState();
    const editorStore = useEditorStore.getState();
    const activeFile = editorStore.getActiveFile();

    const context = {
      workingDirectory: configStore.workingDirectory,
      openFiles: editorStore.openFiles.map((file) => file.path),
      activeFile: activeFile?.path,
      editorContent: activeFile?.content,
    };

    return toolRegistry.execute(name, input, context);
  },
});
