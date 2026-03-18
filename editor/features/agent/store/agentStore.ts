// Agent Store - 会话存储服务（手动文件存储）
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AgentState } from './types';
import type { AgentRunSlice } from './slices/agentRunSlice';
import type { ArtifactSlice } from './slices/artifactSlice';
import type { ReasoningSlice } from './slices/reasoningSlice';
import type { ToolCallSlice } from './slices/toolCallSlice';
import { createAgentRunSlice } from './slices/agentRunSlice';
import { createArtifactSlice } from './slices/artifactSlice';
import { createReasoningSlice } from './slices/reasoningSlice';
import { createToolCallSlice } from './slices/toolCallSlice';
import { agentExecutionService } from '@/services/agent';
import { sessionStorage, type StoredMessage, type SessionMeta } from '@/services/storage';
import type { AgentRun } from './types';
import { parsePlanToolInput } from '@/services/agent/run/planParser';
import { INTERNAL_AGENT_TOOL_NAMES } from '@/services/agent/internal/tools';

interface AgentStoreInternal {
  isLoaded: boolean;
  loadFromStorage: () => Promise<void>;
}

type AgentStoreState = AgentState & AgentStoreInternal;

let pendingRunFlush: ReturnType<typeof setTimeout> | null = null;
let pendingRunsSnapshot: Record<string, AgentRun> | null = null;

function flushRunPersistence(): void {
  if (pendingRunFlush) {
    clearTimeout(pendingRunFlush);
    pendingRunFlush = null;
  }

  const snapshot = pendingRunsSnapshot;
  pendingRunsSnapshot = null;

  if (!snapshot || !sessionStorage.isAvailable()) {
    return;
  }

  void (async () => {
    for (const [conversationId, run] of Object.entries(snapshot)) {
      try {
        await sessionStorage.saveAgentRun(conversationId, run);
      } catch (error) {
        console.error(`[AgentStore] Failed to persist run for ${conversationId}:`, error);
      }
    }
  })();
}

function scheduleRunPersistence(runsByConversation: Record<string, AgentRun>): void {
  if (!sessionStorage.isAvailable()) {
    return;
  }

  pendingRunsSnapshot = runsByConversation;

  if (pendingRunFlush) {
    clearTimeout(pendingRunFlush);
  }

  pendingRunFlush = setTimeout(flushRunPersistence, 300);
}

function extractMessageText(content: StoredMessage['content']): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n')
    .trim();
}

function recoverRunFromMessages(
  session: SessionMeta,
  messages: StoredMessage[],
  run: AgentRun | null,
  normalizePersistedRun: (run: AgentRun) => AgentRun
): AgentRun | null {
  const latestPlanMessage = [...messages].reverse().find((message) =>
    Array.isArray(message.content) &&
    message.content.some(
      (block) => block.type === 'tool_use' && block.name === INTERNAL_AGENT_TOOL_NAMES.submitPlan
    )
  );

  const submitPlanBlock = Array.isArray(latestPlanMessage?.content)
    ? latestPlanMessage.content.find(
        (block) => block.type === 'tool_use' && block.name === INTERNAL_AGENT_TOOL_NAMES.submitPlan
      )
    : null;

  const parsedPlan = submitPlanBlock?.type === 'tool_use'
    ? parsePlanToolInput(submitPlanBlock.input)
    : null;

  const latestUserGoal = [...messages]
    .reverse()
    .filter((message) => message.role === 'user')
    .map((message) => extractMessageText(message.content))
    .find((value) => value.length > 0);

  const latestAssistantMessage = [...messages]
    .reverse()
    .filter((message) => message.role === 'assistant')
    .map((message) => extractMessageText(message.content))
    .find((value) => value.length > 0);

  if (!run && !parsedPlan && !latestAssistantMessage) {
    return null;
  }

  const baseRun: AgentRun = run ?? {
    id: session.id,
    conversationId: session.id,
    goal: latestUserGoal || session.goal || session.title,
    phase: latestAssistantMessage ? 'completed' : 'paused',
    provider: session.provider,
    model: session.model,
    activeStepId: null,
    error: null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    steps: [],
    artifacts: [],
    reasoningEntries: [],
    lastAssistantMessage: latestAssistantMessage || '',
  };

  const recoveredPhase =
    baseRun.error
      ? 'error'
      : baseRun.phase === 'completed' || (!baseRun.phase && latestAssistantMessage)
      ? 'completed'
      : baseRun.phase;

  const recoveredSteps =
    baseRun.steps.length > 0
      ? baseRun.steps
      : parsedPlan?.steps.map((step) => ({
          ...step,
          status: recoveredPhase === 'completed' ? 'completed' : step.status,
        })) || [];

  return normalizePersistedRun({
    ...baseRun,
    goal: baseRun.goal || latestUserGoal || session.goal || session.title,
    steps: recoveredSteps,
    phase: recoveredPhase,
    lastAssistantMessage: baseRun.lastAssistantMessage || latestAssistantMessage || '',
    updatedAt: Math.max(baseRun.updatedAt, session.updatedAt),
  });
}

