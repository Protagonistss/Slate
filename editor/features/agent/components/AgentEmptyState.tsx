// AgentEmptyState 组件 - 显示空状态和初始化界面
import { useState } from "react";
import { motion } from "motion/react";
import { Layout, FileCode, Globe, Terminal, Bot, Plus, Settings, Play } from "lucide-react";
import { AgentModelSelect } from "@/features/agent/components";

interface AgentEmptyStateProps {
  onStart: (goal: string) => void;
}

export function AgentEmptyState({ onStart }: AgentEmptyStateProps) {
  const [input, setInput] = useState("");
  const canInitialize = input.trim().length > 0;
  const suggestions = [
    { icon: <Layout size={16} />, text: "Build a complete authentication flow with Next.js and Supabase" },
    { icon: <FileCode size={16} />, text: "Create a Kanban board application using React and Tailwind" },
    { icon: <Globe size={16} />, text: "Set up a landing page with dark mode and smooth scrolling" },
    { icon: <Terminal size={16} />, text: "Write a Python script to scrape hacker news and save to CSV" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 flex items-center gap-3"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-graphite bg-charcoal text-zinc-400 shadow-sm">
          <Bot size={18} />
        </div>
        <div>
          <h1 className="text-[14px] font-medium leading-tight tracking-tight text-zinc-200">
            New Agent Session
          </h1>
          <p className="mt-0.5 text-[13px] leading-tight text-zinc-500">
            Describe your goal and let the agent build it for you.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="mb-8 flex flex-col rounded-xl border border-graphite bg-charcoal shadow-sm transition-all focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600/20"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="What do you want to build today?"
          className="min-h-[120px] w-full resize-none bg-transparent p-4 pb-0 text-[15px] leading-relaxed text-zinc-200 placeholder-zinc-600 focus:outline-none"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && input.trim()) {
              event.preventDefault();
              onStart(input.trim());
            }
          }}
        />
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-1 text-zinc-500">
            <button className="rounded-lg p-2 transition-colors hover:bg-white/5 hover:text-zinc-300" title="Add context">
              <Plus size={16} />
            </button>
            <button className="rounded-lg p-2 transition-colors hover:bg-white/5 hover:text-zinc-300" title="Settings">
              <Settings size={16} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <AgentModelSelect className="mr-2" />
            <div className="hidden items-center gap-1.5 text-[11px] font-medium text-zinc-500 sm:flex">
              <span>Press</span>
              <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-sans">Enter</kbd>
            </div>
            <button
              onClick={() => {
                if (!canInitialize) {
                  return;
                }
                onStart(input.trim());
              }}
              disabled={!canInitialize}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 py-1.5 text-[13px] font-semibold text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={14} fill="currentColor" />
              Initialize
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4 }}>
        <div className="mb-2 mt-2 flex items-center gap-3 px-1">
          <span className="text-[11px] font-medium text-zinc-600">Suggestions</span>
          <div className="h-px flex-1 bg-zinc-800/40" />
        </div>
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {suggestions.map((item, index) => (
            <button
              key={index}
              onClick={() => onStart(item.text)}
              className="group flex items-center gap-2.5 rounded-lg border border-transparent bg-transparent px-2.5 py-2 text-left text-[12px] text-zinc-500 transition-all hover:border-zinc-800/60 hover:bg-zinc-800/20 hover:text-zinc-300"
            >
              <div className="shrink-0 scale-[0.85] text-zinc-600 transition-colors group-hover:text-zinc-400">
                {item.icon}
              </div>
              <span className="truncate">{item.text}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
