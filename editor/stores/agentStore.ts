import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { streamBackendLLMChat } from '@/services/backend/llm';
import { toolRegistry } from '../services/tools';
import type {
  ContentBlock,
  LLMConfig,
  Message,
  ToolDefinition,
  ToolResultContentBlock,
  ToolUseContentBlock,
} from '../services/llm/types';
import type { ToolContext, ToolResult } from '../services/tools';
import { useAuthStore } from './authStore';
import { useConfigStore } from './configStore';
import { useConversationStore } from './conversationStore';
import { useEditorStore } from './editorStore';
import { readTextFile } from '@/services/tauri/fs';
import { isAbsolutePath, joinPath } from '@/utils/pathUtils';

export type AgentStatus = 'idle' | 'thinking' | 'streaming' | 'tool_call' | 'error';
export type AgentRunPhase = 'planning' | 'executing' | 'paused' | 'completed' | 'error';
export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'blocked' | 'cancelled';
export type AgentReasoningPhase = 'planning' | 'execution' | 'tool';
export type ArtifactKind = 'plan' | 'file' | 'tool_result' | 'note';

export interface ToolCallRecord {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: unknown;
  error?: string;
}

export interface ArtifactRef {
  id: string;
  stepId: string | null;
  path: string;
  kind: ArtifactKind;
  title: string;
  preview: string;
  contentSnapshot?: string;
  createdAt: number;
}

export interface ReasoningEntry {
  id: string;
  phase: AgentReasoningPhase;
  text: string;
  stepId: string | null;
  createdAt: number;
}

export interface AgentStep {
  id: string;
  title: string;
  status: AgentStepStatus;
  order: number;
  dependsOnStepIds: string[];
  summary: string;
  evidence: string[];
  artifactRefs: ArtifactRef[];
  retryCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface AgentRun {
  id: string;
  conversationId: string;
  goal: string;
  phase: AgentRunPhase;
  provider: string;
  model: string;
  activeStepId: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  steps: AgentStep[];
  artifacts: ArtifactRef[];
  reasoningEntries: ReasoningEntry[];
  lastAssistantMessage: string;
}

interface MessageContext {
  conversationId: string;
  llmConfig: LLMConfig;
  accessToken: string;
  toolContext: ToolContext;
  externalTools: ToolDefinition[];
  systemPrompt?: string;
}

interface AssistantAccumulator {
  plainText: string;
  blocks: ContentBlock[];
  toolUses: ToolUseContentBlock[];
}

interface ParsedPlanStep {
  title: string;
  summary: string;
  dependsOn: string[];
}

const INTERNAL_AGENT_TOOL_NAMES = {
  submitPlan: 'submit_plan',
  updateStepStatus: 'update_step_status',
  appendStepSummary: 'append_step_summary',
  attachArtifact: 'attach_artifact',
  appendReasoning: 'append_reasoning',
} as const;

const INTERNAL_AGENT_TOOL_SET = new Set<string>(Object.values(INTERNAL_AGENT_TOOL_NAMES));
const ARTIFACT_SNAPSHOT_MAX_LENGTH = 50000;
const ARTIFACT_SNAPSHOT_TIMEOUT_MS = 3000;

function resolveArtifactSnapshotPath(path: string): string | null {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return null;
  }

  if (isAbsolutePath(normalizedPath)) {
    return normalizedPath;
  }

  const workingDirectory = useConfigStore.getState().workingDirectory.trim();
  if (!workingDirectory) {
    return null;
  }

  return joinPath(workingDirectory, normalizedPath);
}

async function readArtifactSnapshot(path: string): Promise<string> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const content = await Promise.race([
      readTextFile(path),
      new Promise<string>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Timed out while reading file snapshot.'));
        }, ARTIFACT_SNAPSHOT_TIMEOUT_MS);
      }),
    ]);

    return content.length > ARTIFACT_SNAPSHOT_MAX_LENGTH
      ? content.slice(0, ARTIFACT_SNAPSHOT_MAX_LENGTH)
      : content;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

