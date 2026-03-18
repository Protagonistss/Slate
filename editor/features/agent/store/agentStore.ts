// Agent Store - 会话存储服务（保留原有 persist）
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { persist } from 'zustand/middleware';
import type { AgentState } from './types';
import type { AgentRunSlice } from './slices/agentRunSlice';
import type { ArtifactSlice } from './slices/artifactSlice';
import type { ReasoningSlice } from './slices/reasoningSlice';
import type { ToolCallSlice } from './slices/toolCallSlice';
import { createAgentRunSlice } from './slices/agentRunSlice';
import { createArtifactSlice } from './slices/artifactSlice';
import { createReasoningSlice } from './slices/reasoningSlice';
import { createToolCallSlice } from './slices/toolCallSlice';
import { normalizePersistedRuns } from './utils';
import { agentExecutionService } from '@/services/agent';

interface PersistedAgentState {
  runsByConversation: Record<string, import('./types').AgentRun>;
}

export type { AgentState } from './types';
export type * from './types';

export const useAgentStore = create<AgentState>()(
  devtools(
    persist(
      (set, get, api) => {
        const toolCallState = createToolCallSlice(set, get, api);
        const agentRunState = createAgentRunSlice(set, get, api);
        const artifactState = createArtifactSlice(set, get, api);
        const reasoningState = createReasoningSlice(set, get, api);

        return {
          status: 'idle',
          isProcessing: false,
          currentStreamContent: '',
          error: null,
          abortController: null,

          currentToolCalls: [],
          addToolCall: toolCallState.addToolCall,
          updateToolCall: toolCallState.updateToolCall,
          removeToolCall: toolCallState.removeToolCall,
          clearToolCalls: toolCallState.clearToolCalls,
          setToolCallStatus: toolCallState.setToolCallStatus,

          runsByConversation: agentRunState.runsByConversation,
          createRun: agentRunState.createRun,
          updateRun: agentRunState.updateRun,
          getRun: agentRunState.getRun,
          deleteRun: agentRunState.deleteRun,
          setRunPhase: agentRunState.setRunPhase,
          createStepsFromPlan: agentRunState.createStepsFromPlan,
          setStepStatus: agentRunState.setStepStatus,
          appendStepEvidence: agentRunState.appendStepEvidence,
          appendStepSummary: agentRunState.appendStepSummary,
          updateStep: agentRunState.updateStep,
          pauseRun: agentRunState.pauseRun,
          ensureRunnableStep: agentRunState.ensureRunnableStep,
          normalizePersistedRun: agentRunState.normalizePersistedRun,
          normalizePersistedRuns: agentRunState.normalizePersistedRuns,

          createArtifact: artifactState.createArtifact,
          attachArtifactToRun: artifactState.attachArtifactToRun,
          attachArtifactToRunByConversationId: artifactState.attachArtifactToRunByConversationId,
          readArtifactSnapshot: artifactState.readArtifactSnapshot,
          resolveArtifactSnapshotPath: artifactState.resolveArtifactSnapshotPath,

          addReasoningEntry: reasoningState.addReasoningEntry,
          addReasoningEntryToRun: reasoningState.addReasoningEntryToRun,
          updateLastAssistantMessage: reasoningState.updateLastAssistantMessage,
          clearReasoningEntries: reasoningState.clearReasoningEntries,

          sendMessage: async (content: string) => {
            await agentExecutionService.sendMessage(content, get, set);
          },
          resumeRun: async (instruction?: string) => {
            await agentExecutionService.resumeRun(instruction, get, set);
          },
          retryStep: (stepId: string) => {
            const run = get().runsByConversation[Object.keys(get().runsByConversation)[0]];
            if (run) {
              set((state) => ({
                runsByConversation: {
                  ...state.runsByConversation,
                  [run.conversationId]: get().setStepStatus(run, stepId, 'pending'),
                },
              }));
            }
          },
          stopGeneration: () => {
            const { abortController } = get();
            abortController?.abort();
            set({
              status: 'idle',
              isProcessing: false,
              currentStreamContent: '',
              abortController: null,
            });
          },
          executeToolCall: async (name, input) => {
            return toolCallState.executeToolCall(
              name,
              input,
              '',
              (conversationId, updater) => {
                set((state) => ({
                  runsByConversation: {
                    ...state.runsByConversation,
                    [conversationId]: updater(state.runsByConversation[conversationId]!),
                  },
                }));
              }
            );
          },
          setStatus: (status) => set({ status }),
          clearError: () => set({ error: null }),
          reset: () =>
            set({
              status: 'idle',
              isProcessing: false,
              currentStreamContent: '',
              currentToolCalls: [],
              error: null,
              abortController: null,
            }),
        };
      },
      {
        name: 'protagonist-agent-runs',
        partialize: (state): PersistedAgentState => ({
          runsByConversation: state.runsByConversation,
        }),
        merge: (persistedState, currentState) => {
          const persisted = persistedState as Partial<PersistedAgentState> | undefined;

          return {
            ...currentState,
            status: 'idle',
            isProcessing: false,
            currentStreamContent: '',
            currentToolCalls: [],
            error: null,
            abortController: null,
            runsByConversation: normalizePersistedRuns(persisted?.runsByConversation),
          };
        },
      }
    ),
    { name: 'AgentStore' }
  )
);

export function createAgentStore() {
  return useAgentStore;
}
