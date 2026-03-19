import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type LoadingSize = "sm" | "md" | "lg";

export interface LoadingProps {
  size?: LoadingSize;
  text?: ReactNode;
  fullScreen?: boolean;
  className?: string;
}

const sizeClass: Record<LoadingSize, string> = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-[3px]",
};

export function Loading({ size = "md", text, fullScreen = false, className }: LoadingProps) {
  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div
        className={cn(
          "rounded-full border-zinc-700 border-t-zinc-400 animate-spin",
          sizeClass[size]
        )}
        aria-hidden
      />
      {text ? <div className="text-sm text-zinc-500">{text}</div> : null}
    </div>
  );

  if (!fullScreen) return content;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-obsidian/90">
      {content}
    </div>
  );
}

export function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      <span className="animate-[blink_1.4s_infinite_both]">.</span>
      <span className="animate-[blink_1.4s_infinite_both] [animation-delay:0.2s]">.</span>
      <span className="animate-[blink_1.4s_infinite_both] [animation-delay:0.4s]">.</span>
    </span>
  );
}

