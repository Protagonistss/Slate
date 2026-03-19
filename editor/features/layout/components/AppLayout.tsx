// AppLayout - Main layout component
import { Outlet, useLocation, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle
} from "react-resizable-panels";
import { SimpleLogo } from "@/shared/ui";
import { cn } from "@/lib/utils";
import { TopBar } from "@/features/layout/components";
import { Sidebar } from "./Sidebar/Sidebar";
import { OAuthHandler } from "./OAuthHandler";
import { TerminalPanel } from "@/features/terminal";
import { useTerminalStore } from "@/features/terminal/store";
import { StatusBar } from "./StatusBar";
import { AIStatusIndicator, RightSidebar } from "@/widgets";

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

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 flex overflow-hidden min-h-0">
            <PanelGroup direction="horizontal">
              <Sidebar
                isOpen={leftSidebarOpen}
                currentMode={currentMode}
              />
              {leftSidebarOpen && (
                <PanelResizeHandle className="w-px bg-graphite hover:bg-zinc-600 transition-colors" />
              )}

              <Panel id="center-area" order={2} defaultSize={100} minSize={30}>
                <PanelGroup direction="vertical">
                  <Panel id="main-content" order={1} defaultSize={terminalPanelVisible ? 70 : 100} minSize={30}>
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

                  <TerminalPanel
                    isMaximized={terminalMaximized}
                    onToggleMaximize={() => setTerminalMaximized(!terminalMaximized)}
                  />
                </PanelGroup>
              </Panel>

              {rightSidebarOpen && (
                <>
                  <PanelResizeHandle className="w-px bg-graphite hover:bg-zinc-600 transition-colors" />
                  <RightSidebar onClose={() => setRightSidebarOpen(false)} />
                </>
              )}
            </PanelGroup>
          </div>

          <StatusBar />
        </div>

        <AIStatusIndicator />
      </div>
    </>
  );
}
