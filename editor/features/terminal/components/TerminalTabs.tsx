import { Plus, X, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTerminalStore } from '../store';

export function TerminalTabs() {
  const sessions = useTerminalStore((s) => s.sessions);
  const activeId = useTerminalStore((s) => s.activeId);
  const setActive = useTerminalStore((s) => s.setActive);
  const closeSession = useTerminalStore((s) => s.closeSession);
  const createSession = useTerminalStore((s) => s.createSession);

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-between px-2 h-9 bg-obsidian border-b border-graphite">
        <span className="text-xs text-zinc-500">No terminals</span>
        <button
          onClick={() => createSession()}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          title="New Terminal"
        >
          <Plus size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center h-9 bg-obsidian border-b border-graphite overflow-x-auto">
      <div className="flex items-center flex-1 min-w-0">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              "group flex items-center gap-1.5 px-3 h-full border-r border-graphite cursor-pointer min-w-[100px] max-w-[160px]",
              activeId === session.id
                ? "bg-charcoal text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
            )}
            onClick={() => setActive(session.id)}
          >
            <Terminal size={12} className="shrink-0" />
            <span className="text-xs truncate flex-1">{session.title}</span>
            {session.status === 'running' && (
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            )}
            {session.status === 'exited' && (
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeSession(session.id);
              }}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => createSession()}
        className="p-2 h-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-l border-graphite"
        title="New Terminal"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
