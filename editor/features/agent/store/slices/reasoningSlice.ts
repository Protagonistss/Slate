// Reasoning Slice - handles agent reasoning entries
import { StateCreator } from 'zustand';
import type { ReasoningEntry, AgentReasoningPhase, AgentRun } from '../types';
import { addReasoningEntry, updateLastAssistantMessage } from '../utils';

function now(): number {
  return Date.now();
}

export interface ReasoningSlice {
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
}

export const createReasoningSlice: StateCreator<
  ReasoningSlice & { runsByConversation: Record<string, AgentRun> },
  [],
  [],
  ReasoningSlice
> = (set, get) => ({
  addReasoningEntry,
  updateLastAssistantMessage,

  addReasoningEntryToRun: (conversationId, phase, text, stepId) => {
    set((state) => {
      const run = state.runsByConversation[conversationId];
      if (!run) {
        return state;
      }

      return {
        runsByConversation: {
          ...state.runsByConversation,
          [conversationId]: addReasoningEntry(run, phase, text, stepId),
        },
      };
    });
  },

  clearReasoningEntries: (run) => {
    return {
      ...run,
      reasoningEntries: [],
      updatedAt: now(),
    };
  },
});