interface PersistedAgentState {
  runsByConversation: Record<string, AgentRun>;
}

export interface AgentState {
  status: AgentStatus;
  isProcessing: boolean;
  currentStreamContent: string;
  currentToolCalls: ToolCallRecord[];
  error: string | null;
  abortController: AbortController | null;
  runsByConversation: Record<string, AgentRun>;
  sendMessage: (content: string) => Promise<void>;
  resumeRun: (instruction?: string) => Promise<void>;
  retryStep: (stepId: string) => void;
  deleteRun: (conversationId: string) => void;
  stopGeneration: () => void;
  executeToolCall: (name: string, input: Record<string, unknown>) => Promise<ToolResult>;
  setStatus: (status: AgentStatus) => void;
  clearError: () => void;
  reset: () => void;
}

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

function sanitizePathSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function buildConversationTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '新对话';
  }

  const title = normalized.slice(0, 48);
  return normalized.length > 48 ? `${title}...` : title;
}

function appendSystemPrompt(messages: Message[], systemPrompt?: string): Message[] {
  if (!systemPrompt) {
    return messages;
  }

  return [
    {
      role: 'system',
      content: systemPrompt,
    },
    ...messages,
  ];
}

function getConversationMessages(conversationId: string): Message[] {
  const conversationStore = useConversationStore.getState();
  const conversation = conversationStore.getConversation(conversationId);
  return conversation ? [...conversation.messages] : [];
}

function createAssistantMessage(conversationId: string): number {
  const conversationStore = useConversationStore.getState();
  const conversation = conversationStore.getConversation(conversationId);
  const assistantMessageIndex = conversation?.messages.length || 0;
  conversationStore.addMessage(conversationId, {
    role: 'assistant',
    content: '',
  });
  return assistantMessageIndex;
}

function appendAssistantText(
  conversationId: string,
  assistantMessageIndex: number,
  accumulator: AssistantAccumulator,
  chunk: string
): void {
  const conversationStore = useConversationStore.getState();

  if (accumulator.blocks.length === 0) {
    accumulator.plainText += chunk;
    conversationStore.updateMessage(
      conversationId,
      assistantMessageIndex,
      accumulator.plainText
    );
    return;
  }

  const lastBlock = accumulator.blocks[accumulator.blocks.length - 1];
  if (lastBlock?.type === 'text') {
    lastBlock.text += chunk;
  } else {
    accumulator.blocks.push({
      type: 'text',
      text: chunk,
    });
  }

  conversationStore.updateMessage(
    conversationId,
    assistantMessageIndex,
    [...accumulator.blocks]
  );
}

function appendAssistantToolUse(
  conversationId: string,
  assistantMessageIndex: number,
  accumulator: AssistantAccumulator,
  toolUse: ToolUseContentBlock
): void {
  const conversationStore = useConversationStore.getState();

  if (accumulator.blocks.length === 0 && accumulator.plainText) {
    accumulator.blocks.push({
      type: 'text',
      text: accumulator.plainText,
    });
  }

  accumulator.blocks.push(toolUse);
  accumulator.toolUses.push(toolUse);

  conversationStore.updateMessage(
    conversationId,
    assistantMessageIndex,
    [...accumulator.blocks]
  );
}

function serializeToolResult(toolResult: ToolResult): string {
  if (toolResult.data !== undefined) {
    return typeof toolResult.data === 'string'
      ? toolResult.data
      : JSON.stringify(toolResult.data, null, 2);
  }

  return toolResult.error || 'Tool execution failed';
}

function buildWorkspaceSummary(context: MessageContext): string {
  const openFiles = Array.isArray(context.toolContext.openFiles) && context.toolContext.openFiles.length > 0
    ? context.toolContext.openFiles.join(', ')
    : 'none';

  return [
    `Working directory: ${context.toolContext.workingDirectory || 'not set'}`,
    `Active file: ${context.toolContext.activeFile || 'none'}`,
    `Open files: ${openFiles}`,
    `Available external tools: ${context.externalTools.length > 0 ? context.externalTools.map((tool) => tool.name).join(', ') : 'none'}`,
  ].join('\n');
}

