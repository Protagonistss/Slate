import { Outlet, useLocation, useNavigate } from "react-router";
import { useState } from "react";
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
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SimpleLogo } from "../shared";
import { useProjectStore, useEditorStore } from "@/stores";

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const { openProject, closeProject } = useProjectStore();
  const { closeAllFiles } = useEditorStore();

  const currentMode = location.pathname.includes("agent") ? "agent" : location.pathname.includes("editor") ? "editor" : "home";

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
                    {currentMode !== "editor" && (
                      <section>
                        <div className="space-y-1">
                          {currentMode !== "agent" && (
                            <NavItem
                              icon={Home}
                              label="Home"
                              active={currentMode === "home"}
                              onClick={() => navigate("/")}
                            />
                          )}
                          {currentMode !== "agent" && (
                            <>
                              <NavItem
                                icon={PencilLine}
                                label="New Project"
                                active={currentMode === "editor"}
                                onClick={handleNewProject}
                              />
                              <NavItem
                                icon={Bot}
                                label="New Agent"
                                active={currentMode === "agent"}
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
                      <section className="flex-1 -mt-4">
                        <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-2 mb-3">Recent Sessions</h3>
                        <div className="space-y-1">
                          <SessionItem title="Auth Flow Overhaul" date="Today, 2:30 PM" />
                          <SessionItem title="Deployment Script" date="Yesterday" />
                          <SessionItem title="Slate UI System" date="Last week" />
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
              <div className="absolute inset-0 bg-[#0a0a0a] rounded-xl sm:rounded-2xl border border-white/[0.04] shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] overflow-hidden m-0.5 sm:m-2 lg:m-4">
                <div className="h-full w-full overflow-hidden relative rounded-xl sm:rounded-2xl flex flex-col">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={location.pathname}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="h-full w-full"
                    >
                      <Outlet />
                    </motion.div>
                  </AnimatePresence>
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
  icon: React.ComponentType<{ size?: number }>;
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

function SessionItem({ title, date }: { title: string; date: string }) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2 rounded-lg cursor-pointer transition-all hover:bg-zinc-800/40 group">
      <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200 truncate">{title}</span>
      <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{date}</span>
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

// Legacy export for compatibility
export interface AppLayoutProps {
  children: React.ReactNode;
  agentPanel?: React.ReactNode;
}

export const AppLayoutLegacy = ({ children, agentPanel }: AppLayoutProps) => {
  return <AppLayout />;
};
