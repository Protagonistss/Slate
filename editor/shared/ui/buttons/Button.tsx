import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed";

const sizeClass: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-[#0078d4] text-white hover:bg-[#106ebe]",
  secondary: "bg-[#3c3c3c] text-[#d4d4d4] border border-[#5c5c5c] hover:bg-[#4c4c4c]",
  danger: "bg-[#d32f2f] text-white hover:bg-[#b71c1c]",
  ghost: "bg-transparent text-[#d4d4d4] hover:bg-white/10",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(base, sizeClass[size], variantClass[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span
          className="h-3.5 w-3.5 rounded-full border-2 border-transparent border-t-current animate-spin"
          aria-hidden
        />
      ) : icon ? (
        <span className="inline-flex items-center" aria-hidden>
          {icon}
        </span>
      ) : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

