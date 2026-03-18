// TimelineToolCallNode - 工具调用节点
import { Database, Search, Terminal, FileCode, AlertCircle, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimelineNode, TimelineCodeBlock } from "./TimelineNode";
import type { ToolCallRecord } from "@/features/agent/store/types";

const TOOL_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  postgres_query: { icon: Database, label: "Executing database query" },
  search_files: { icon: Search, label: "Searching codebase" },
  bash: { icon: Terminal, label: "Running shell command" },
  read_file: { icon: FileCode, label: "Reading file" },
  write_file: { icon: FileCode, label: "Writing file" },
};

const DefaultToolConfig = { icon: Terminal, label: "Executing tool" };

export interface TimelineToolCallNodeProps {
  toolCall: ToolCallRecord;
  isExpanded: boolean;
  onToggle: () => void;
  onConfirm?: () => void;
  onReject?: () => void;
}

export function TimelineToolCallNode({
  toolCall,
  isExpanded,
  onToggle,
  onConfirm,
  onReject,
}: TimelineToolCallNodeProps) {
  const config = TOOL_CONFIG[toolCall.name] || DefaultToolConfig;
  const Icon = config.icon;
  const isBlocked = toolCall.status === "pending" || toolCall.status === "running";
  const isSuccess = toolCall.status === "success";
  const isError = toolCall.status === "error";

  const previewText = isSuccess
    ? `✓ Successfully executed${toolCall.result ? ` returning ${typeof toolCall.result === 'object' ? 'data' : 'result'}.` : "."}`
    : isError
    ? `✗ ${toolCall.error || "Execution failed."}`
    : isBlocked
    ? "Executing..."
    : "";

  const inputStr = toolCall.input
    ? typeof toolCall.input === "string"
      ? toolCall.input
      : JSON.stringify(toolCall.input, null, 2)
    : "";

  const resultStr = toolCall.result
    ? typeof toolCall.result === "string"
      ? toolCall.result
      : JSON.stringify(toolCall.result, null, 2)
    : "";

  return (
    <TimelineNode
      icon={<Icon size={12} className={cn(
        isBlocked ? "text-amber-500/80" : isError ? "text-red-400" : "text-zinc-500"
      )} />}
      iconBg={isBlocked ? "bg-zinc-900/40" : undefined}
      iconBorder={isBlocked ? "border-zinc-800/80" : undefined}
      label={toolCall.name}
      subLabel={config.label}
      preview={previewText}
      isExpanded={isExpanded}
      onToggle={onToggle}
    >
      {isBlocked && inputStr ? (
        <div className="p-2.5 rounded-md border border-zinc-800/30 bg-zinc-900/20 transition-all">
          <div className="text-[10px] font-mono text-zinc-500 mb-2.5 whitespace-pre-wrap">
            {inputStr.length > 200 ? inputStr.slice(0, 200) + "..." : inputStr}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/30">
            <span className="text-[10px] font-medium text-zinc-400 flex items-center gap-1.5">
              <AlertCircle size={12} className="text-amber-500/60" /> Requires confirmation
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject?.();
                }}
                className="px-2 py-1 rounded text-[10px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirm?.();
                }}
                className="px-2 py-1 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
              >
                Confirm & Run
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-zinc-500 font-mono leading-relaxed transition-all duration-300">
          <div className={isExpanded ? "hidden" : "line-clamp-1"}>
            <span className="text-zinc-600 mr-2">✓</span>
            {previewText}
          </div>
          {isExpanded && resultStr && (
            <TimelineCodeBlock>
              <pre className="whitespace-pre-wrap">{resultStr}</pre>
            </TimelineCodeBlock>
          )}
        </div>
      )}
    </TimelineNode>
  );
}
