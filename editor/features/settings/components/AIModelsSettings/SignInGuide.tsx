// SignInGuide - 登录引导组件
import { LogIn } from "lucide-react";
import { useNavigate } from "react-router";
import type { AuthUser } from "@/services/backend/auth";

export interface SignInGuideProps {
  user: AuthUser | null;
}

export function SignInGuide({ user }: SignInGuideProps) {
  const navigate = useNavigate();

  if (user) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-black/20 p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-zinc-200">
            <LogIn size={16} />
            <span className="text-[14px] font-medium">Sign in to use backend models</span>
          </div>
          <p className="max-w-[520px] text-[13px] leading-relaxed text-zinc-500">
            AI Models and Agent execution now use the backend gateway. Sign in first to browse configured
            providers and send requests.
          </p>
        </div>

        <button
          onClick={() => navigate("/settings#account")}
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-zinc-100 px-4 py-2 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-white"
        >
          <LogIn size={14} />
          Go to Account
        </button>
      </div>
    </div>
  );
}
