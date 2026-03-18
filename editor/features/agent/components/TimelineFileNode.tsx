// TimelineFileNode - 文件创建/修改节点
import { Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimelineNode, TimelineCodeBlock } from "./TimelineNode";

export interface TimelineFileNodeProps {
  path: string;
  action: "created" | "modified" | "deleted";
  preview?: string;
  content?: string;
  linesAdded?: number;
  linesRemoved?: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export function TimelineFileNode({
  path,
  action,
  preview,
  content,
  linesAdded,
  linesRemoved,
  isExpanded,
  onToggle,
}: TimelineFileNodeProps) {
  const actionLabel = action === "created" ? "Created file" : action === "modified" ? "Modified file" : "Deleted file";
  const previewText = preview || `✓ ${action === "deleted" ? "File deleted" : "Wrote code"}.`;

  return (
    <TimelineNode
      icon={<Code2 size={12} className="text-zinc-500" />}
      label={path}
      subLabel={actionLabel}
      preview={previewText}
      isExpanded={isExpanded}
      onToggle={onToggle}
      extra={
        (linesAdded !== undefined || linesRemoved !== undefined) && (
          <div className="flex items-center gap-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900/30 text-zinc-500 transition-opacity">
            {linesAdded !== undefined && <span className="text-zinc-400">+{linesAdded}</span>}
            {linesRemoved !== undefined && <span className="text-zinc-600">-{linesRemoved}</span>}
          </div>
        )
      }
    >
      <div className="text-[11px] text-zinc-500 font-mono leading-relaxed transition-all duration-300">
        <div className={isExpanded ? "hidden" : "line-clamp-1"}>
          <span className="text-zinc-600 mr-2">✓</span>
          {previewText}
        </div>
        {isExpanded && content && (
          <TimelineCodeBlock>
            <pre className="whitespace-pre">{content}</pre>
          </TimelineCodeBlock>
        )}
      </div>
    </TimelineNode>
  );
}
