import { SimpleLogo } from "@/shared/ui";

export function AIStatusIndicator() {
  return (
    <div
      className="fixed left-4 z-40 pointer-events-none"
      style={{ bottom: "calc(1.75rem + 10px)" }}
      aria-hidden
    >
      <div className="slate-glass px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10 shadow-lg backdrop-blur-md bg-zinc-900/70">
        <div className="w-4 h-4 ai-pulse flex items-center justify-center">
          <SimpleLogo size={16} />
        </div>
        <span className="text-[10px] font-medium text-zinc-400 tracking-wide">
          Slate AI Ready
        </span>
      </div>
    </div>
  );
}