export type { AgentState } from './types';
export type * from './types';

export const useAgentStore = create<AgentStoreState>()(
  devtools(
    (set, get, api) => {
      const toolCallState = createToolCallSlice(set, get, api);
      const agentRunState = createAgentRunSlice(set, get, api);
      const artifactState = createArtifactSlice(set, get, api);
      const reasoningState = createReasoningSlice(set, get, api);

      return {
        status: 'idle' as const,
        isProcessing: false,
        currentStreamContent: '',
        error: null,
        abortController: null,
        isLoaded: false,

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
          console.log('[AgentStore] sendMessage called with:', content);
          console.log('[AgentStore] agentExecutionService:', agentExecutionService);
          console.log('[AgentStore] get:', get);
          console.log('[AgentStore] set:', set);
          try {
            await agentExecutionService.sendMessage(content, get, set);
            console.log('[AgentStore] sendMessage completed, runsByConversation:', Object.keys(get().runsByConversation));
          } catch (error) {
            console.error('[AgentStore] sendMessage error:', error);
          }
        },
        resumeRun: async (instruction?: string) => {
          await agentExecutionService.resumeRun(instruction, get, set);
        },
        retryStep: (stepId: string) => {
          const conversationId = Object.keys(get().runsByConversation)[0];
          if (!conversationId) return;
          const run = get().runsByConversation[conversationId];
          if (run) {
            set((state) => ({
              runsByConversation: {
                ...state.runsByConversation,
                [conversationId]: agentRunState.setStepStatus(run, stepId, 'pending'),
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
            currentToolCalls: [],
            abortController: null,
          });
        },
        executeToolCall: async (name: string, input: Record<string, unknown>) => {
          return toolCallState.executeToolCall(
            name,
            input,
            '',
            (conversationId: string, updater: (run: AgentRun) => AgentRun) => {
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

        loadFromStorage: async () => {
          console.log('[AgentStore] loadFromStorage called, isAvailable:', sessionStorage.isAvailable());
          if (!sessionStorage.isAvailable()) {
            set({ runsByConversation: {}, isLoaded: true });
            return;
          }

          try {
            const sessions = await sessionStorage.listSessions();
            console.log('[AgentStore] Found sessions:', sessions.length, sessions.map(s => s.id));
            const runsByConversation: Record<string, AgentRun> = {};

            for (const session of sessions) {
              const agentRun = await sessionStorage.loadAgentRun(session.id);
              const messages = await sessionStorage.getMessages(session.id);
              console.log('[AgentStore] Loaded agentRun for', session.id, ':', agentRun ? 'found' : 'not found');
              const recoveredRun = recoverRunFromMessages(
                session,
                messages,
                agentRun,
                get().normalizePersistedRun
              );

              if (recoveredRun) {
                runsByConversation[session.id] = recoveredRun;
              }
            }

            console.log('[AgentStore] Final runsByConversation keys:', Object.keys(runsByConversation));
            set({ runsByConversation, isLoaded: true });
          } catch (error) {
            console.error('[AgentStore] Failed to load from storage:', error);
            set({ runsByConversation: {}, isLoaded: true });
          }
        },
      };
    },
    { name: 'AgentStore' }
  )
);

export function createAgentStore() {
  return useAgentStore;
}

useAgentStore.subscribe((state, previousState) => {
  if (state.runsByConversation === previousState.runsByConversation) {
    return;
  }

  scheduleRunPersistence(state.runsByConversation);
});
