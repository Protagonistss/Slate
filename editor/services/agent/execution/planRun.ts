// Plan Run - 计划阶段执行
import { streamBackendLLMChat } from '../../backend/llm';
import { useConversationStore } from '@/stores/conversationStore';
import type { MessageContext, StoreGetter, StoreSetter } from '../types';
import { appendSystemPrompt, buildPlanningSystemPrompt, sanitizeMessagesForLLM } from '../internal/utils';
import { now } from '@/utils/date';
import type { AgentRun } from '@/features/agent/store/types';
import type { AssistantAccumulator } from '../types';
import { createPlanningTool, INTERNAL_AGENT_TOOL_NAMES } from '../internal/tools';
import { getConversationMessages, createAssistantMessage, appendAssistantText, appendAssistantToolUse } from '../streaming';
import { executeToolCall } from './toolExecutor';
import { serializeToolResult } from '../internal/utils';
import { updateRunState, appendStreamingApiReasoningDelta } from '../run/runOperations';
import { parsePlanToolInput } from '../run/planParser';

/**
 * Runs the planning phase
 */
export async function planRun(
  context: MessageContext,
  run: AgentRun,
  abortController: AbortController,
  setState: StoreSetter<import('@/features/agent/store/types').AgentState>,
  getState: StoreGetter<import('@/features/agent/store/types').AgentState>
): Promise<AgentRun> {
  const planningMessages = sanitizeMessagesForLLM(
    appendSystemPrompt(
      getConversationMessages(context.conversationId),
      buildPlanningSystemPrompt(context.systemPrompt, context)
    ),
    run.goal
  );

  const assistantMessageIndex = createAssistantMessage(context.conversationId);
  const accumulator: AssistantAccumulator = {
    plainText: '',
    blocks: [],
    toolUses: [],
  };

  let apiReasoningStreamOpen = false;

  for await (const chunk of streamBackendLLMChat(
    {
      provider: context.llmConfig.provider,
      model: context.llmConfig.model,
      messages: planningMessages,
      tools: [createPlanningTool()],
      temperature: context.llmConfig.temperature,
      max_tokens: context.llmConfig.maxTokens,
      reasoning_effort: context.llmConfig.reasoningEffort ?? null,
    },
    abortController.signal
  )) {
    if (abortController.signal.aborted) {
      break;
    }

    switch (chunk.type) {
      case 'content':
        apiReasoningStreamOpen = false;
        appendAssistantText(
          context.conversationId,
          assistantMessageIndex,
          accumulator,
          chunk.content || ''
        );
        setState({
          status: 'streaming',
          currentStreamContent: accumulator.plainText,
        });
        break;

      case 'tool_use':
        apiReasoningStreamOpen = false;
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

      case 'reasoning': {
        const delta = chunk.content ?? '';
        if (!delta) {
          break;
        }
        const continuing = apiReasoningStreamOpen;
        if (!continuing && !delta.trim()) {
          break;
        }
        setState((state: import('@/features/agent/store/types').AgentState) => ({
          status: 'streaming',
          runsByConversation: updateRunState(state, context.conversationId, (r) =>
            appendStreamingApiReasoningDelta(r, 'planning', null, delta, continuing)
          ),
        }));
        apiReasoningStreamOpen = true;
        break;
      }

      case 'error':
        apiReasoningStreamOpen = false;
        setState((state: import('@/features/agent/store/types').AgentState) => ({
          status: 'error',
          error: chunk.error || 'Unknown error',
          isProcessing: false,
          abortController: null,
          runsByConversation: updateRunState(state, context.conversationId, (runState) => ({
            ...runState,
            error: chunk.error || 'Unknown error',
            phase: 'error',
            updatedAt: now(),
          })),
        }));
        return getState().runsByConversation[context.conversationId];

      default:
        break;
    }
  }

  if (abortController.signal.aborted) {
    return getState().runsByConversation[context.conversationId];
  }

  const planToolUse = accumulator.toolUses.find((tu) => tu.name === INTERNAL_AGENT_TOOL_NAMES.submitPlan);
  if (planToolUse) {
    const planResult = parsePlanToolInput(planToolUse.input);

    if (planResult) {
      let nextRun = getState().runsByConversation[context.conversationId];
      nextRun = {
        ...nextRun,
        steps: planResult.steps,
        phase: 'paused',
        updatedAt: now(),
      };

      setState((state: import('@/features/agent/store/types').AgentState) => ({
        runsByConversation: {
          ...state.runsByConversation,
          [context.conversationId]: nextRun,
        },
      }));

      return nextRun;
    }

    const toolResult = await executeToolCall(
      { name: planToolUse.name, input: planToolUse.input },
      context
    );

    const resultBlock = {
      type: 'tool_result' as const,
      tool_use_id: planToolUse.id,
      content: serializeToolResult(toolResult),
      is_error: !toolResult.success,
    };

    useConversationStore.getState().addMessage(context.conversationId, {
      role: 'user',
      content: [resultBlock],
    });

    if (toolResult.success && typeof toolResult.data === 'object') {
      const planResult = toolResult.data as unknown;

      if (
        planResult &&
        typeof planResult === 'object' &&
        'steps' in planResult &&
        Array.isArray(planResult.steps)
      ) {
        let nextRun = getState().runsByConversation[context.conversationId];
        nextRun = {
          ...nextRun,
          steps: planResult.steps as import('@/features/agent/store/types').AgentStep[],
          phase: 'paused',
          updatedAt: now(),
        };

        setState((state: import('@/features/agent/store/types').AgentState) => ({
          runsByConversation: {
            ...state.runsByConversation,
            [context.conversationId]: nextRun,
          },
        }));

        return nextRun;
      }
    }
  }

  return getState().runsByConversation[context.conversationId];
}
