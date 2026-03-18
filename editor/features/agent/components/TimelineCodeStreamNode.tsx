// TimelineCodeStreamNode - 代码流式生成节点（带动画）
import { PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineCodeStreamNodeProps {
  path: string;
  content: string;
}

export function TimelineCodeStreamNode({ path, content }: TimelineCodeStreamNodeProps) {
  const lines = content.split("\n");
  const lastLineIndex = lines.length - 1;

  return (
    <div className="group flex gap-4 pb-8 relative">
      <div className="absolute top-6 bottom-[-8px] left-[11px] w-px bg-zinc-800/40 group-last:hidden" />
      <div className="w-6 h-6 rounded-full bg-zinc-200 border border-zinc-300 flex items-center justify-center shrink-0 z-10 relative mt-0.5 shadow-[0_0_10px_rgba(228,228,231,0.1)]">
        <PencilLine size={12} className="text-zinc-900" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-medium text-zinc-100">{path}</span>
          <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            Generating
            <span className="flex gap-0.5 mt-1">
              <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </span>
        </div>
        <div className="mt-2 text-[11px] font-mono text-zinc-400 bg-transparent border-none overflow-hidden rounded-md">
          <pre className="whitespace-pre leading-relaxed">
            {lines.map((line, index) => (
              <span key={index}>
                {index === lastLineIndex ? (
                  <>
                    <span className="text-zinc-600">{line}</span>
                    <span className="inline-block w-1.5 h-3 bg-zinc-400 animate-[pulse_1s_ease-in-out_infinite] align-middle mt-1" />
                  </>
                ) : (
                  <span className="text-zinc-600">{line}</span>
                )}
                {index < lines.length - 1 && "\n"}
              </span>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
