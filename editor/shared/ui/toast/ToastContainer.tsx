import { useUIStore, type Toast as ToastType } from "@/stores";
import { X, CheckCircle2, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function ToastIcon({ type }: { type: ToastType["type"] }) {
  const cls = "shrink-0";
  switch (type) {
    case "success":
      return <CheckCircle2 size={18} className={cn(cls, "text-emerald-400")} />;
    case "error":
      return <AlertCircle size={18} className={cn(cls, "text-red-400")} />;
    case "warning":
      return <AlertTriangle size={18} className={cn(cls, "text-amber-400")} />;
    default:
      return <Info size={18} className={cn(cls, "text-blue-400")} />;
  }
}

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div className="min-w-[280px] max-w-[400px] rounded-lg border border-[#3c3c3c] bg-[#252526] shadow-[0_4px_12px_rgba(0,0,0,0.3)] px-4 py-3 flex items-center gap-2 animate-in slide-in-from-right-6 fade-in duration-300">
      <ToastIcon type={toast.type} />
      <span className="flex-1 text-sm text-zinc-200 break-words">{toast.message}</span>
      <button
        type="button"
        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors"
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss toast"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);

  return (
    <div className="fixed bottom-5 right-5 z-[2000] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

