// Agent Store Utils - Shared utility functions for agent store
// These functions are pure and don't depend on store state
import { v4 as uuidv4 } from 'uuid';
import type { AgentRun, AgentStep, AgentStepStatus, AgentRunPhase, ParsedPlanStep, ArtifactRef, ArtifactKind, ReasoningEntry, AgentReasoningPhase } from './types';

function now(): number {
  return Date.now();
}

function truncateText(value: string, maxLength = 240): string {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

// Agent Run utilities

function deriveRunPhase(run: AgentRun): AgentRunPhase {
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

function updateRunStep(
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

// Artifact utilities

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
    // Update step with artifact reference
    const steps = run.steps.map((step) => {
      if (step.id !== artifact.stepId) {
        return step;
      }

      return {
        ...step,
        artifactRefs: replaceArtifact(step.artifactRefs, artifact),
        updatedAt: now(),
      };
    });

    nextRun = {
      ...nextRun,
      steps,
    };
  }

  return nextRun;
}

// Reasoning utilities

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

export function updateLastAssistantMessage(run: AgentRun, message: string): AgentRun {
  return {
    ...run,
    lastAssistantMessage: message,
    updatedAt: now(),
  };
}

// Additional run control utilities

export function pauseRun(run: AgentRun): AgentRun {
  return {
    ...run,
    phase: 'paused',
    activeStepId: run.steps.find((step) => step.status === 'running')?.id || run.activeStepId,
    steps: run.steps.map((step) =>
      step.status === 'running'
        ? {
            ...step,
            status: 'pending',
            updatedAt: now(),
          }
        : step
    ),
    updatedAt: now(),
  };
}

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

// Normalization utilities

function derivePersistedRunPhase(run: AgentRun): AgentRunPhase {
  if (run.error) {
    return 'error';
  }

  if (run.steps.length === 0) {
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

