import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type IconButtonSize = "sm" | "md";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
}

export function IconButton({ size = "md", className, type, ...props }: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        "rounded-md transition-colors text-zinc-500 hover:text-zinc-300 hover:bg-white/5",
        size === "sm" ? "p-1" : "p-1.5",
        className
      )}
      {...props}
    />
  );
}

