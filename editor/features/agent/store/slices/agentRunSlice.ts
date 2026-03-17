// Agent Run Slice - handles agent execution runs and steps
import { StateCreator } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { AgentRun, AgentStep, AgentStepStatus, AgentRunPhase, ParsedPlanStep } from '../types';
import { setStepStatus, appendStepSummary, pauseRun, ensureRunnableStep } from '../utils';

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

function createRun(
  conversationId: string,
  goal: string,
  provider: string,
  model: string
): AgentRun {
  const createdAt = now();
  return {
    id: uuidv4(),
    conversationId,
    goal,
    phase: 'planning',
    provider,
    model,
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

function createStepsFromPlan(parsedSteps: ParsedPlanStep[]): AgentStep[] {
  const createdAt = now();
  const steps = parsedSteps.map((step, index) => ({
    id: `step_${index + 1}`,
    title: step.title,
    status: 'pending' as AgentStepStatus,
    order: index + 1,
    dependsOnStepIds: [],
    summary: step.summary,
    evidence: [],
    artifactRefs: [],
    retryCount: 0,
    createdAt,
    updatedAt: createdAt,
  }));

  const titleMap = new Map(steps.map((step) => [normalizeTitle(step.title), step.id]));

  return steps.map((step, index) => ({
    ...step,
    dependsOnStepIds: parsedSteps[index].dependsOn
      .map((title) => titleMap.get(normalizeTitle(title)) || null)
      .filter((id): id is string => Boolean(id)),
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

function appendStepEvidence(run: AgentRun, stepId: string, evidence: string): AgentRun {
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

export interface AgentRunSlice {
  // Run state
  runsByConversation: Record<string, AgentRun>;

  // Run actions
  createRun: (conversationId: string, goal: string, provider: string, model: string) => AgentRun;
  updateRun: (conversationId: string, updater: (run: AgentRun) => AgentRun) => void;
  getRun: (conversationId: string) => AgentRun | null;
  deleteRun: (conversationId: string) => void;
  setRunPhase: (conversationId: string, phase: AgentRunPhase) => void;

  // Step actions
  createStepsFromPlan: (parsedSteps: ParsedPlanStep[]) => AgentStep[];
  setStepStatus: (run: AgentRun, stepId: string, status: AgentStepStatus, summary?: string) => AgentRun;
  appendStepEvidence: (run: AgentRun, stepId: string, evidence: string) => AgentRun;
  appendStepSummary: (run: AgentRun, stepId: string, summary: string) => AgentRun;
  updateStep: (run: AgentRun, stepId: string, updater: (step: AgentStep) => AgentStep) => AgentRun;

  // Run control
  pauseRun: (run: AgentRun) => AgentRun;
  ensureRunnableStep: (run: AgentRun) => AgentRun;

  // Normalization
  normalizePersistedRun: (run: AgentRun) => AgentRun;
  normalizePersistedRuns: (runsByConversation: Record<string, AgentRun> | null | undefined) => Record<string, AgentRun>;
}

export const createAgentRunSlice: StateCreator<AgentRunSlice> = (set, get) => ({
  runsByConversation: {},

  createRun: (conversationId, goal, provider, model) => {
    return createRun(conversationId, goal, provider, model);
  },

  updateRun: (conversationId, updater) => {
    set((state) => {
      const run = state.runsByConversation[conversationId];
      if (!run) {
        return state;
      }

      return {
        runsByConversation: {
          ...state.runsByConversation,
          [conversationId]: updater(run),
        },
      };
    });
  },

  getRun: (conversationId) => {
    return get().runsByConversation[conversationId] || null;
  },

  deleteRun: (conversationId) => {
    set((state) => {
      if (!state.runsByConversation[conversationId]) {
        return state;
      }

      const nextRuns = { ...state.runsByConversation };
      delete nextRuns[conversationId];
      return { runsByConversation: nextRuns };
    });
  },

  setRunPhase: (conversationId, phase) => {
    set((state) => {
      const run = state.runsByConversation[conversationId];
      if (!run) {
        return state;
      }

      return {
        runsByConversation: {
          ...state.runsByConversation,
          [conversationId]: {
            ...run,
            phase,
            updatedAt: now(),
          },
        },
      };
    });
  },

  createStepsFromPlan,
  setStepStatus,
  appendStepEvidence,
  appendStepSummary,
  updateStep: updateRunStep,
  pauseRun,
  ensureRunnableStep,

  normalizePersistedRun: (run) => {
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
  },

  normalizePersistedRuns: (runsByConversation) => {
    const slice = get();
    if (!runsByConversation || typeof runsByConversation !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(runsByConversation)
        .filter(([, run]) => Boolean(run && typeof run === 'object'))
        .map(([conversationId, run]) => [conversationId, slice.normalizePersistedRun(run)])
    );
  },
});
