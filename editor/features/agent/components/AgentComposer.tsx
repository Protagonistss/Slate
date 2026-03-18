import type { ReactNode, Ref } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentModelSelect } from "./AgentModelSelect";

export type AgentComposerVariant = "primary" | "danger";

export interface AgentComposerProps {
  value: string;
  onChange: (next: string, el?: HTMLTextAreaElement) => void;
  onSubmit: () => void;

  textareaRef?: Ref<HTMLTextAreaElement>;

  disabled?: boolean;
  placeholder?: string;
  rows?: number;

  primaryLabel: ReactNode;
  primaryVariant?: AgentComposerVariant;
  canSubmit?: boolean;

  showModelSelect?: boolean;
  modelSelectDisabled?: boolean;
  modelSelectClassName?: string;

  leftSlot?: ReactNode;
  hintSlot?: ReactNode;

  containerClassName?: string;
  textareaClassName?: string;
}

export function AgentComposer({
  value,
  onChange,
  onSubmit,
  textareaRef,
  disabled = false,
  placeholder = "Refine your request or add new instructions...",
  rows = 1,
  primaryLabel,
  primaryVariant = "primary",
  canSubmit,
  showModelSelect = true,
  modelSelectDisabled,
  modelSelectClassName,
  leftSlot,
  hintSlot,
  containerClassName,
  textareaClassName,
}: AgentComposerProps) {
  const isSubmitAllowed = (canSubmit ?? value.trim().length > 0) && !disabled;

  return (
    <div
      className={cn(
        "rounded-xl bg-charcoal border border-graphite relative group focus-within:border-zinc-700 focus-within:bg-zinc-900/50 transition-colors flex flex-col shadow-lg",
        containerClassName
      )}
    >
      <textarea
        ref={textareaRef}
        className={cn(
          "w-full bg-transparent border-none focus:outline-none text-[14px] text-zinc-300 placeholder-zinc-600 resize-none font-normal leading-[1.5] min-h-[24px] px-3 pt-2.5 pb-0",
          textareaClassName
        )}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value, e.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            if (!value.trim() || disabled) {
              event.preventDefault();
              return;
            }

            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        rows={rows}
      />

      <div className="flex items-center justify-between p-1.5">
        <div className="flex items-center gap-1.5 pl-1 text-zinc-500">
          {leftSlot ?? (
            <button
              type="button"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Add context"
              disabled={disabled}
            >
              <Plus size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 pr-1">
          {showModelSelect ? (
            <AgentModelSelect
              className={modelSelectClassName ?? "hidden sm:block mr-2"}
              disabled={modelSelectDisabled ?? disabled}
            />
          ) : null}

          {hintSlot ?? null}

          <button
            type="button"
            onClick={onSubmit}
            disabled={!isSubmitAllowed}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 font-medium text-[12px]",
              primaryVariant === "danger"
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                : isSubmitAllowed
                  ? "bg-zinc-300 text-zinc-900 hover:bg-white"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            )}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