function buildPlanningSystemPrompt(basePrompt: string | undefined, context: MessageContext): string {
  return [
    basePrompt?.trim() || '',
    'You are in Slate planning mode for an engineering execution agent.',
    'Do not execute external tools in this phase.',
    `You must call "${INTERNAL_AGENT_TOOL_NAMES.submitPlan}" exactly once.`,
    'Return 3 to 7 concrete execution steps.',
    'Each step must be observable and actionable inside the current workspace.',
    'Prefer discovery before edits, then implementation, then validation.',
    'Set "steps_json" to a JSON array string. Each item must be an object with:',
    '- "title": short step title',
    '- "summary": short expected outcome',
    '- "dependsOn": optional array of prior step titles',
    'Workspace context:',
    buildWorkspaceSummary(context),
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildExecutionSystemPrompt(
  basePrompt: string | undefined,
  context: MessageContext,
  run: AgentRun
): string {
  const planLines = run.steps.map((step) => {
    const deps = step.dependsOnStepIds.length > 0 ? ` dependsOn=${step.dependsOnStepIds.join(',')}` : '';
    return `- ${step.id}: ${step.title} [${step.status}]${deps}`;
  });

  return [
    basePrompt?.trim() || '',
    'You are executing an approved Slate engineering plan.',
    `Goal: ${run.goal}`,
    'Execution rules:',
    `1. Before work starts on a step, call "${INTERNAL_AGENT_TOOL_NAMES.updateStepStatus}" with status="running".`,
    `2. Use "${INTERNAL_AGENT_TOOL_NAMES.appendReasoning}" for concise execution notes.`,
    `3. Use "${INTERNAL_AGENT_TOOL_NAMES.appendStepSummary}" whenever you have a meaningful result for a step.`,
    `4. Use "${INTERNAL_AGENT_TOOL_NAMES.attachArtifact}" for files, plans, or tool outputs worth showing in Live Artifacts.`,
    `5. When a step completes, call "${INTERNAL_AGENT_TOOL_NAMES.updateStepStatus}" with status="completed".`,
    `6. If blocked, call "${INTERNAL_AGENT_TOOL_NAMES.updateStepStatus}" with status="blocked" and include a short summary.`,
    '7. Keep only one step running at a time.',
    'Current plan:',
    ...planLines,
    'Workspace context:',
    buildWorkspaceSummary(context),
  ]
    .filter(Boolean)
    .join('\n\n');
}

function createArtifact(input: {
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

function replaceArtifact(list: ArtifactRef[], artifact: ArtifactRef): ArtifactRef[] {
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

function addReasoningEntry(
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

function appendStepSummary(run: AgentRun, stepId: string, summary: string): AgentRun {
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

function attachArtifactToRun(
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

function normalizePersistedRun(run: AgentRun): AgentRun {
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

  const nextRun: AgentRun = {
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

  return nextRun;
}

function normalizePersistedRuns(
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

function setStepStatus(
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

function ensureRunnableStep(run: AgentRun): AgentRun {
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

function pauseRun(run: AgentRun): AgentRun {
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

function createRun(context: MessageContext, goal: string): AgentRun {
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

function parseStepsArray(value: unknown): ParsedPlanStep[] {
  const parsed =
    Array.isArray(value)
      ? value
      : typeof value === 'string'
      ? JSON.parse(value)
      : [];

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const title = typeof (item as { title?: unknown }).title === 'string'
        ? (item as { title: string }).title.trim()
        : '';
      if (!title) {
        return null;
      }

      const summary = typeof (item as { summary?: unknown }).summary === 'string'
        ? (item as { summary: string }).summary.trim()
        : title;
      const dependsOnRaw = (item as { dependsOn?: unknown }).dependsOn;
      const dependsOn = Array.isArray(dependsOnRaw)
        ? dependsOnRaw.filter((entry): entry is string => typeof entry === 'string')
        : [];

      return {
        title,
        summary,
        dependsOn,
      };
    })
    .filter((item): item is ParsedPlanStep => Boolean(item));
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

function parsePlanToolInput(input: Record<string, unknown>): { title: string; steps: AgentStep[] } | null {
  try {
    const rawSteps = input.steps_json ?? input.steps;
    const parsedSteps = parseStepsArray(rawSteps);
    if (parsedSteps.length === 0) {
      return null;
    }

    const title = typeof input.title === 'string' && input.title.trim()
      ? input.title.trim()
      : 'Execution plan';

    return {
      title,
      steps: createStepsFromPlan(parsedSteps),
    };
  } catch {
    return null;
  }
}

function createPlanningTool(): ToolDefinition {
  return {
    name: INTERNAL_AGENT_TOOL_NAMES.submitPlan,
    description: 'Submit the execution plan for the current engineering goal.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title for the plan.',
        },
        steps_json: {
          type: 'string',
          description: 'JSON array string. Each item: {"title": string, "summary": string, "dependsOn": string[]}.',
        },
      },
      required: ['steps_json'],
    },
  };
}

function createExecutionRuntimeTools(): ToolDefinition[] {
  return [
    {
      name: INTERNAL_AGENT_TOOL_NAMES.updateStepStatus,
      description: 'Update the status of a plan step.',
      input_schema: {
        type: 'object',
        properties: {
          step_id: { type: 'string', description: 'Target step id, for example step_1.' },
          status: {
            type: 'string',
            enum: ['pending', 'running', 'completed', 'blocked', 'cancelled'],
            description: 'Next status for the step.',
          },
          summary: { type: 'string', description: 'Optional short summary for the status change.' },
        },
        required: ['step_id', 'status'],
      },
    },
    {
      name: INTERNAL_AGENT_TOOL_NAMES.appendStepSummary,
      description: 'Append a concise progress summary to a plan step.',
      input_schema: {
        type: 'object',
        properties: {
          step_id: { type: 'string', description: 'Target step id.' },
          summary: { type: 'string', description: 'Short progress summary for the step.' },
        },
        required: ['step_id', 'summary'],
      },
    },
    {
      name: INTERNAL_AGENT_TOOL_NAMES.attachArtifact,
      description: 'Attach a previewable artifact to the current run.',
      input_schema: {
        type: 'object',
        properties: {
          step_id: { type: 'string', description: 'Optional step id related to the artifact.' },
          path: { type: 'string', description: 'Display path for the artifact.' },
          kind: {
            type: 'string',
            enum: ['plan', 'file', 'tool_result', 'note'],
            description: 'Artifact type.',
          },
          title: { type: 'string', description: 'Optional display title.' },
          preview: { type: 'string', description: 'Optional preview text.' },
        },
        required: ['path', 'kind'],
      },
    },
    {
      name: INTERNAL_AGENT_TOOL_NAMES.appendReasoning,
      description: 'Append a concise reasoning note for the run.',
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Short reasoning note.' },
          phase: {
            type: 'string',
            enum: ['planning', 'execution', 'tool'],
            description: 'Reasoning phase.',
          },
          step_id: { type: 'string', description: 'Optional step id.' },
        },
        required: ['text', 'phase'],
      },
    },
  ];
}

function prepareNewGoalContext(content: string): MessageContext | null {
  const conversationStore = useConversationStore.getState();
  const configStore = useConfigStore.getState();
  const authStore = useAuthStore.getState();
  const editorStore = useEditorStore.getState();

  const accessToken = authStore.accessToken;
  if (!accessToken) {
    return null;
  }

  let conversationId = conversationStore.currentConversationId;
  const suggestedTitle = buildConversationTitle(content);

  if (!conversationId) {
    conversationId = conversationStore.createConversation(suggestedTitle);
  } else {
    const currentConversation = conversationStore.getConversation(conversationId);
    const canReplacePlaceholderTitle =
      currentConversation &&
      currentConversation.messages.length === 0 &&
      /^新对话(?:\s+\d+)?$/.test(currentConversation.title);

    if (canReplacePlaceholderTitle) {
      conversationStore.renameConversation(conversationId, suggestedTitle);
    }
  }

  conversationStore.addMessage(conversationId, {
    role: 'user',
    content,
  });

  const llmConfig = configStore.getCurrentLLMConfig();
  if (!llmConfig.provider || !llmConfig.model) {
    return null;
  }

  const activeFile = editorStore.getActiveFile();

  return {
    conversationId,
    accessToken,
    llmConfig,
    externalTools: toolRegistry.getAllDefinitions(),
    toolContext: {
      workingDirectory: configStore.workingDirectory,
      openFiles: editorStore.openFiles.map((file) => file.path),
      activeFile: activeFile?.path,
      editorContent: activeFile?.content,
    },
    systemPrompt: configStore.llmConfigs[configStore.currentProvider]?.systemPrompt,
  };
}

function prepareExistingContext(): MessageContext | null {
  const conversationStore = useConversationStore.getState();
  const configStore = useConfigStore.getState();
  const authStore = useAuthStore.getState();
  const editorStore = useEditorStore.getState();

  const accessToken = authStore.accessToken;
  const conversationId = conversationStore.currentConversationId;

  if (!accessToken || !conversationId) {
    return null;
  }

  const llmConfig = configStore.getCurrentLLMConfig();
  if (!llmConfig.provider || !llmConfig.model) {
    return null;
  }

  const activeFile = editorStore.getActiveFile();

  return {
    conversationId,
    accessToken,
    llmConfig,
    externalTools: toolRegistry.getAllDefinitions(),
    toolContext: {
      workingDirectory: configStore.workingDirectory,
      openFiles: editorStore.openFiles.map((file) => file.path),
      activeFile: activeFile?.path,
      editorContent: activeFile?.content,
    },
    systemPrompt: configStore.llmConfigs[configStore.currentProvider]?.systemPrompt,
  };
}

function updateRunState(
  state: AgentState,
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

async function planRun(
  context: MessageContext,
  run: AgentRun,
  abortController: AbortController,
  set: (partial: Partial<AgentState> | ((state: AgentState) => Partial<AgentState>)) => void
): Promise<AgentRun> {
  const planningMessages = appendSystemPrompt(
    getConversationMessages(context.conversationId),
    buildPlanningSystemPrompt(context.systemPrompt, context)
  );

  let planningText = '';
  let parsedPlan: { title: string; steps: AgentStep[] } | null = null;
  const persistPlanningText = () => {
    const nextText = planningText.trim();
    if (!nextText) {
      return;
    }

    set((state) => ({
      runsByConversation: updateRunState(state, context.conversationId, (runState) => ({
        ...runState,
        lastAssistantMessage: nextText,
        updatedAt: now(),
      })),
    }));
  };

  for await (const chunk of streamBackendLLMChat(
    {
      provider: context.llmConfig.provider,
      model: context.llmConfig.model,
      messages: planningMessages,
      tools: [createPlanningTool()],
      temperature: context.llmConfig.temperature,
      max_tokens: context.llmConfig.maxTokens,
    },
    abortController.signal
  )) {
    if (abortController.signal.aborted) {
      break;
    }

    if (chunk.type === 'content') {
      planningText += chunk.content || '';
      set({
        status: 'streaming',
        currentStreamContent: planningText,
      });
    }

    if (chunk.type === 'tool_use' && chunk.toolUse?.name === INTERNAL_AGENT_TOOL_NAMES.submitPlan) {
      parsedPlan = parsePlanToolInput(chunk.toolUse.input);
    }

    if (chunk.type === 'error') {
      persistPlanningText();
      throw new Error(chunk.error || '规划阶段失败');
    }
  }

  if (!parsedPlan) {
    persistPlanningText();
    throw new Error('模型没有返回结构化计划');
  }

  let nextRun: AgentRun = {
    ...run,
    steps: parsedPlan.steps,
    phase: 'paused',
    lastAssistantMessage: planningText.trim() || run.lastAssistantMessage,
    updatedAt: now(),
  };

  if (planningText.trim()) {
    nextRun = addReasoningEntry(nextRun, 'planning', planningText);
  }

  nextRun = attachArtifactToRun(nextRun, {
    path: 'agent/plan.md',
    kind: 'plan',
    title: parsedPlan.title,
    preview: [
      `# ${parsedPlan.title}`,
      '',
      ...parsedPlan.steps.map((step) => `${step.order}. ${step.title} - ${step.summary}`),
    ].join('\n'),
  });

  return nextRun;
}

async function executeToolUses(
  toolUses: ToolUseContentBlock[],
  conversationId: string,
  setState: (partial: Partial<AgentState> | ((state: AgentState) => Partial<AgentState>)) => void,
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

      setState((state) => ({
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
      continue;
    }

    setState((state) => ({
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
      runsByConversation: updateRunState(state, conversationId, (run) => {
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

async function runExecutionLoop(
  context: MessageContext,
  abortController: AbortController,
  set: (partial: Partial<AgentState> | ((state: AgentState) => Partial<AgentState>)) => void,
  get: () => AgentState
): Promise<void> {
  set((state) => ({
    status: 'thinking',
    runsByConversation: updateRunState(state, context.conversationId, (run) => ({
      ...ensureRunnableStep(run),
      error: null,
    })),
  }));

  while (!abortController.signal.aborted) {
    const run = get().runsByConversation[context.conversationId];
    if (!run) {
      break;
    }

    const executionMessages = appendSystemPrompt(
      getConversationMessages(context.conversationId),
      buildExecutionSystemPrompt(context.systemPrompt, context, run)
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
          set((state) => ({
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
      set((state) => ({
        runsByConversation: updateRunState(state, context.conversationId, (runState) => ({
          ...runState,
          lastAssistantMessage: accumulator.plainText.trim(),
          updatedAt: now(),
        })),
      }));
    }

    if (accumulator.toolUses.length === 0) {
      set((state) => ({
        runsByConversation: updateRunState(state, context.conversationId, (runState) => {
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
      context.conversationId,
      set,
      get().executeToolCall
    );

    const nextRun = get().runsByConversation[context.conversationId];
    if (!nextRun || nextRun.phase === 'error') {
      break;
    }

    set({ status: 'thinking' });
  }
}

export const useAgentStore = create<AgentState>()(
  persist((set, get) => ({
  status: 'idle',
  isProcessing: false,
  currentStreamContent: '',
  currentToolCalls: [],
  error: null,
  abortController: null,
  runsByConversation: {},

  sendMessage: async (content: string) => {
    const accessToken = useAuthStore.getState().accessToken;

    if (!accessToken) {
      set({
        status: 'error',
        error: '请先登录 backend 账号',
        isProcessing: false,
      });
      return;
    }

    const context = prepareNewGoalContext(content);
    if (!context) {
      set({
        status: 'error',
        error: '无法准备模型调用上下文',
        isProcessing: false,
      });
      return;
    }

    const abortController = new AbortController();
    let run = createRun(context, content.trim());

    set((state) => ({
      status: 'thinking',
      isProcessing: true,
      currentStreamContent: '',
      currentToolCalls: [],
      error: null,
      abortController,
      runsByConversation: {
        ...state.runsByConversation,
        [context.conversationId]: run,
      },
    }));

    try {
      run = await planRun(context, run, abortController, set);

      set((state) => ({
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

      await runExecutionLoop(context, abortController, set, get);

      const finalRun = get().runsByConversation[context.conversationId];
      set({
        status: finalRun?.phase === 'error' ? 'error' : 'idle',
        isProcessing: false,
        currentStreamContent: '',
        abortController: null,
      });
    } catch (error) {
      set((state) => ({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        isProcessing: false,
        abortController: null,
        currentStreamContent: '',
        runsByConversation: updateRunState(state, context.conversationId, (runState) => ({
          ...runState,
          error: error instanceof Error ? error.message : 'Unknown error',
          phase: 'error',
          updatedAt: now(),
        })),
      }));
    }
  },

  resumeRun: async (instruction?: string) => {
    const context = prepareExistingContext();
    if (!context) {
      set({
        status: 'error',
        error: '无法恢复当前会话执行',
      });
      return;
    }

    const run = get().runsByConversation[context.conversationId];
    if (!run) {
      set({
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

    set((state) => ({
      status: 'thinking',
      isProcessing: true,
      currentStreamContent: '',
      currentToolCalls: [],
      error: null,
      abortController,
      runsByConversation: updateRunState(state, context.conversationId, (runState) => ({
        ...ensureRunnableStep(runState),
        error: null,
      })),
    }));

    try {
      await runExecutionLoop(context, abortController, set, get);
      const finalRun = get().runsByConversation[context.conversationId];
      set({
        status: finalRun?.phase === 'error' ? 'error' : 'idle',
        isProcessing: false,
        currentStreamContent: '',
        abortController: null,
      });
    } catch (error) {
      set((state) => ({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        isProcessing: false,
        abortController: null,
        currentStreamContent: '',
        runsByConversation: updateRunState(state, context.conversationId, (runState) => ({
          ...runState,
          error: error instanceof Error ? error.message : 'Unknown error',
          phase: 'error',
          updatedAt: now(),
        })),
      }));
    }
  },

  retryStep: (stepId: string) =>
    set((state) => {
      const conversationId = useConversationStore.getState().currentConversationId;
      if (!conversationId) {
        return {};
      }

      return {
        runsByConversation: updateRunState(state, conversationId, (run) => {
          const targetStep = run.steps.find((step) => step.id === stepId);
          if (!targetStep) {
            return run;
          }

          const nextSteps = run.steps.map((step) => {
            if (step.order < targetStep.order) {
              return step;
            }

            if (step.id === stepId) {
              return {
                ...step,
                status: 'pending' as AgentStepStatus,
                summary: '',
                evidence: [],
                artifactRefs: [],
                retryCount: step.retryCount + 1,
                updatedAt: now(),
              };
            }

            if (step.status === 'completed') {
              return step;
            }

            return {
              ...step,
              status: 'pending' as AgentStepStatus,
              summary: '',
              evidence: [],
              artifactRefs: [],
              updatedAt: now(),
            };
          });

          return {
            ...run,
            phase: 'paused',
            error: null,
            activeStepId: stepId,
            steps: nextSteps,
            updatedAt: now(),
          };
        }),
      };
    }),

  deleteRun: (conversationId: string) =>
    set((state) => {
      if (!state.runsByConversation[conversationId]) {
        return {};
      }

      const nextRuns = { ...state.runsByConversation };
      delete nextRuns[conversationId];
      return {
        runsByConversation: nextRuns,
      };
    }),

  stopGeneration: () => {
    const { abortController } = get();
    const conversationId = useConversationStore.getState().currentConversationId;
    abortController?.abort();

    set((state) => ({
      status: 'idle',
      isProcessing: false,
      currentStreamContent: '',
      abortController: null,
      runsByConversation:
        conversationId
          ? updateRunState(state, conversationId, (run) => pauseRun(run))
          : state.runsByConversation,
    }));
  },

  executeToolCall: async (name: string, input: Record<string, unknown>) => {
    const conversationId = useConversationStore.getState().currentConversationId;

    if (conversationId && INTERNAL_AGENT_TOOL_SET.has(name)) {
      switch (name) {
        case INTERNAL_AGENT_TOOL_NAMES.updateStepStatus: {
          const stepId = typeof input.step_id === 'string' ? input.step_id : '';
          const status = typeof input.status === 'string' ? input.status as AgentStepStatus : null;
          const summary = typeof input.summary === 'string' ? input.summary : undefined;

          if (!stepId || !status) {
            return { success: false, error: 'Invalid step status update input' };
          }

          set((state) => ({
            runsByConversation: updateRunState(state, conversationId, (run) =>
              setStepStatus(run, stepId, status, summary)
            ),
          }));

          return {
            success: true,
            data: { step_id: stepId, status },
            metadata: { internalAgentTool: true },
          };
        }

        case INTERNAL_AGENT_TOOL_NAMES.appendStepSummary: {
          const stepId = typeof input.step_id === 'string' ? input.step_id : '';
          const summary = typeof input.summary === 'string' ? input.summary : '';

          if (!stepId || !summary.trim()) {
            return { success: false, error: 'Invalid step summary input' };
          }

          set((state) => ({
            runsByConversation: updateRunState(state, conversationId, (run) =>
              appendStepSummary(run, stepId, summary)
            ),
          }));

          return {
            success: true,
            data: { step_id: stepId },
            metadata: { internalAgentTool: true },
          };
        }

        case INTERNAL_AGENT_TOOL_NAMES.attachArtifact: {
          const kind = typeof input.kind === 'string' ? input.kind as ArtifactKind : null;
          const path = typeof input.path === 'string' ? input.path : '';
          const stepId = typeof input.step_id === 'string' ? input.step_id : undefined;
          const title = typeof input.title === 'string' ? input.title : undefined;
          const preview = typeof input.preview === 'string' ? input.preview : undefined;

          if (!kind || !path) {
            return { success: false, error: 'Invalid artifact input' };
          }

          let contentSnapshot: string | undefined;
          if (kind === 'file') {
            const resolvedPath = resolveArtifactSnapshotPath(path);
            if (resolvedPath) {
              try {
                contentSnapshot = await readArtifactSnapshot(resolvedPath);
              } catch {
                contentSnapshot = undefined;
              }
            }
          }

          set((state) => ({
            runsByConversation: updateRunState(state, conversationId, (run) =>
              attachArtifactToRun(run, { stepId, path, kind, title, preview, contentSnapshot })
            ),
          }));

          return {
            success: true,
            data: { path, kind },
            metadata: { internalAgentTool: true },
          };
        }

        case INTERNAL_AGENT_TOOL_NAMES.appendReasoning: {
          const text = typeof input.text === 'string' ? input.text : '';
          const phase = typeof input.phase === 'string' ? input.phase as AgentReasoningPhase : 'execution';
          const stepId = typeof input.step_id === 'string' ? input.step_id : undefined;

          if (!text.trim()) {
            return { success: false, error: 'Invalid reasoning input' };
          }

          set((state) => ({
            runsByConversation: updateRunState(state, conversationId, (run) =>
              addReasoningEntry(run, phase, text, stepId)
            ),
          }));

          return {
            success: true,
            data: { phase },
            metadata: { internalAgentTool: true },
          };
        }

        default:
          break;
      }
    }

    const configStore = useConfigStore.getState();
    const editorStore = useEditorStore.getState();
    const activeFile = editorStore.getActiveFile();
    const context: ToolContext = {
      workingDirectory: configStore.workingDirectory,
      openFiles: editorStore.openFiles.map((file) => file.path),
      activeFile: activeFile?.path,
      editorContent: activeFile?.content,
    };

    return toolRegistry.execute(name, input, context);
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
}),
{
  name: 'protagonist-agent-runs',
  partialize: (state): PersistedAgentState => ({
    runsByConversation: state.runsByConversation,
  }),
  merge: (persistedState, currentState) => {
    const persisted = persistedState as Partial<PersistedAgentState> | undefined;

    return {
      ...currentState,
      status: 'idle',
      isProcessing: false,
      currentStreamContent: '',
      currentToolCalls: [],
      error: null,
      abortController: null,
      runsByConversation: normalizePersistedRuns(persisted?.runsByConversation),
    };
  },
}
));
