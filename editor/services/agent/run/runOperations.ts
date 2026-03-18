// Agent Run Operations - 运行状态操作
import { v4 as uuidv4 } from 'uuid';
import { truncateText } from '@/utils/string';
import { now } from '@/utils/date';
import type {
  AgentRun,
  AgentRunPhase,
  AgentStepStatus,
  AgentReasoningPhase,
  ArtifactKind,
  ArtifactRef,
  ParsedPlanStep,
} from '@/features/agent/store/types';
import type { AgentStep } from '@/features/agent/store/types';

function normalizeReasoningValue(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
}

/**
 * Creates a new artifact reference
 */
export function createArtifact(input: {
  stepId?: string | null;
  path: string;
  kind: ArtifactKind;
  title?: string;
  preview?: string;
  contentSnapshot?: string;
}): ArtifactRef {
  const createdAt = now();
  return {
    id: uuidv4(),
    stepId: input.stepId ?? null,
    path: input.path,
    kind: input.kind,
    title: input.title || input.path,
    preview: truncateText(input.preview || ''),
    contentSnapshot: input.contentSnapshot || '',
    createdAt,
  };
}

/**
 * Replaces or adds an artifact in a list
 */
export function replaceArtifact(list: ArtifactRef[], artifact: ArtifactRef): ArtifactRef[] {
  const existingIndex = list.findIndex(
    (item) => item.path === artifact.path && item.stepId === artifact.stepId && item.kind === artifact.kind
  );

  if (existingIndex < 0) {
    return [...list, artifact];
  }

  const next = [...list];
  next[existingIndex] = {
    ...next[existingIndex],
    ...artifact,
    id: next[existingIndex].id,
    createdAt: next[existingIndex].createdAt,
  };
  return next;
}

/**
 * Adds a reasoning entry to the run
 */
export function addReasoningEntry(
  run: AgentRun,
  phase: AgentReasoningPhase,
  text: string,
  stepId?: string | null
): AgentRun {
  const nextText = text.trim();
  if (!nextText) {
    return run;
  }

  const normalizedNextText = normalizeReasoningValue(nextText);
  const previousEntry = run.reasoningEntries[run.reasoningEntries.length - 1];
  if (
    previousEntry &&
    previousEntry.stepId === (stepId ?? null) &&
    normalizeReasoningValue(previousEntry.text) === normalizedNextText
  ) {
    return run;
  }

  return {
    ...run,
    updatedAt: now(),
    reasoningEntries: [
      ...run.reasoningEntries,
      {
        id: uuidv4(),
        phase,
        text: nextText,
        stepId: stepId ?? null,
        createdAt: now(),
      },
    ].slice(-40),
  };
}

/**
 * Updates a single step in the run
 */
export function updateRunStep(
  run: AgentRun,
  stepId: string,
  updater: (step: AgentStep) => AgentStep
): AgentRun {
  const steps = run.steps.map((step) => (step.id === stepId ? updater(step) : step));
  return {
    ...run,
    steps,
    updatedAt: now(),
  };
}

/**
 * Appends evidence to a step
 */
export function appendStepEvidence(run: AgentRun, stepId: string, evidence: string): AgentRun {
  const nextEvidence = truncateText(evidence, 280);
  if (!nextEvidence) {
    return run;
  }

  return updateRunStep(run, stepId, (step) => ({
    ...step,
    evidence: [...step.evidence, nextEvidence].slice(-10),
    updatedAt: now(),
  }));
}

/**
 * Appends summary to a step
 */
export function appendStepSummary(run: AgentRun, stepId: string, summary: string): AgentRun {
  const nextSummary = truncateText(summary, 600);
  if (!nextSummary) {
    return run;
  }

  return updateRunStep(run, stepId, (step) => ({
    ...step,
    summary: step.summary ? `${step.summary}\n${nextSummary}` : nextSummary,
    updatedAt: now(),
  }));
}

/**
 * Attaches an artifact to the run
 */
