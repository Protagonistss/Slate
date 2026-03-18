// AppLayout - Main layout component
import { Outlet, useLocation, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle
} from "react-resizable-panels";
import { SimpleLogo } from "@/components/shared";
import { cn } from "@/lib/utils";
import { TopBar } from "@/features/layout/components";
import { Sidebar } from "./Sidebar/Sidebar";
import { OAuthHandler } from "./OAuthHandler";
import { TerminalPanel } from "@/features/terminal";
import { useTerminalStore } from "@/features/terminal/store";

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [terminalMaximized, setTerminalMaximized] = useState(false);

  const terminalPanelVisible = useTerminalStore((s) => s.panelVisible);
  const togglePanel = useTerminalStore((s) => s.togglePanel);

  const currentMode: "home" | "editor" | "agent" | "settings" = location.pathname === "/settings"
    ? "settings"
    : location.pathname.includes("agent")
    ? "agent"
    : location.pathname.includes("editor")
    ? "editor"
    : "home";
  const isSettingsRoute = location.pathname === "/settings";
  const shouldAnimateOutlet = !isSettingsRoute && currentMode !== "agent";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        togglePanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePanel]);

  return (
    <>
      <OAuthHandler />
      <div className="h-screen w-full bg-obsidian flex flex-col text-zinc-100 overflow-hidden">
        <TopBar
          onToggleRightSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
          rightSidebarOpen={rightSidebarOpen}
        />

        <div className="flex-1 flex overflow-hidden">
          <PanelGroup direction="vertical">
            <Panel id="main-workspace" order={1} defaultSize={terminalPanelVisible ? 80 : 100} minSize={50}>
              <PanelGroup direction="horizontal">
                <Sidebar
                  isOpen={leftSidebarOpen}
                  currentMode={currentMode}
                />
                {leftSidebarOpen && (
                  <PanelResizeHandle className="w-px bg-graphite hover:bg-zinc-600 transition-colors" />
                )}

                <Panel id="main-content" order={2}>
                  <main className="h-full relative overflow-hidden flex flex-col bg-obsidian">
                    <div className="flex-1 h-full w-full relative flex flex-col z-0">
                      <div className="flex-1 h-full w-full relative flex flex-col z-0 bg-charcoal/20">
                        {!shouldAnimateOutlet ? (
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

                {rightSidebarOpen && (
                  <>
                    <PanelResizeHandle className="w-px bg-graphite hover:bg-zinc-600 transition-colors" />
                    <RightSidebar onClose={() => setRightSidebarOpen(false)} />
                  </>
                )}
              </PanelGroup>
            </Panel>

            <TerminalPanel
              isMaximized={terminalMaximized}
              onToggleMaximize={() => setTerminalMaximized(!terminalMaximized)}
            />
          </PanelGroup>
        </div>

        <AIStatusIndicator />
      </div>
    </>
  );
}

function RightSidebar({ onClose }: { onClose: () => void }) {
  return (
    <Panel defaultSize={22} minSize={20} maxSize={40} id="right-sidebar" order={3}>
      <aside className="h-full bg-charcoal border-l border-graphite flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-graphite flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-300">Context & History</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6" />
              <path d="m15 18-6-6" />
            </svg>
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
  );
}

function AIStatusIndicator() {
  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="slate-glass px-3 py-2 rounded-full flex items-center gap-2 border border-zinc-800 shadow-2xl">
        <div className="w-5 h-5 ai-pulse">
          <SimpleLogo size={20} />
        </div>
        <span className="text-[10px] font-bold text-zinc-400 tracking-wider">SLATE AI READY</span>
      </div>
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
