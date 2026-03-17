// Agent store type definitions
import { v4 as uuidv4 } from 'uuid';

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

export interface MessageContext {
  conversationId: string;
  llmConfig: import('@/services/llm/types').LLMConfig;
  accessToken: string;
  toolContext: import('@/services/tools').ToolContext;
  externalTools: import('@/services/llm/types').ToolDefinition[];
  systemPrompt?: string;
}

export interface AssistantAccumulator {
  plainText: string;
  blocks: import('@/services/llm/types').ContentBlock[];
  toolUses: import('@/services/llm/types').ToolUseContentBlock[];
}

export interface ParsedPlanStep {
  title: string;
  summary: string;
  dependsOn: string[];
}

export interface AgentState {
  // Status state
  status: AgentStatus;
  isProcessing: boolean;
  currentStreamContent: string;
  currentToolCalls: ToolCallRecord[];
  error: string | null;
  abortController: AbortController | null;

  // Data state
  runsByConversation: Record<string, AgentRun>;

  // Tool call actions
  addToolCall: (toolCall: Omit<ToolCallRecord, 'id'>) => string;
  updateToolCall: (id: string, updates: Partial<ToolCallRecord>) => void;
  removeToolCall: (id: string) => void;
  clearToolCalls: () => void;
  setToolCallStatus: (id: string, status: ToolCallRecord['status']) => void;

  // Run actions
  createRun: (conversationId: string, goal: string, provider: string, model: string) => AgentRun;
  updateRun: (conversationId: string, updater: (run: AgentRun) => AgentRun) => void;
  getRun: (conversationId: string) => AgentRun | null;
  deleteRun: (conversationId: string) => void;
  setRunPhase: (conversationId: string, phase: AgentRunPhase) => void;
  createStepsFromPlan: (parsedSteps: ParsedPlanStep[]) => AgentStep[];
  setStepStatus: (run: AgentRun, stepId: string, status: AgentStepStatus, summary?: string) => AgentRun;
  appendStepEvidence: (run: AgentRun, stepId: string, evidence: string) => AgentRun;
  appendStepSummary: (run: AgentRun, stepId: string, summary: string) => AgentRun;
  updateStep: (run: AgentRun, stepId: string, updater: (step: AgentStep) => AgentStep) => AgentRun;
  pauseRun: (run: AgentRun) => AgentRun;
  ensureRunnableStep: (run: AgentRun) => AgentRun;
  normalizePersistedRun: (run: AgentRun) => AgentRun;
  normalizePersistedRuns: (runsByConversation: Record<string, AgentRun> | null | undefined) => Record<string, AgentRun>;

  // Artifact actions
  createArtifact: (input: {
    stepId?: string | null;
    path: string;
    kind: ArtifactKind;
    title?: string;
    preview?: string;
    contentSnapshot?: string;
  }) => ArtifactRef;
  attachArtifactToRun: (
    run: AgentRun,
    artifactInput: {
      stepId?: string | null;
      path: string;
      kind: ArtifactKind;
      title?: string;
      preview?: string;
      contentSnapshot?: string;
    }
  ) => AgentRun;
  attachArtifactToRunByConversationId: (
    conversationId: string,
    artifactInput: {
      stepId?: string | null;
      path: string;
      kind: ArtifactKind;
      title?: string;
      preview?: string;
      contentSnapshot?: string;
    }
  ) => Promise<void>;
  readArtifactSnapshot: (path: string) => Promise<string>;
  resolveArtifactSnapshotPath: (path: string) => string | null;

  // Reasoning actions
  addReasoningEntry: (
    run: AgentRun,
    phase: AgentReasoningPhase,
    text: string,
    stepId?: string | null
  ) => AgentRun;
  addReasoningEntryToRun: (
    conversationId: string,
    phase: AgentReasoningPhase,
    text: string,
    stepId?: string | null
  ) => void;
  updateLastAssistantMessage: (run: AgentRun, message: string) => AgentRun;
  clearReasoningEntries: (run: AgentRun) => AgentRun;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  resumeRun: (instruction?: string) => Promise<void>;
  retryStep: (stepId: string) => void;
  stopGeneration: () => void;
  executeToolCall: (name: string, input: Record<string, unknown>) => Promise<import('@/services/tools').ToolResult>;
  setStatus: (status: AgentStatus) => void;
  clearError: () => void;
  reset: () => void;
}

export const INTERNAL_AGENT_TOOL_NAMES = {
  submitPlan: 'submit_plan',
  updateStepStatus: 'update_step_status',
  appendStepSummary: 'append_step_summary',
  attachArtifact: 'attach_artifact',
  appendReasoning: 'append_reasoning',
} as const;

export const INTERNAL_AGENT_TOOL_SET = new Set<string>(Object.values(INTERNAL_AGENT_TOOL_NAMES));
export const ARTIFACT_SNAPSHOT_MAX_LENGTH = 50000;
export const ARTIFACT_SNAPSHOT_TIMEOUT_MS = 3000;
