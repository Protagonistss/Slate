import { useEffect } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useTerminalStore } from '../store';
import { useProjectStore } from '@/stores';
import { TerminalTabs } from './TerminalTabs';
import { TerminalInstance } from './TerminalInstance';

interface TerminalPanelProps {
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export function TerminalPanel({ isMaximized, onToggleMaximize }: TerminalPanelProps) {
  const sessions = useTerminalStore((s) => s.sessions);
  const activeId = useTerminalStore((s) => s.activeId);
  const panelVisible = useTerminalStore((s) => s.panelVisible);
  const setPanelVisible = useTerminalStore((s) => s.setPanelVisible);
  const createSession = useTerminalStore((s) => s.createSession);
  const currentProject = useProjectStore((s) => s.currentProject);

  useEffect(() => {
    // Prefer project cwd; avoid creating a session with "~" before project loads.
    if (panelVisible && sessions.length === 0 && currentProject?.path) {
      createSession(currentProject.path);
    }
  }, [panelVisible, sessions.length, createSession, currentProject?.path]);

  if (!panelVisible) return null;

  const activeSession = sessions.find((s) => s.id === activeId);
  const runningCount = sessions.filter((s) => s.status === 'running').length;

  return (
    <>
      <PanelResizeHandle className="h-px bg-white/5 hover:bg-zinc-600/80 transition-colors" />
      <Panel
        id="terminal-panel"
        order={2}
        defaultSize={20}
        minSize={10}
        maxSize={50}
        className="flex flex-col bg-[#0c0c0c] rounded-t-lg overflow-hidden border-t border-white/5"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center h-9 px-2 gap-2 shrink-0 bg-transparent rounded-t-lg border-b border-transparent">
            <TerminalTabs />
            {sessions.length > 0 && runningCount > 0 && (
              <span className="text-[10px] text-zinc-600 shrink-0 hidden sm:inline">
                {runningCount} running
              </span>
            )}
            <div className="flex items-center gap-0.5 shrink-0 ml-auto">
              <button
                onClick={onToggleMaximize}
                className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              <button
                onClick={() => setPanelVisible(false)}
                className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Close Panel"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden rounded-b-lg bg-[#0c0c0c]">
            {activeSession ? (
              <TerminalInstance
                key={activeSession.id}
                sessionId={activeSession.id}
                cwd={activeSession.cwd}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                No terminal session
              </div>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
