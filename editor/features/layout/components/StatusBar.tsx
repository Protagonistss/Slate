import { Share2 } from "lucide-react";
import { useStatusBarStore } from "@/stores/statusBarStore";
import { formatLanguageLabel } from "@/features/editor/views/utils/editorConstants";

function modelLabel(model: string | null): string {
  if (!model) return "";
  if (model === "claude-3.5-sonnet") return "Claude 3.5 Sonnet";
  if (model === "claude-3.5-haiku") return "Claude 3.5 Haiku";
  if (model === "gpt-4o-mini") return "GPT-4o Mini";
  return model;
}

export function StatusBar() {
  const { lineNumber, column, language, model } = useStatusBarStore();

  return (
    <div
      className="h-7 shrink-0 flex items-center justify-between px-4 text-[11px] font-medium text-zinc-400 tracking-wide
        rounded-t-lg border-t border-white/5 bg-zinc-900/60 backdrop-blur-sm
        shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]"
    >
      <div className="flex items-center gap-5 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
          <span className="text-zinc-400">{formatLanguageLabel(language ?? undefined)}</span>
        </div>
        <span className="text-zinc-500 tabular-nums">
          Ln {lineNumber}, Col {column}
        </span>
      </div>
      <div className="flex items-center gap-5 min-w-0">
        <span className="text-zinc-500">UTF-8</span>
        <span className="hidden md:inline text-zinc-400">{modelLabel(model)}</span>
        <span className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
          <Share2 size={11} strokeWidth={1.5} />
          Cloud Sync
        </span>
      </div>
    </div>
  );
}
