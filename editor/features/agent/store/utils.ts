// Agent Store Utils - Shared utility functions for agent store
// These functions are pure and don't depend on store state
import { now } from '@/utils/date';

// Re-export common functions from runOperations to avoid duplication
export {
  createArtifact,
  replaceArtifact,
  addReasoningEntry,
  attachArtifactToRun,
  appendStepSummary,
  deriveRunPhase,
  setStepStatus,
  ensureRunnableStep,
  updateRunStep,
} from '@/services/agent/run/runOperations';

import type { AgentRun, AgentStepStatus, AgentRunPhase } from './types';

// Additional run control utilities (specific to store layer)

export function pauseRun(run: AgentRun): AgentRun {
  return {
    ...run,
    phase: 'paused',
    activeStepId: run.steps.find((step) => step.status === 'running')?.id || run.activeStepId,
    steps: run.steps.map((step) =>
      step.status === 'running'
        ? {
            ...step,
            status: 'pending' as AgentStepStatus,
            updatedAt: now(),
          }
        : step
    ),
    updatedAt: now(),
  };
}

export function updateLastAssistantMessage(run: AgentRun, message: string): AgentRun {
  return {
    ...run,
    lastAssistantMessage: message,
    updatedAt: now(),
  };
}

// Normalization utilities (specific to store layer)

function derivePersistedRunPhase(run: AgentRun): AgentRunPhase {
  if (run.error) {
    return 'error';
  }

  if (run.steps.length === 0) {
    if (run.phase === 'completed' && run.lastAssistantMessage.trim()) {
      return 'completed';
    }

    return 'paused';
  }

  const hasBlocked = run.steps.some((step) => step.status === 'blocked');
  const hasPending = run.steps.some((step) => step.status === 'pending');
  const hasRunning = run.steps.some((step) => step.status === 'running');

  if (hasBlocked) {
    return 'error';
  }

  if (hasRunning || hasPending) {
    return 'paused';
  }

  return 'completed';
}

export function normalizePersistedRun(run: AgentRun): AgentRun {
  const steps = Array.isArray(run.steps)
    ? run.steps.map((step) => ({
        ...step,
        status: step.status === 'running' ? 'pending' : step.status,
      }))
    : [];

  const fallbackActiveStepId =
    (run.activeStepId && steps.some((step) => step.id === run.activeStepId) && run.activeStepId) ||
    steps.find((step) => step.status === 'pending')?.id ||
    steps[steps.length - 1]?.id ||
    null;

  return {
    ...run,
    steps,
    artifacts: Array.isArray(run.artifacts)
      ? run.artifacts.map((artifact) => ({
          ...artifact,
          contentSnapshot:
            artifact && typeof artifact === 'object' && 'contentSnapshot' in artifact
              ? typeof artifact.contentSnapshot === 'string'
                ? artifact.contentSnapshot
                : ''
              : '',
        }))
      : [],
    reasoningEntries: Array.isArray(run.reasoningEntries) ? run.reasoningEntries : [],
    activeStepId: fallbackActiveStepId,
    phase: derivePersistedRunPhase({ ...run, steps }),
  };
}

export function normalizePersistedRuns(
  runsByConversation: Record<string, AgentRun> | null | undefined
): Record<string, AgentRun> {
  if (!runsByConversation || typeof runsByConversation !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(runsByConversation)
      .filter(([, run]) => Boolean(run && typeof run === 'object'))
      .map(([conversationId, run]) => [conversationId, normalizePersistedRun(run)])
  );
}