export function attachArtifactToRun(
  run: AgentRun,
  artifactInput: {
    stepId?: string | null;
    path: string;
    kind: ArtifactKind;
    title?: string;
    preview?: string;
    contentSnapshot?: string;
  }
): AgentRun {
  const artifact = createArtifact(artifactInput);
  let nextRun: AgentRun = {
    ...run,
    updatedAt: now(),
    artifacts: replaceArtifact(run.artifacts, artifact),
  };

  if (artifact.stepId) {
    nextRun = updateRunStep(nextRun, artifact.stepId, (step) => ({
      ...step,
      artifactRefs: replaceArtifact(step.artifactRefs, artifact),
      updatedAt: now(),
    }));
  }

  return nextRun;
}

/**
 * Derives the run phase from its steps
 */
export function deriveRunPhase(run: AgentRun): AgentRunPhase {
  const hasRunning = run.steps.some((step) => step.status === 'running');
  const hasPending = run.steps.some((step) => step.status === 'pending');
  const hasBlocked = run.steps.some((step) => step.status === 'blocked');

  if (run.error || hasBlocked) {
    return 'error';
  }

  if (hasRunning) {
    return 'executing';
  }

  if (!hasPending) {
    return 'completed';
  }

  return 'paused';
}

/**
 * Sets the status of a step
 */
export function setStepStatus(
  run: AgentRun,
  stepId: string,
  status: AgentStepStatus,
  summary?: string
): AgentRun {
  let activeStepId = run.activeStepId;
  const nextSteps = run.steps.map((step) => {
    if (status === 'running' && step.id !== stepId && step.status === 'running') {
      return {
        ...step,
        status: 'pending' as AgentStepStatus,
        updatedAt: now(),
      };
    }

    if (step.id !== stepId) {
      return step;
    }

    if (status === 'running') {
      activeStepId = stepId;
    } else if (activeStepId === stepId) {
      activeStepId = null;
    }

    return {
      ...step,
      status,
      summary: summary ? truncateText(summary, 600) : step.summary,
      updatedAt: now(),
    };
  });

  const fallbackRunning = nextSteps.find((step) => step.status === 'running');
  const fallbackPending = nextSteps.find((step) => step.status === 'pending');
  const resolvedActiveStepId = activeStepId || fallbackRunning?.id || fallbackPending?.id || null;

  const nextRun = {
    ...run,
    steps: nextSteps,
    activeStepId: resolvedActiveStepId,
    updatedAt: now(),
  };

  return {
    ...nextRun,
    phase: deriveRunPhase(nextRun),
  };
}

/**
 * Ensures there's a runnable step (sets to running if needed)
 */
export function ensureRunnableStep(run: AgentRun): AgentRun {
  if (run.steps.some((step) => step.status === 'running')) {
    return {
      ...run,
      phase: 'executing',
      activeStepId: run.activeStepId || run.steps.find((step) => step.status === 'running')?.id || null,
      updatedAt: now(),
    };
  }

  const nextStep = run.steps.find((step) => step.status === 'pending');
  if (!nextStep) {
    return {
      ...run,
      phase: deriveRunPhase(run),
      updatedAt: now(),
    };
  }

  return setStepStatus(run, nextStep.id, 'running');
}

/**
 * Updates run state in the runsByConversation record
 */
export function updateRunState(
  state: { runsByConversation: Record<string, AgentRun> },
  conversationId: string,
  updater: (run: AgentRun) => AgentRun
): Record<string, AgentRun> {
  const run = state.runsByConversation[conversationId];
  if (!run) {
    return state.runsByConversation;
  }
  return {
    ...state.runsByConversation,
    [conversationId]: updater(run),
  };
}

/**
 * Creates a new agent run
 */
export function createRun(context: { conversationId: string; llmConfig: { provider: string; model: string } }, goal: string): AgentRun {
  const createdAt = now();
  return {
    id: uuidv4(),
    conversationId: context.conversationId,
    goal,
    phase: 'planning',
    provider: context.llmConfig.provider,
    model: context.llmConfig.model,
    activeStepId: null,
    error: null,
    createdAt,
    updatedAt: createdAt,
    steps: [],
    artifacts: [],
    reasoningEntries: [],
    lastAssistantMessage: '',
  };
}
