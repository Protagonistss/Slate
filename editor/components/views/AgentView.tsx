import { useState } from "react";
import { motion } from "motion/react";
import {
  Bot,
  CheckCircle2,
  Circle,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  Terminal,
  FileCode,
  ExternalLink,
  MoreVertical,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  label: string;
  status: 'completed' | 'running' | 'pending';
  result: string;
}

export function AgentView() {
  const [goal, setGoal] = useState("Implement a password strength indicator component and integrate it with the signup form.");
  const [isRunning, setIsRunning] = useState(false);

  const steps: Step[] = [
    { id: 1, label: "Analyze requirements & dependencies", status: "completed", result: "Requirement analysis done. No new dependencies needed." },
    { id: 2, label: "Create PasswordStrength.tsx component", status: "completed", result: "Component created in /src/components/auth/." },
    { id: 3, label: "Add visual strength levels (Weak, Medium, Strong)", status: "running", result: "Applying Tailwind classes for dynamic color changes..." },
    { id: 4, label: "Integrate with SignupForm.tsx", status: "pending", result: "" },
    { id: 5, label: "Verify accessibility & accessibility tests", status: "pending", result: "" },
  ];

  return (
    <div className="flex-1 h-full flex flex-col p-6 lg:p-10 w-full max-w-6xl mx-auto space-y-10 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
      {/* Goal Header */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-zinc-400">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Active Agent Task</h2>
              <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Autonomous Implementation</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                isRunning
                  ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  : "bg-zinc-100 text-zinc-900 hover:bg-white"
              )}
            >
              {isRunning ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              <span>{isRunning ? "Pause Session" : "Resume Session"}</span>
            </button>
            <button className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all">
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        {/* Goal Input Area */}
        <div className="p-5 rounded-xl bg-[#121212] border border-[#262626] relative group">
          <textarea
            className="w-full bg-transparent border-none focus:outline-none text-[15px] text-zinc-300 placeholder-zinc-600 resize-none font-normal leading-[1.6] h-16"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe what you want the agent to achieve..."
          />
          <div className="absolute bottom-3 right-4 flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
            <kbd className="px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900">⌘</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900">ENTER</kbd>
            <span className="ml-2">to update goal</span>
          </div>
        </div>
      </section>

      {/* Main Agent Workspace (Two Columns) */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start pb-10">
        {/* Left Column: Step List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Execution Steps</h3>
            <span className="text-[10px] font-bold text-zinc-600">2 / 5 COMPLETE</span>
          </div>

          <div className="space-y-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "p-3.5 rounded-xl transition-all duration-300 group",
                  step.status === "completed" ? "bg-white/[0.02] border border-white/[0.05]" :
                    step.status === "running" ? "bg-white/[0.04] border border-white/[0.08]" :
                    "bg-transparent border border-transparent opacity-50"
                )}
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5">
                    {step.status === "completed" ? (
                      <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 border border-zinc-700">
                        <CheckCircle2 size={10} />
                      </div>
                    ) : step.status === "running" ? (
                      <div className="w-4 h-4 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-900 border border-white ai-pulse">
                        <Circle size={8} fill="currentColor" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-700">
                        <Circle size={8} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <h4 className={cn(
                      "text-[13px] font-medium transition-colors",
                      step.status === "completed" ? "text-zinc-300" :
                        step.status === "running" ? "text-zinc-100" : "text-zinc-500"
                    )}>
                      {step.label}
                    </h4>
                    {step.result && (
                      <p className="text-[12px] text-zinc-500 leading-relaxed">
                        {step.result}
                      </p>
                    )}
                  </div>
                  <button className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300">
                    <MoreVertical size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Active Output/Preview */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Artifacts</h3>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest hover:text-zinc-200 transition-colors">
                <ExternalLink size={10} />
                Preview URL
              </button>
            </div>
          </div>

          <div className="h-[500px] flex flex-col overflow-hidden rounded-xl border border-[#262626] bg-[#121212] shadow-sm">
            {/* Artifact Toolbar */}
            <div className="h-10 border-b border-[#262626] bg-[#1a1a1a]/50 flex items-center justify-between px-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
                  <FileCode size={12} className="text-zinc-500" />
                  <span>PasswordStrength.tsx</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  <Terminal size={12} />
                  <span>Terminal</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Live</span>
              </div>
            </div>

            {/* Artifact Content (Mock Code) */}
            <div className="flex-1 bg-[#0a0a0a] p-6 overflow-y-auto font-mono text-[13px] text-zinc-400 leading-relaxed scrollbar-thin scrollbar-thumb-zinc-800">
              <pre className="whitespace-pre-wrap">{`import React from 'react';

interface StrengthIndicatorProps {
  password: string;
}

export const PasswordStrength: React.FC<StrengthIndicatorProps> = ({ password }) => {
  const getStrength = (pwd: string) => {
    if (pwd.length === 0) return 0;
    if (pwd.length < 6) return 1;
    if (pwd.length < 10) return 2;
    return 3;
  };

  const strength = getStrength(password);

  return (
    <div className="space-y-2 py-4">
      <div className="flex gap-1 h-1.5">
        <div className={\`flex-1 rounded-full transition-all \${strength >= 1 ? 'bg-red-500' : 'bg-zinc-800'}\`} />
        <div className={\`flex-1 rounded-full transition-all \${strength >= 2 ? 'bg-yellow-500' : 'bg-zinc-800'}\`} />
        <div className={\`flex-1 rounded-full transition-all \${strength >= 3 ? 'bg-emerald-500' : 'bg-zinc-800'}\`} />
      </div>
      <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-600">
        Password Security: <span className="text-zinc-400">Moderate</span>
      </p>
    </div>
  );
};`}</pre>
            </div>

            {/* Decision Bar */}
            <div className="p-3 border-t border-[#262626] bg-[#121212] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                <AlertCircle size={14} className="text-zinc-500" />
                <span>AI is waiting for your approval...</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all">
                  Edit Code
                </button>
                <button className="px-4 py-1.5 rounded-lg bg-zinc-100 text-zinc-900 text-xs font-semibold hover:bg-white shadow-sm transition-all">
                  Approve & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
