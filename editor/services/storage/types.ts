// Storage types - 会话存储类型定义

import type { Message } from '@/services/llm/types';

export type SessionStatus = 'active' | 'completed' | 'archived';
export type AgentRunPhase = 'planning' | 'executing' | 'paused' | 'completed' | 'error';
export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'blocked' | 'cancelled';
export type AgentReasoningPhase = 'planning' | 'execution' | 'tool';
export type ArtifactKind = 'plan' | 'file' | 'tool_result' | 'note';

export interface SessionMeta {
  id: string;
  title: string;
  projectPath: string;
  goal: string;
  provider: string;
  model: string;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SessionIndex {
  version: 1;
  sessions: SessionMeta[];
}

export interface ArtifactRef {
  id: string;
  stepId: string | null;
  path: string;
  kind: ArtifactKind;
  title: string;
  preview: string;
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

export interface AgentRunFile {
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

export interface StoredMessage {
  role: 'user' | 'assistant' | 'system';
  content: Message['content'];
  timestamp: number;
}

export interface SessionData {
  meta: SessionMeta;
  messages: StoredMessage[];
  agentRun: AgentRunFile | null;
}

export interface SessionFilter {
  projectPath?: string;
  status?: SessionStatus;
  limit?: number;
}

export interface SessionStorageInterface {
  initialize(): Promise<void>;
  
  createSession(meta: SessionMeta): Promise<void>;
  getSession(id: string): Promise<SessionMeta | null>;
  listSessions(filter?: SessionFilter): Promise<SessionMeta[]>;
  updateSessionMeta(id: string, updates: Partial<SessionMeta>): Promise<void>;
  deleteSession(id: string): Promise<void>;
  
  appendMessage(sessionId: string, message: StoredMessage): Promise<void>;
  replaceMessages(sessionId: string, messages: StoredMessage[]): Promise<void>;
  getMessages(sessionId: string): Promise<StoredMessage[]>;
  
  saveAgentRun(sessionId: string, run: AgentRunFile): Promise<void>;
  loadAgentRun(sessionId: string): Promise<AgentRunFile | null>;
  
  isAvailable(): boolean;
}
