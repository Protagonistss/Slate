import { ChevronDown, ChevronUp, X, Maximize2, Minimize2 } from 'lucide-react';
import { Panel, PanelResizeHandle } from 'react-resizable-panels';
import { cn } from '@/lib/utils';
import { useTerminalStore } from '../store';
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

  if (!panelVisible) return null;

  const activeSession = sessions.find((s) => s.id === activeId);

  return (
    <>
      <PanelResizeHandle className="h-px bg-graphite hover:bg-zinc-600 transition-colors" />
      <Panel
        id="terminal-panel"
        order={2}
        defaultSize={20}
        minSize={10}
        maxSize={50}
        className="flex flex-col bg-obsidian"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-2 py-1 bg-obsidian border-b border-graphite shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Terminal
              </span>
              {sessions.length > 0 && (
                <span className="text-[10px] text-zinc-600">
                  {sessions.filter((s) => s.status === 'running').length} running
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleMaximize}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={() => setPanelVisible(false)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                title="Close Panel"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <TerminalTabs />

          <div className="flex-1 min-h-0 overflow-hidden">
            {activeSession ? (
              <TerminalInstance
                key={activeSession.id}
                sessionId={activeSession.id}
                cwd={activeSession.cwd}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                No terminal session
              </div>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
