import type { ReactNode } from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  showCloseButton?: boolean;
  className?: string;
}

const sizeClass: Record<ModalSize, string> = {
  sm: "w-[400px] max-w-[90vw]",
  md: "w-[600px] max-w-[90vw]",
  lg: "w-[800px] max-w-[90vw]",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showCloseButton = true,
  className,
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "bg-[#252526] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.4)] max-h-[90vh] flex flex-col animate-in slide-in-from-top-5 fade-in duration-200",
          sizeClass[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#3c3c3c]">
            {title ? (
              <h2 className="m-0 text-lg font-semibold text-zinc-200">{title}</h2>
            ) : (
              <div />
            )}
            {showCloseButton ? (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
        )}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

