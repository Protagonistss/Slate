import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type TabsVariant = "pill" | "underline";

export interface TabsItem {
  id: string;
  label: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  isActive: boolean;
  onSelect: () => void;
  className?: string;
}

export interface TabsProps {
  items: TabsItem[];
  className?: string;
  listClassName?: string;
  itemClassName?: string;
  variant?: TabsVariant;
}

export function Tabs({
  items,
  className,
  listClassName,
  itemClassName,
  variant = "pill",
}: TabsProps) {
  return (
    <div className={cn("flex items-center flex-1 min-w-0 overflow-x-auto", className)}>
      <div className={cn("flex items-center flex-1 min-w-0 gap-px", listClassName)}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onSelect}
            className={cn(
              "group flex items-center gap-2 min-w-0 shrink-0 transition-colors select-none",
              variant === "pill" &&
                (item.isActive
                  ? "bg-zinc-800/80 text-zinc-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"),
              variant === "underline" &&
                (item.isActive
                  ? "bg-zinc-800/50 text-zinc-100 border-b-2 border-b-zinc-400 font-medium"
                  : "text-zinc-500 border-b-2 border-b-transparent hover:text-zinc-300 hover:bg-white/5 font-normal"),
              variant === "pill" ? "px-2.5 h-7 rounded-md" : "h-full px-3 border-b-2",
              itemClassName,
              item.className
            )}
          >
            {item.leading}
            <span className={cn("text-[11px] truncate flex-1", variant === "underline" && "text-[12px]")}>
              {item.label}
            </span>
            {item.trailing}
          </button>
        ))}
      </div>
    </div>
  );
}

