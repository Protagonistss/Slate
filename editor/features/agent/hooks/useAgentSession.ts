// useAgentSession - Agent 会话管理组合 Hook
import { useMemo } from "react";
import { useAgentStore, type AgentState } from "../store/agentStore";
import { useConversationStore } from "@/stores/conversationStore";
import type { AgentRun } from "../store/types";
import type { Conversation } from "@/stores/conversationStore";

export interface UseAgentSessionResult {
  // Agent 状态
  status: AgentState["status"];
  isProcessing: AgentState["isProcessing"];
  agentError: AgentState["error"];
  runsByConversation: Record<string, AgentRun>;

  // Agent 操作
  createRun: (conversationId: string, goal: string, provider: string, model: string) => AgentRun;
  updateRun: (conversationId: string, updater: (run: AgentRun) => AgentRun) => void;
  getRun: (conversationId: string) => AgentRun | null;
  deleteRun: (conversationId: string) => void;

  // 会话状态
  conversations: Conversation[];
  currentConversationId: string | null;

  // 会话操作
  createConversation: (title?: string) => Promise<string>;
  setCurrentConversation: (id: string | null) => void;
  deleteConversation: (id: string) => Promise<void>;

  // 计算属性
  currentRun: AgentRun | null;
}

export function useAgentSession(conversationId?: string): UseAgentSessionResult {
  // Agent 状态
  const status = useAgentStore((state) => state.status);
  const isProcessing = useAgentStore((state) => state.isProcessing);
  const agentError = useAgentStore((state) => state.error);
  const runsByConversation = useAgentStore((state) => state.runsByConversation);

  // Agent 操作
  const createRun = useAgentStore((state) => state.createRun);
  const updateRun = useAgentStore((state) => state.updateRun);
  const getRun = useAgentStore((state) => state.getRun);
  const deleteRun = useAgentStore((state) => state.deleteRun);

  // 会话状态
  const conversations = useConversationStore((state) => state.conversations);
  const currentConversationId = useConversationStore((state) => state.currentConversationId);

  // 会话操作
  const createConversation = useConversationStore((state) => state.createConversation);
  const setCurrentConversation = useConversationStore((state) => state.setCurrentConversation);
  const deleteConversation = useConversationStore((state) => state.deleteConversation);

  // 计算属性 - 当前运行
  const currentRun = useMemo(
    () => (conversationId ? runsByConversation[conversationId] ?? null : null),
    [conversationId, runsByConversation]
  );

  return {
    // Agent 状态
    status,
    isProcessing,
    agentError,
    runsByConversation,

    // Agent 操作
    createRun,
    updateRun,
    getRun,
    deleteRun,

    // 会话状态
    conversations,
    currentConversationId,

    // 会话操作
    createConversation,
    setCurrentConversation,
    deleteConversation,

    // 计算属性
    currentRun,
  };
}
