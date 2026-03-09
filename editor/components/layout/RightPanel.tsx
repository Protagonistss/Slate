import { useLocation } from "react-router";
import {
  MessageSquare,
  FileCode,
  History,
  ChevronRight,
  Zap,
  Layers,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SimpleLogo } from "../shared";

interface SuggestionCardProps {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  desc: string;
  variant?: "blue" | "purple" | "green";
}

export function RightPanel() {
  const location = useLocation();
  const isEditor = location.pathname === "/editor";
  const isAgent = location.pathname === "/agent";

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] p-5 space-y-8 overflow-y-auto scrollbar-thin">
      {/* Suggestions Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          <span>AI INSIGHTS</span>
          <div className="w-4 h-4 text-blue-400 animate-pulse">
            <SimpleLogo size={16} />
          </div>
        </div>

        <div className="space-y-3">
          {isEditor ? (
            <>
              <SuggestionCard
                icon={Zap}
                title="Refactor function"
                desc="Simplify the loop in calculateTotal."
                variant="blue"
              />
              <SuggestionCard
                icon={FileCode}
                title="Add unit tests"
                desc="Generate 3 test cases for useAuth."
                variant="purple"
              />
            </>
          ) : (
            <>
              <SuggestionCard
                icon={Activity}
                title="Goal Progress"
                desc="80% completed. Waiting for server response."
                variant="green"
              />
              <SuggestionCard
                icon={Layers}
                title="Generated Assets"
                desc="3 new components created in /src."
                variant="blue"
              />
            </>
          )}
        </div>
      </section>

      {/* Context Section */}
      <section className="space-y-4">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          <span>CONTEXT</span>
        </div>

        <div className="bg-[#121212] rounded-2xl border border-[#262626] overflow-hidden">
          <div className="p-4 border-b border-[#262626] flex items-center justify-between group cursor-pointer hover:bg-[#1a1a1a] transition-colors">
            <div className="flex items-center gap-3">
              <FileCode size={16} className="text-zinc-500" />
              <span className="text-sm font-medium text-zinc-300">App.tsx</span>
            </div>
            <ChevronRight size={14} className="text-zinc-600 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="p-4 border-b border-[#262626] flex items-center justify-between group cursor-pointer hover:bg-[#1a1a1a] transition-colors">
            <div className="flex items-center gap-3">
              <History size={16} className="text-zinc-500" />
              <span className="text-sm font-medium text-zinc-300">Last commit</span>
            </div>
            <span className="text-[10px] text-zinc-600">3h ago</span>
          </div>
          <div className="p-4 flex items-center justify-between group cursor-pointer hover:bg-[#1a1a1a] transition-colors">
            <div className="flex items-center gap-3">
              <MessageSquare size={16} className="text-zinc-500" />
              <span className="text-sm font-medium text-zinc-300">Session logs</span>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mt-auto pt-6 border-t border-[#262626]">
        <button className="w-full py-3 bg-[#262626] hover:bg-[#333] text-zinc-300 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 group">
          <span>Explain this code</span>
          <ChevronRight size={14} className="text-zinc-500 group-hover:translate-x-1 transition-transform" />
        </button>
      </section>
    </div>
  );
}

function SuggestionCard({ icon: Icon, title, desc, variant = "blue" }: SuggestionCardProps) {
  const colors = {
    blue: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    purple: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    green: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  }[variant];

  return (
    <div className="p-4 bg-[#121212] rounded-2xl border border-[#262626] hover:border-[#333] transition-all group cursor-pointer">
      <div className="flex items-start gap-3 mb-2">
        <div className={cn("p-2 rounded-xl border", colors)}>
          <Icon size={16} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-zinc-100 mb-0.5">{title}</div>
          <div className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{desc}</div>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button className="text-[11px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
          APPLY
        </button>
      </div>
    </div>
  );
}
