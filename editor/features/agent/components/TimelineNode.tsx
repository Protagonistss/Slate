// TimelineNode - 时间线节点基础组件
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export interface TimelineNodeProps {
  icon: ReactNode;
  iconBg?: string;
  iconBorder?: string;
  isActive?: boolean;
  isLast?: boolean;
  label: string;
  subLabel?: string;
  preview?: string;
  isExpanded?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
  extra?: ReactNode;
  className?: string;
  opacity?: number;
}

export function TimelineNode({
  icon,
  iconBg = "bg-zinc-900/40",
  iconBorder = "border-zinc-800/80",
  isActive = false,
  isLast = false,
  label,
  subLabel,
  preview,
  isExpanded = false,
  onToggle,
  children,
  extra,
  className,
  opacity = 1,
}: TimelineNodeProps) {
  const hasChildren = Boolean(children);

  return (
    <div
      className={cn("group flex gap-4 pb-8 relative", className)}
      style={{ opacity }}
    >
      {!isLast && (
        <div className="absolute top-6 bottom-[-8px] left-[11px] w-px bg-zinc-800/40 group-last:hidden" />
      )}
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 relative mt-0.5 border",
          iconBg,
          iconBorder,
          isActive && "shadow-[0_0_10px_rgba(228,228,231,0.1)]"
        )}
      >
        {icon}
      </div>
      <div
        className={cn("flex-1 min-w-0", hasChildren && "cursor-pointer")}
        onClick={hasChildren ? onToggle : undefined}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-mono font-medium", isActive ? "text-zinc-100" : "text-zinc-300")}>
              {label}
            </span>
            {subLabel && (
              <span className="text-[11px] text-zinc-500">{subLabel}</span>
            )}
            {extra}
          </div>
          {hasChildren && (
            <ChevronDown
              size={14}
              className={cn(
                "text-zinc-600 transition-transform duration-200",
                isExpanded ? "rotate-180 opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            />
          )}
        </div>
        {preview && !isExpanded && (
          <div className="text-[11px] text-zinc-500 font-mono leading-relaxed line-clamp-1">
            {preview}
          </div>
        )}
        {isExpanded && children && (
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export function TimelineCodeBlock({ children }: { children: ReactNode }) {
  return (
    <div className="p-3 bg-zinc-900/20 rounded-md border border-zinc-800/30 text-[11px] text-zinc-500 font-mono overflow-x-auto">
      {children}
    </div>
  );
}
