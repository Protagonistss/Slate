// AgentSessionsSection - Agent 会话列表组件
import { useParams } from "react-router";
import { useAgentStore, useConversationStore } from "@/stores";
import { SessionItem } from "./SessionItem";
import { formatConversationDate } from "./utils";

export interface AgentSessionsSectionProps {
  isAgentProcessing: boolean;
  onCreateAgentSession: () => void;
  onSelectAgentSession: (conversationId: string) => void;
  onDeleteAgentSession: (conversationId: string, event: React.MouseEvent<HTMLButtonElement>) => void;
  onRenameAgentSession: (conversationId: string, title: string) => void;
}

export function AgentSessionsSection({
  isAgentProcessing,
  onCreateAgentSession,
  onSelectAgentSession,
  onDeleteAgentSession,
  onRenameAgentSession,
}: AgentSessionsSectionProps) {
  const conversations = useConversationStore((state) => state.conversations);
  const { conversationId: routeConversationId } = useParams<{ conversationId?: string }>();
  const renameConversation = useConversationStore((state) => state.renameConversation);

  const handleRename = (conversationId: string) => (title: string) => {
    if (isAgentProcessing) return;
    renameConversation(conversationId, title);
  };

  return (
    <section className="flex-1 -mt-4 min-h-0">
      <div className="flex items-center justify-between px-2 mb-3">
        <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Recent Sessions</h3>
        <button
          onClick={onCreateAgentSession}
          disabled={isAgentProcessing}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
            isAgentProcessing
              ? "cursor-not-allowed text-zinc-700"
              : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
          title={isAgentProcessing ? "运行中无法创建新会话" : "New Task"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </button>
      </div>

      <div className="space-y-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
        {conversations.length > 0 ? (
          conversations.map((conversation) => (
            <SessionItem
              key={conversation.id}
              title={conversation.title}
              date={formatConversationDate(conversation.updatedAt)}
              isActive={conversation.id === routeConversationId}
              disabled={isAgentProcessing}
              onClick={() => onSelectAgentSession(conversation.id)}
              onDelete={(event) => onDeleteAgentSession(conversation.id, event)}
              onRename={handleRename(conversation.id)}
            />
          ))
        ) : (
          <div className="px-3 py-5 text-center text-xs text-zinc-600">
            还没有 agent 会话
          </div>
        )}
      </div>
    </section>
  );
}
