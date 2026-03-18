import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorTabProps {
  name: string;
  isActive: boolean;
  isModified?: boolean;
  onClick: () => void;
  onClose: () => void;
}

export function EditorTab({
  name,
  isActive,
  isModified = false,
  onClick,
  onClose,
}: EditorTabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-full px-3 flex items-center gap-2 text-[12px] transition-all border-b-2 group/tab shrink-0",
        isActive
          ? "bg-zinc-800/50 text-zinc-100 border-b-zinc-400 font-medium"
          : "text-zinc-500 border-b-transparent hover:text-zinc-300 hover:bg-white/5 font-normal"
      )}
    >
      <div className="flex items-center justify-center w-2 flex-shrink-0">
        {isModified ? (
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
        )}
      </div>
      <span className="max-w-[160px] truncate leading-none">{name}</span>
      <div
        className="group/close flex items-center justify-center ml-0.5 w-4 h-4 rounded hover:bg-white/10 transition-colors cursor-pointer"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <X
          size={14}
          className={cn(
            "transition-colors",
            isActive
              ? "text-zinc-500 group-hover/close:text-zinc-200"
              : "text-transparent group-hover/tab:text-zinc-500 group-hover/close:!text-zinc-200"
          )}
        />
      </div>
    </button>
  );
}
