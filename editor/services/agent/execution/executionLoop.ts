// Execution Loop - 执行循环
import { streamBackendLLMChat } from '../../backend/llm';
import { useConversationStore } from '@/stores/conversationStore';
import type { MessageContext, StoreGetter, StoreSetter } from '../types';
import {
  appendSystemPrompt,
  buildExecutionSystemPrompt,
  sanitizeMessagesForLLM,
} from '../internal/utils';
import { now } from '@/utils/date';
import { createExecutionRuntimeTools } from '../internal/tools';
import {
  getConversationMessages,
  createAssistantMessage,
  appendAssistantText,
  appendAssistantToolUse,
} from '../streaming';
import { updateRunState, ensureRunnableStep, appendStepSummary, setStepStatus, deriveRunPhase } from '../run/runOperations';
import { executeToolCall, executeToolUses } from './toolExecutor';
import type { AssistantAccumulator } from '../types';

/**
 * Runs the execution loop
 */
export async function runExecutionLoop(
  context: MessageContext,
  abortController: AbortController,
  set: StoreSetter<import('@/features/agent/store/types').AgentState>,
  get: StoreGetter<import('@/features/agent/store/types').AgentState>
): Promise<void> {
  set((state: import('@/features/agent/store/types').AgentState) => ({
    status: 'thinking',
    runsByConversation: updateRunState({ runsByConversation: state.runsByConversation }, context.conversationId, (run) => ({
      ...ensureRunnableStep(run),
      error: null,
    })),
  }));

  while (!abortController.signal.aborted) {
    set((state: import('@/features/agent/store/types').AgentState) => ({
      runsByConversation: updateRunState({ runsByConversation: state.runsByConversation }, context.conversationId, (runState) =>
        ensureRunnableStep(runState)
      ),
    }));
    const run = get().runsByConversation[context.conversationId];
    if (!run) {
      break;
    }

    const executionMessages = sanitizeMessagesForLLM(
      appendSystemPrompt(
        getConversationMessages(context.conversationId),
        buildExecutionSystemPrompt(context.systemPrompt, context, run)
      ),
      run.goal
    );
    const assistantMessageIndex = createAssistantMessage(context.conversationId);
    const accumulator: AssistantAccumulator = {
      plainText: '',
      blocks: [],
      toolUses: [],
    };
    let streamFailed = false;

    for await (const chunk of streamBackendLLMChat(
      {
        provider: context.llmConfig.provider,
        model: context.llmConfig.model,
        messages: executionMessages,
        tools: [...context.externalTools, ...createExecutionRuntimeTools()],
        temperature: context.llmConfig.temperature,
        max_tokens: context.llmConfig.maxTokens,
      },
      abortController.signal
    )) {
      if (abortController.signal.aborted) {
        break;
      }

      switch (chunk.type) {
        case 'content':
          appendAssistantText(
            context.conversationId,
            assistantMessageIndex,
            accumulator,
            chunk.content || ''
          );
          set({
            status: 'streaming',
            currentStreamContent: accumulator.plainText,
          });
          break;

        case 'tool_use':
          if (chunk.toolUse) {
            appendAssistantToolUse(
              context.conversationId,
              assistantMessageIndex,
              accumulator,
              {
                type: 'tool_use',
                id: chunk.toolUse.id,
                name: chunk.toolUse.name,
                input: chunk.toolUse.input,
              }
            );
          }
          break;

        case 'error':
          streamFailed = true;
          set((state: import('@/features/agent/store/types').AgentState) => ({
            status: 'error',
            error: chunk.error || 'Unknown error',
            isProcessing: false,
            abortController: null,
            runsByConversation: updateRunState({ runsByConversation: state.runsByConversation }, context.conversationId, (runState) => ({
              ...runState,
              error: chunk.error || 'Unknown error',
              phase: 'error',
              updatedAt: now(),
            })),
          }));
          break;

        default:
          break;
      }

      if (streamFailed) {
        break;
      }
    }

    if (streamFailed || abortController.signal.aborted) {
      return;
    }

    set({ currentStreamContent: '' });

    if (accumulator.plainText.trim()) {
      set((state: import('@/features/agent/store/types').AgentState) => ({
        runsByConversation: updateRunState({ runsByConversation: state.runsByConversation }, context.conversationId, (runState) => ({
          ...runState,
          lastAssistantMessage: accumulator.plainText.trim(),
          updatedAt: now(),
        })),
      }));
    }

    if (accumulator.toolUses.length === 0) {
      set((state: import('@/features/agent/store/types').AgentState) => ({
        runsByConversation: updateRunState({ runsByConversation: state.runsByConversation }, context.conversationId, (runState) => {
          const runningStep = runState.activeStepId
            ? runState.steps.find((step) => step.id === runState.activeStepId) || null
            : runState.steps.find((step) => step.status === 'running') || null;

          let nextRun = runState;
          if (runningStep && accumulator.plainText.trim()) {
            nextRun = appendStepSummary(nextRun, runningStep.id, accumulator.plainText);
            nextRun = setStepStatus(nextRun, runningStep.id, 'completed');
          }

          return {
            ...nextRun,
            phase: deriveRunPhase(nextRun),
            updatedAt: now(),
          };
        }),
      }));
      break;
    }

    await executeToolUses(
      accumulator.toolUses,
      context,
      context.conversationId,
      set,
      async (name, input) => executeToolCall({ name, input }, context)
    );

    const nextRun = get().runsByConversation[context.conversationId];
    if (!nextRun || nextRun.phase === 'error') {
      break;
    }

    set({ status: 'thinking' });
  }
}
