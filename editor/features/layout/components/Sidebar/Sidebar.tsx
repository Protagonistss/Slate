// Sidebar 组件 - 左侧边栏
import React, { type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate } from "react-router";
import { Panel } from "react-resizable-panels";
import { Home, Settings, PencilLine, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentStore, useConversationStore, useProjectStore, useEditorStore } from "@/stores";
import { ProjectFileTree } from "@/features/layout/components";
import { NavItem } from "./NavItem";
import { AgentSessionsSection } from "./AgentSessionsSection";

interface SidebarProps {
  isOpen: boolean;
  currentMode: "home" | "editor" | "agent" | "settings";
}

export function Sidebar({ isOpen, currentMode }: SidebarProps) {
  const navigate = useNavigate();
  const { openProject, closeProject } = useProjectStore();
  const { closeAllFiles } = useEditorStore();

  const isAgentProcessing = useAgentStore((state) => state.isProcessing);
  const resetAgentState = useAgentStore((state) => state.reset);
  const deleteAgentRun = useAgentStore((state) => state.deleteRun);
  const setCurrentConversation = useConversationStore((state) => state.setCurrentConversation);
  const deleteConversation = useConversationStore((state) => state.deleteConversation);

  // 打开新项目的处理函数
  const handleNewProject = async () => {
    closeProject();
    closeAllFiles();
    await openProject();

    const { currentProject } = useProjectStore.getState();
    if (currentProject) {
      navigate("/editor");
    }
  };

  const handleCreateAgentSession = () => {
    if (isAgentProcessing) return;

    resetAgentState();
    navigate("/agent");
  };

  const handleSelectAgentSession = (conversationId: string) => {
    if (isAgentProcessing) return;

    setCurrentConversation(conversationId);
    navigate(`/agent/${conversationId}`);
  };

  const handleDeleteAgentSession = async (conversationId: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isAgentProcessing) return;

    const { currentConversationId, conversations } = useConversationStore.getState();
    const isDeletingCurrentConversation = conversationId === currentConversationId;
    const nextConversationId =
      isDeletingCurrentConversation
        ? conversations.find((conversation) => conversation.id !== conversationId)?.id || null
        : currentConversationId;

    if (isDeletingCurrentConversation) {
      resetAgentState();
      if (nextConversationId) {
        setCurrentConversation(nextConversationId);
      }
      navigate(nextConversationId ? `/agent/${nextConversationId}` : "/agent", { replace: true });
    }

    deleteAgentRun(conversationId);
    await deleteConversation(conversationId);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Panel defaultSize={22} minSize={18} maxSize={32} id="left-sidebar" order={1}>
      <aside className="h-full bg-charcoal border-r border-graphite flex flex-col">
        <div
          className={cn(
            "min-h-0 flex-1 py-4 flex flex-col gap-6",
            currentMode === "editor"
              ? "overflow-hidden pl-3 pr-0"
              : "overflow-y-auto scrollbar-thin px-3"
          )}
        >
          {currentMode !== "editor" && currentMode !== "settings" && (
            <section>
              <div className="space-y-1">
                {currentMode === "home" && (
                  <>
                    <NavItem
                      icon={Home}
                      label="Home"
                      active={currentMode === "home"}
                      onClick={() => navigate("/")}
                    />
                    <NavItem
                      icon={PencilLine}
                      label="New Project"
                      active={false}
                      onClick={handleNewProject}
                    />
                    <NavItem
                      icon={Bot}
                      label="New Agent"
                      active={false}
                      onClick={() => navigate("/agent")}
                    />
                  </>
                )}
              </div>
            </section>
          )}

          {currentMode === "editor" && (
            <section className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <ProjectFileTree className="flex-1 min-h-0" />
            </section>
          )}

          {currentMode === "agent" && (
            <AgentSessionsSection
              isAgentProcessing={isAgentProcessing}
              onCreateAgentSession={handleCreateAgentSession}
              onSelectAgentSession={handleSelectAgentSession}
              onDeleteAgentSession={handleDeleteAgentSession}
              onRenameAgentSession={(conversationId, title) => {
                if (isAgentProcessing) return;
                useConversationStore.getState().renameConversation(conversationId, title);
              }}
            />
          )}
        </div>

        <div className="mt-auto pb-4 px-6 pt-2">
          <div
            onClick={() => navigate("/settings")}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center gap-2 transition-colors cursor-pointer group w-fit text-zinc-500 hover:text-zinc-300"
          >
            <Settings size={14} className="group-hover:rotate-45 transition-transform duration-300" />
            <span className="text-[13px]">Settings</span>
          </div>
        </div>
      </aside>
    </Panel>
  );
}
