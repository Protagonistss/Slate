// Agent Plan Parser - 计划解析
import type { ParsedPlanStep } from '@/features/agent/store/types';
import type { AgentStep } from '@/features/agent/store/types';
import { now } from '@/utils/date';
import { normalizeTitle } from '../internal/utils';

/**
 * Creates step objects from parsed plan steps
 */
export function createStepsFromPlan(parsedSteps: ParsedPlanStep[]): AgentStep[] {
  const createdAt = now();
  const steps = parsedSteps.map((step, index) => ({
    id: `step_${index + 1}`,
    title: step.title,
    status: 'pending' as const,
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

/**
 * Parses the submit_plan tool payload
 */
function parsePlanPayload(payload: { title?: string; steps_json?: string }): { title: string; steps: AgentStep[] } | null {
  if (!payload.steps_json || typeof payload.steps_json !== 'string') {
    return null;
  }

  const parsedSteps = JSON.parse(payload.steps_json) as unknown[] as ParsedPlanStep[];
  if (!Array.isArray(parsedSteps)) {
    return null;
  }

  const validSteps = parsedSteps.filter((step) => {
    return (
      step &&
      typeof step === 'object' &&
      typeof step.title === 'string' &&
      typeof step.summary === 'string' &&
      Array.isArray(step.dependsOn)
    );
  });

  if (validSteps.length === 0) {
    return null;
  }

  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim()
    : 'Execution plan';

  return {
    title,
    steps: createStepsFromPlan(validSteps),
  };
}

export function parsePlanToolInput(toolInput: Record<string, unknown>): { title: string; steps: AgentStep[] } | null {
  try {
    return parsePlanPayload({
      title: typeof toolInput.title === 'string' ? toolInput.title : undefined,
      steps_json: typeof toolInput.steps_json === 'string' ? toolInput.steps_json : undefined,
    });
  } catch {
    return null;
  }
}

/**
 * Parses the submit_plan tool result
 */
export function parsePlanToolResult(toolResult: string): { title: string; steps: AgentStep[] } | null {
  try {
    const parsed = JSON.parse(toolResult) as { title?: string; steps_json?: string };
    return parsePlanPayload(parsed);
  } catch {
    return null;
  }
}
