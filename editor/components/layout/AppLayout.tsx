import { Outlet, useLocation, useNavigate } from "react-router";
import { type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import { TopBar } from "./TopBar";
import { ProjectFileTree } from "./ProjectFileTree";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle
} from "react-resizable-panels";
import { motion, AnimatePresence } from "motion/react";
import {
  PencilLine,
  Bot,
  Home,
  ChevronRight,
  ChevronDown,
  PenSquare,
  Settings,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SimpleLogo } from "../shared";
import { parseOAuthDeepLinkUrl } from "@/services/backend/auth";
import { getCurrentDeepLinks, onDeepLinkOpen } from "@/services/tauri/deepLink";
import { useAgentStore, useAuthStore, useConversationStore, useProjectStore, useEditorStore, useUIStore } from "@/stores";

function getOAuthProviderLabel(provider: string | null | undefined): string {
  switch (provider) {
    case "github":
      return "GitHub";
    case "gitee":
      return "Gitee";
    case "google":
      return "Google";
    default:
      return "账号";
  }
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const { openProject, closeProject } = useProjectStore();
  const { closeAllFiles } = useEditorStore();
  const conversations = useConversationStore((state) => state.conversations);
  const currentConversationId = useConversationStore((state) => state.currentConversationId);
  const createConversation = useConversationStore((state) => state.createConversation);
  const setCurrentConversation = useConversationStore((state) => state.setCurrentConversation);
  const renameConversation = useConversationStore((state) => state.renameConversation);
  const deleteConversation = useConversationStore((state) => state.deleteConversation);
  const completeOAuthExchange = useAuthStore((state) => state.completeOAuthExchange);
  const lastHandledOAuthTicket = useAuthStore((state) => state.lastHandledOAuthTicket);
  const hasAuthSession = useAuthStore((state) => Boolean(state.accessToken || state.refreshToken));
  const isAgentProcessing = useAgentStore((state) => state.isProcessing);
  const resetAgentState = useAgentStore((state) => state.reset);
  const addToast = useUIStore((state) => state.addToast);
  const processedDeepLinksRef = useRef<Set<string>>(new Set());

  const currentMode: "home" | "editor" | "agent" | "settings" = location.pathname === "/settings"
    ? "settings"
    : location.pathname.includes("agent")
    ? "agent"
    : location.pathname.includes("editor")
    ? "editor"
    : "home";
  const isSettingsRoute = location.pathname === "/settings";

  // 打开新项目的处理函数
  const handleNewProject = async () => {
    // 先关闭当前项目并清除所有打开的文件
    closeProject();
    closeAllFiles();

    await openProject();

    // 检查是否成功打开了项目
    const { currentProject } = useProjectStore.getState();
    if (currentProject) {
      navigate("/editor");
    }
  };

  const handleCreateAgentSession = () => {
    if (isAgentProcessing) {
      return;
    }

    const conversationId = createConversation();
    resetAgentState();
    navigate("/agent");
    setCurrentConversation(conversationId);
  };

  const handleSelectAgentSession = (conversationId: string) => {
    if (isAgentProcessing) {
      return;
    }

    resetAgentState();
    setCurrentConversation(conversationId);
    if (!location.pathname.includes("agent")) {
      navigate("/agent");
    }
  };

  const handleDeleteAgentSession = (conversationId: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isAgentProcessing) {
      return;
    }

    deleteConversation(conversationId);
    if (conversationId === currentConversationId) {
      resetAgentState();
    }
  };

  const handleRenameAgentSession = (conversationId: string, title: string) => {
    if (isAgentProcessing) {
      return;
    }

    renameConversation(conversationId, title);
  };

  useEffect(() => {
    let cancelled = false;

    const processUrls = async (urls: string[] | null | undefined) => {
      for (const url of Array.isArray(urls) ? urls : []) {
        if (cancelled || processedDeepLinksRef.current.has(url)) {
          continue;
        }

        const payload = parseOAuthDeepLinkUrl(url);
        if (!payload) {
          continue;
        }

        processedDeepLinksRef.current.add(url);

        if (payload.error) {
          addToast({ type: "error", message: payload.error });
          navigate("/settings?tab=account", { replace: true });
          continue;
        }

        if (!payload.ticket) {
          continue;
        }

        if (payload.ticket === lastHandledOAuthTicket) {
          continue;
        }

        const result = await completeOAuthExchange(payload.ticket, payload.provider);
        if (cancelled) {
          return;
        }

        if (result.success) {
          addToast({
            type: "success",
            message: `${getOAuthProviderLabel(payload.provider)} 登录成功。`,
          });
        } else if (
          result.error &&
          !(hasAuthSession && result.error.includes("OAuth 交换票据无效或已过期"))
        ) {
          addToast({ type: "error", message: result.error });
        }

        navigate("/settings?tab=account", { replace: true });
      }
    };

    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        await processUrls(await getCurrentDeepLinks());
        unsubscribe = await onDeepLinkOpen(processUrls);
      } catch (error) {
        if (cancelled) {
          return;
        }

        addToast({
          type: "error",
          message:
            error instanceof Error ? error.message : "处理桌面登录回调时发生未知错误",
        });
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [addToast, completeOAuthExchange, hasAuthSession, lastHandledOAuthTicket, navigate]);

  return (
    <div className="h-screen w-full bg-obsidian flex flex-col text-zinc-100 overflow-hidden">
      <TopBar
        onToggleRightSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
        rightSidebarOpen={rightSidebarOpen}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Left Sidebar - Always visible */}
          {leftSidebarOpen && (
            <>
              <Panel defaultSize={18} minSize={15} maxSize={30} id="left-sidebar" order={1}>
                <aside className="h-full bg-charcoal border-r border-graphite flex flex-col">
                  <div className="p-4 flex flex-col gap-6 flex-1 overflow-y-auto scrollbar-thin">
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
                      <section className="flex-1 flex flex-col overflow-hidden">
                        <ProjectFileTree className="flex-1" />
                      </section>
                    )}

                    {currentMode === "agent" && (
                      <section className="flex-1 -mt-4 min-h-0">
                        <div className="flex items-center justify-between px-2 mb-3">
                          <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Recent Sessions</h3>
                          <button
                            onClick={handleCreateAgentSession}
                            disabled={isAgentProcessing}
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                              isAgentProcessing
                                ? "cursor-not-allowed text-zinc-700"
                                : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                            )}
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
                                isActive={conversation.id === currentConversationId}
                                disabled={isAgentProcessing}
                                onClick={() => handleSelectAgentSession(conversation.id)}
                                onDelete={(event) => handleDeleteAgentSession(conversation.id, event)}
                                onRename={(title) => handleRenameAgentSession(conversation.id, title)}
                              />
                            ))
                          ) : (
                            <div className="px-3 py-5 text-center text-xs text-zinc-600">
                              还没有 agent 会话
                            </div>
                          )}
                        </div>
                      </section>
                    )}
                  </div>

                  <div className="mt-auto pb-4 px-6 pt-2">
                    <div
                      onClick={() => navigate("/settings")}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={cn(
                        "flex items-center gap-2 transition-colors cursor-pointer group w-fit",
                        location.pathname === "/settings"
                          ? "text-zinc-200"
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <Settings size={14} className="group-hover:rotate-45 transition-transform duration-300" />
                      <span className="text-[13px]">Settings</span>
                    </div>
                  </div>
                </aside>
              </Panel>
              <PanelResizeHandle className="w-px bg-graphite hover:bg-zinc-600 transition-colors" />
            </>
          )}

          {/* Main Content Area */}
          <Panel id="main-content" order={2}>
            <main className="h-full relative overflow-hidden">
              <div className="absolute inset-0 bg-[#0a0a0a] rounded-xl sm:rounded-2xl border border-white/[0.04] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] overflow-hidden m-0.5 sm:mb-2 sm:mt-1 sm:mx-2 lg:mb-4 lg:mt-2 lg:mx-4">
                <div className="h-full w-full overflow-hidden relative rounded-xl sm:rounded-2xl flex flex-col">
                  {isSettingsRoute ? (
                    <div className="h-full w-full">
                      <Outlet />
                    </div>
                  ) : (
                    <AnimatePresence initial={false} mode="sync">
                      <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="h-full w-full"
                      >
                        <Outlet />
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </main>
          </Panel>

          {/* Right Sidebar (Context/History) */}
          {rightSidebarOpen && (
            <>
              <PanelResizeHandle className="w-px bg-graphite hover:bg-zinc-600 transition-colors" />
              <Panel defaultSize={22} minSize={20} maxSize={40} id="right-sidebar" order={3}>
                <aside className="h-full bg-charcoal border-l border-graphite flex flex-col overflow-y-auto">
                  <div className="p-4 border-b border-graphite flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-300">Context & History</span>
                    <button onClick={() => setRightSidebarOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    <HistoryItem
                      title="Refactored Layout"
                      time="2m ago"
                      desc="Applied dark mode hierarchy to the main layout component."
                      type="edit"
                    />
                    <HistoryItem
                      title="Agent: Task Completed"
                      time="15m ago"
                      desc="Successfully deployed the landing page to Vercel."
                      type="agent"
                    />
                    <HistoryItem
                      title="Explaining Flexbox"
                      time="1h ago"
                      desc="Asked AI for a summary of CSS grid vs flexbox."
                      type="info"
                    />
                  </div>
                </aside>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {/* Global AI Status Indicator (Floating) */}
      <div className="fixed bottom-4 left-4 z-50">
        <div className="slate-glass px-3 py-2 rounded-full flex items-center gap-2 border border-zinc-800 shadow-2xl">
          <div className="w-5 h-5 ai-pulse">
            <SimpleLogo size={20} />
          </div>
          <span className="text-[10px] font-bold text-zinc-400 tracking-wider">SLATE AI READY</span>
        </div>
      </div>
    </div>
  );
}

// Helper components
interface NavItemProps {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, active = false, onClick }: NavItemProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all",
        active ? "bg-zinc-800/80 text-zinc-100" : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
      )}
    >
      <Icon size={16} />
      <span>{label}</span>
    </div>
  );
}

