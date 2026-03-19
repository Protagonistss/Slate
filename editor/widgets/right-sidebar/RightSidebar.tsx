import { cn } from "@/lib/utils";
import { Panel } from "react-resizable-panels";

interface HistoryItemProps {
  title: string;
  time: string;
  desc: string;
  type: "edit" | "agent" | "info";
}

function HistoryItem({ title, time, desc, type }: HistoryItemProps) {
  const colors = {
    edit: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    agent: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    info: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };

  return (
    <div className="p-3 rounded-xl border border-graphite bg-obsidian/40 space-y-2 hover:border-zinc-700 transition-colors cursor-pointer group">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-tighter",
            colors[type]
          )}
        >
          {type}
        </span>
        <span className="text-[10px] text-zinc-600 font-medium">{time}</span>
      </div>
      <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
        {title}
      </h4>
      <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">{desc}</p>
    </div>
  );
}

export function RightSidebar({ onClose }: { onClose: () => void }) {
  return (
    <Panel defaultSize={22} minSize={20} maxSize={40} id="right-sidebar" order={3}>
      <aside className="h-full bg-charcoal border-l border-graphite flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-graphite flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-300">Context & History</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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

