import { Plus, X, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTerminalStore } from '../store';
import { useProjectStore } from '@/stores';

export function TerminalTabs() {
  const sessions = useTerminalStore((s) => s.sessions);
  const activeId = useTerminalStore((s) => s.activeId);
  const setActive = useTerminalStore((s) => s.setActive);
  const closeSession = useTerminalStore((s) => s.closeSession);
  const createSession = useTerminalStore((s) => s.createSession);
  const currentProject = useProjectStore((s) => s.currentProject);
  const cwd = currentProject?.path;

  if (sessions.length === 0) {
    return (
      <div className="flex items-center flex-1 min-w-0">
        <span className="text-[11px] text-zinc-500 truncate">No terminals</span>
        <button
          onClick={() => createSession(cwd)}
          className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 ml-1"
          title="New Terminal"
        >
          <Plus size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center flex-1 min-w-0 overflow-x-auto">
      <div className="flex items-center flex-1 min-w-0 gap-px">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              'group flex items-center gap-2 px-2.5 h-7 cursor-pointer min-w-[88px] max-w-[140px] rounded-md transition-colors shrink-0',
              activeId === session.id
                ? 'bg-zinc-800/80 text-zinc-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            )}
            onClick={() => setActive(session.id)}
          >
            <Terminal size={11} className="shrink-0 text-zinc-500" strokeWidth={1.5} />
            <span className="text-[11px] truncate flex-1">{session.title}</span>
            {session.status === 'running' && (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/90 shadow-[0_0_6px_rgba(16,185,129,0.35)] shrink-0" />
            )}
            {session.status === 'exited' && (
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500/70 shrink-0" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeSession(session.id);
              }}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 shrink-0 transition-opacity"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => createSession(cwd)}
        className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 ml-0.5"
        title="New Terminal"
      >
        <Plus size={13} strokeWidth={1.5} />
      </button>
    </div>
  );
}