function formatConversationDate(timestamp: number): string {
  const delta = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (delta < minute) {
    return "Just now";
  }

  if (delta < hour) {
    return `${Math.max(1, Math.floor(delta / minute))}m ago`;
  }

  if (delta < day) {
    return `${Math.floor(delta / hour)}h ago`;
  }

  if (delta < day * 7) {
    return `${Math.floor(delta / day)}d ago`;
  }

  return new Date(timestamp).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

function SessionItem({
  title,
  date,
  isActive = false,
  disabled = false,
  onClick,
  onDelete,
  onRename,
}: {
  title: string;
  date: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  onDelete: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onRename: (title: string) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  const commitRename = () => {
    setIsRenaming(false);
    const nextTitle = draftTitle.trim();
    if (nextTitle && nextTitle !== title) {
      onRename(nextTitle);
    } else {
      setDraftTitle(title);
    }
  };

  return (
    <div
      onClick={() => !disabled && !isRenaming && onClick()}
      onMouseLeave={() => setIsConfirmingDelete(false)}
      className={cn(
        "group relative flex flex-col gap-1 rounded-lg border px-3 py-2 transition-all",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        isActive ? "border-zinc-700 bg-zinc-800/80" : "border-transparent hover:bg-zinc-800/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {isRenaming ? (
          <input
            ref={inputRef}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={commitRename}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commitRename();
              }

              if (event.key === "Escape") {
                setDraftTitle(title);
                setIsRenaming(false);
              }
            }}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
        ) : (
          <span
            className={cn(
              "pr-10 text-sm font-medium",
              isActive ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-200"
            )}
          >
            {title}
          </span>
        )}

        {!isRenaming && (
          <div
            className={cn(
              "absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity",
              !disabled && "group-hover:opacity-100",
              isActive && !disabled && "opacity-100"
            )}
          >
            {isConfirmingDelete ? (
              <>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(event);
                    setIsConfirmingDelete(false);
                  }}
                  className="rounded bg-zinc-800/80 p-1 text-red-400 transition-colors hover:bg-zinc-700 hover:text-red-300"
                  title="Confirm"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsConfirmingDelete(false);
                  }}
                  className="rounded bg-zinc-800/80 p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
                  title="Cancel"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    if (disabled) return;
                    setIsRenaming(true);
                  }}
                  className="rounded bg-zinc-800/80 p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
                  title="Rename"
                >
                  <PenSquare size={12} />
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    if (disabled) return;
                    setIsConfirmingDelete(true);
                  }}
                  className="rounded bg-zinc-800/80 p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {!isRenaming && (
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-widest",
            isActive ? "text-zinc-500" : "text-zinc-600"
          )}
        >
          {isConfirmingDelete ? <span className="text-red-400/80">Confirm Delete?</span> : date}
        </span>
      )}
    </div>
  );
}

interface HistoryItemProps {
  title: string;
  time: string;
  desc: string;
  type: 'edit' | 'agent' | 'info';
}

function HistoryItem({ title, time, desc, type }: HistoryItemProps) {
  const colors = {
    edit: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    agent: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    info: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
  };

  return (
    <div className="p-3 rounded-xl border border-graphite bg-obsidian/40 space-y-2 hover:border-zinc-700 transition-colors cursor-pointer group">
      <div className="flex items-center justify-between">
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-tighter", colors[type])}>
          {type}
        </span>
        <span className="text-[10px] text-zinc-600 font-medium">{time}</span>
      </div>
      <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">{title}</h4>
      <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">{desc}</p>
    </div>
  );
}
