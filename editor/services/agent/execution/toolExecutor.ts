// Tool Executor - 工具执行
import { streamBackendLLMChat } from '../../backend/llm';
import { toolRegistry } from '../../tools';
import type { ToolResultContentBlock, ToolUseContentBlock } from '../../llm/types';
import type { ToolResult } from '../../tools';
import type { MessageContext, StoreGetter, StoreSetter } from '../types';
import { INTERNAL_AGENT_TOOL_NAMES, INTERNAL_AGENT_TOOL_SET } from '../internal/tools';
import { serializeToolResult, sanitizePathSegment } from '../internal/utils';
import {
  addReasoningEntry,
  appendStepEvidence,
  appendStepSummary,
  attachArtifactToRun,
  setStepStatus,
  updateRunState,
} from '../run/runOperations';
import type { AgentRun, AgentReasoningPhase, AgentStepStatus, ArtifactKind } from '@/features/agent/store/types';
import type { ToolCallRecord } from '@/features/agent/store/types';
import { now } from '@/utils/date';
import { useConversationStore } from '@/stores/conversationStore';

/**
 * Executes a single tool call
 */
export async function executeToolCall(
  toolCall: { name: string; input: Record<string, unknown> },
  context: MessageContext
): Promise<ToolResult> {
  const isInternalTool = INTERNAL_AGENT_TOOL_SET.has(toolCall.name);

  if (isInternalTool) {
    return { success: true, data: undefined };
  }

  return toolRegistry.execute(toolCall.name, toolCall.input, context.toolContext);
}

/**
 * Executes multiple tool uses and updates state
 */
export async function executeToolUses(
  toolUses: ToolUseContentBlock[],
  context: MessageContext,
  conversationId: string,
  setState: StoreSetter<import('@/features/agent/store/types').AgentState>,
  executeToolCallFn: (name: string, input: Record<string, unknown>) => Promise<ToolResult>
): Promise<void> {
  const conversationStore = useConversationStore.getState();

  for (const toolUse of toolUses) {
    const isRuntimeTool = INTERNAL_AGENT_TOOL_SET.has(toolUse.name);

    if (!isRuntimeTool) {
      const pendingRecord: ToolCallRecord = {
        id: toolUse.id,
        name: toolUse.name,
        input: toolUse.input,
        status: 'running',
      };

      setState((state: import('@/features/agent/store/types').AgentState) => ({
        status: 'tool_call',
        currentToolCalls: [...state.currentToolCalls, pendingRecord],
      }));
    }

    const toolResult = await executeToolCallFn(toolUse.name, toolUse.input);
    const resultContent = serializeToolResult(toolResult);
    const resultBlock: ToolResultContentBlock = {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: resultContent,
      is_error: !toolResult.success,
    };

    conversationStore.addMessage(conversationId, {
      role: 'user',
      content: [resultBlock],
    });

    if (isRuntimeTool) {
      setState((state: import('@/features/agent/store/types').AgentState) => ({
        runsByConversation: updateRunState({ runsByConversation: state.runsByConversation }, conversationId, (run) => {
          return applyInternalTool(run, toolUse);
        }),
      }));
      continue;
    }

    setState((state: import('@/features/agent/store/types').AgentState) => ({
      currentToolCalls: state.currentToolCalls.map((toolCall) =>
        toolCall.id === toolUse.id
          ? {
              ...toolCall,
              status: toolResult.success ? 'success' : 'error',
              result: toolResult.data,
              error: toolResult.error,
            }
          : toolCall
      ),
      runsByConversation: updateRunState({ runsByConversation: state.runsByConversation }, conversationId, (run) => {
        const targetStepId =
          run.activeStepId ||
          run.steps.find((step) => step.status === 'running')?.id ||
          run.steps.find((step) => step.status === 'pending')?.id ||
          null;

        let nextRun = run;
        if (targetStepId) {
          nextRun = appendStepEvidence(
            nextRun,
            targetStepId,
            `${toolUse.name}: ${toolResult.success ? 'success' : toolResult.error || 'error'}`
          );
          nextRun = attachArtifactToRun(nextRun, {
            stepId: targetStepId,
            path: `agent/tools/${sanitizePathSegment(toolUse.name)}.json`,
            kind: 'tool_result',
            title: toolUse.name,
            preview: resultContent,
          });

          if (!toolResult.success) {
            nextRun = setStepStatus(nextRun, targetStepId, 'blocked', toolResult.error || 'Tool execution failed');
          }
        }

        return !toolResult.success
          ? {
              ...nextRun,
              error: toolResult.error || 'Tool execution failed',
              phase: 'error',
              updatedAt: now(),
            }
          : nextRun;
      }),
    }));
  }
}

function applyInternalTool(run: AgentRun, toolUse: ToolUseContentBlock): AgentRun {
  const input = toolUse.input || {};
  const stepId = typeof input.step_id === 'string' ? input.step_id : undefined;

  switch (toolUse.name) {
    case INTERNAL_AGENT_TOOL_NAMES.updateStepStatus: {
      const status = typeof input.status === 'string' ? (input.status as AgentStepStatus) : null;
      const summary = typeof input.summary === 'string' ? input.summary : undefined;

      if (!stepId || !status) {
        return run;
      }

      const nextRun = setStepStatus(run, stepId, status, summary);
      if (status !== 'running') {
        return nextRun;
      }

      const targetStep = nextRun.steps.find((step) => step.id === stepId);
      if (!targetStep) {
        return nextRun;
      }

      return addReasoningEntry(nextRun, 'execution', `Working on ${targetStep.title}...`, stepId);
    }

    case INTERNAL_AGENT_TOOL_NAMES.appendStepSummary: {
      const summary = typeof input.summary === 'string' ? input.summary : '';
      if (!stepId || !summary.trim()) {
        return run;
      }

      return appendStepSummary(run, stepId, summary);
    }

    case INTERNAL_AGENT_TOOL_NAMES.attachArtifact: {
      const kind = typeof input.kind === 'string' ? (input.kind as ArtifactKind) : null;
      const path = typeof input.path === 'string' ? input.path : '';
      const title = typeof input.title === 'string' ? input.title : undefined;
      const preview = typeof input.preview === 'string' ? input.preview : undefined;

      if (!kind || !path) {
        return run;
      }

      return attachArtifactToRun(run, { stepId, path, kind, title, preview });
    }

    case INTERNAL_AGENT_TOOL_NAMES.appendReasoning: {
      const text = typeof input.text === 'string' ? input.text : '';
      const phaseStr = typeof input.phase === 'string' ? input.phase : 'execution';
      const validPhases: AgentReasoningPhase[] = ['planning', 'execution', 'tool'];
      const phase: AgentReasoningPhase = validPhases.includes(phaseStr as AgentReasoningPhase)
        ? (phaseStr as AgentReasoningPhase)
        : 'execution';

      if (!text.trim()) {
        return run;
      }

      return addReasoningEntry(run, phase, text, stepId);
    }

    default:
      return run;
  }
}
