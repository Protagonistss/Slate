// Agent Execution Service - Main entry point
// This is the main service that orchestrates agent execution

import { useAuthStore } from '@/stores/authStore';
import { useConversationStore } from '@/stores/conversationStore';
import { prepareNewGoalContext, prepareExistingContext } from './context';
import { createRun, updateRunState, ensureRunnableStep } from './run';
import { planRun, runExecutionLoop } from './execution';
import { now } from '@/utils/date';
import type { StoreGetter, StoreSetter } from './types';

/**
 * Agent Execution Service
 * Handles the complete lifecycle of agent execution:
 * 1. Planning phase - Generate execution plan from user goal
 * 2. Execution phase - Execute the plan step by step
 */
export class AgentExecutionService {
  /**
   * Sends a new message/goal and starts agent execution
   */
  async sendMessage(
    content: string,
    getState: StoreGetter<import('@/features/agent/store/types').AgentState>,
    setState: StoreSetter<import('@/features/agent/store/types').AgentState>
  ): Promise<void> {
    const accessToken = useAuthStore.getState().accessToken;

    if (!accessToken) {
      setState({
        status: 'error',
        error: '请先登录 backend 账号',
        isProcessing: false,
      });
      return;
    }

    const context = await prepareNewGoalContext(content);
    if (!context) {
      setState({
        status: 'error',
        error: '无法准备模型调用上下文',
        isProcessing: false,
      });
      return;
    }

    const abortController = new AbortController();
    let run = createRun(context, content.trim());

    console.log('[AgentExecutionService] Creating run with conversationId:', context.conversationId);
    console.log('[AgentExecutionService] Run:', run.id, run.phase);

    setState((state: import('@/features/agent/store/types').AgentState) => {
      const newRuns = {
        ...state.runsByConversation,
        [context.conversationId]: run,
      };
      console.log('[AgentExecutionService] setState - new runsByConversation keys:', Object.keys(newRuns));
      return {
        status: 'thinking',
        isProcessing: true,
        currentStreamContent: '',
        currentToolCalls: [],
        error: null,
        abortController,
        runsByConversation: newRuns,
      };
    });

    console.log('[AgentExecutionService] After setState, checking state...');
    const stateAfterSet = getState();
    console.log('[AgentExecutionService] State after set - runsByConversation keys:', Object.keys(stateAfterSet.runsByConversation));

    try {
      // Phase 1: Planning
      run = await planRun(context, run, abortController, setState, getState);

      setState((state: import('@/features/agent/store/types').AgentState) => ({
        status: 'thinking',
        currentStreamContent: '',
        runsByConversation: {
          ...state.runsByConversation,
          [context.conversationId]: run,
        },
      }));

      if (abortController.signal.aborted) {
        return;
      }

      // Phase 2: Execution
      await runExecutionLoop(context, abortController, setState, getState);

      const finalRun = getState().runsByConversation[context.conversationId];
      setState({
        status: finalRun?.phase === 'error' ? 'error' : 'idle',
        isProcessing: false,
        currentStreamContent: '',
        currentToolCalls: [],
        abortController: null,
      });
    } catch (error) {
      setState((state: import('@/features/agent/store/types').AgentState) => ({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        isProcessing: false,
        abortController: null,
        currentStreamContent: '',
        currentToolCalls: [],
        runsByConversation: updateRunState({ runsByConversation: state.runsByConversation }, context.conversationId, (runState) => ({
          ...runState,
          error: error instanceof Error ? error.message : 'Unknown error',
          phase: 'error',
          updatedAt: now(),
        })),
      }));
    }
  }

  /**
   * Resumes an existing paused run
   */
  async resumeRun(
    instruction: string | undefined,
    getState: StoreGetter<import('@/features/agent/store/types').AgentState>,
    setState: StoreSetter<import('@/features/agent/store/types').AgentState>
  ): Promise<void> {
    const context = prepareExistingContext();
    if (!context) {
      setState({
        status: 'error',
        error: '无法恢复当前会话执行',
      });
      return;
    }

    const run = getState().runsByConversation[context.conversationId];
    if (!run) {
      setState({
        status: 'error',
        error: '当前会话没有可恢复的 plan',
      });
      return;
    }

    if (instruction?.trim()) {
      useConversationStore.getState().addMessage(context.conversationId, {
        role: 'user',
        content: instruction.trim(),
      });
    }

    const abortController = new AbortController();

    setState((state: import('@/features/agent/store/types').AgentState) => ({
      status: 'thinking',
      isProcessing: true,
      currentStreamContent: '',
      currentToolCalls: [],
      error: null,
      abortController,
      runsByConversation: updateRunState({ runsByConversation: state.runsByConversation }, context.conversationId, (runState) => ({
        ...ensureRunnableStep(runState),
        error: null,
      })),
    }));

    try {
      await runExecutionLoop(context, abortController, setState, getState);
      const finalRun = getState().runsByConversation[context.conversationId];
      setState({
        status: finalRun?.phase === 'error' ? 'error' : 'idle',
        isProcessing: false,
        currentStreamContent: '',
        currentToolCalls: [],
        abortController: null,
      });
    } catch (error) {
      setState((state: import('@/features/agent/store/types').AgentState) => ({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        isProcessing: false,
        abortController: null,
        currentStreamContent: '',
        currentToolCalls: [],
        runsByConversation: updateRunState({ runsByConversation: state.runsByConversation }, context.conversationId, (runState) => ({
          ...runState,
          error: error instanceof Error ? error.message : 'Unknown error',
          phase: 'error',
          updatedAt: now(),
        })),
      }));
    }
  }
}

// Singleton instance
export const agentExecutionService = new AgentExecutionService();
