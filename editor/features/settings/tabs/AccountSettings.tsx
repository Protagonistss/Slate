// AccountSettings - Account settings tab
import { motion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthUser, OAuthProvider } from "@/services/backend/auth";

const ACCOUNT_PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: "github", label: "GitHub" },
  { id: "gitee", label: "Gitee" },
  { id: "google", label: "Google" },
];

export interface AccountSettingsProps {
  user: AuthUser | null;
  currentOAuthProvider: OAuthProvider | null;
  pendingAction: "signOut" | null;
  pendingOAuthProvider: OAuthProvider | null;
  backendBaseUrl: string;
  onConnect: (provider: OAuthProvider) => Promise<void>;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => void;
}

export function AccountSettings({
  user,
  currentOAuthProvider,
  pendingAction,
  pendingOAuthProvider,
  backendBaseUrl,
  onConnect,
  onSignOut,
  onDeleteAccount,
}: AccountSettingsProps) {
  const isSignedIn = Boolean(user);
  const avatarText = (user?.username.trim().charAt(0) || "S").toUpperCase();
  const isSigningOut = pendingAction === "signOut";
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [user?.avatarUrl]);

  return (
    <motion.div
      key="account"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="max-w-[600px] space-y-12"
    >
      <div>
        <h2 className="mb-1 text-[20px] font-medium text-zinc-100">Account</h2>
        <p className="text-[13px] text-zinc-500">Manage your profile and connected services.</p>
      </div>

      <section className="space-y-4">
        <h3 className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">Profile</h3>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-800 text-[13px] font-semibold text-zinc-200">
              {user?.avatarUrl && !avatarFailed ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username || "User avatar"}
                  className="h-full w-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                avatarText
              )}
            </div>
            <div>
              <div className="text-[13px] font-medium text-zinc-300">
                {user?.username || "Not signed in"}
              </div>
              <div className="text-[12px] text-zinc-600">
                {user?.email || "Use GitHub, Gitee or Google to sign in via the backend."}
              </div>
            </div>
          </div>
          {isSignedIn ? (
            <button
              onClick={() => void onSignOut()}
              disabled={isSigningOut || pendingOAuthProvider !== null}
              className="text-[12px] text-zinc-500 transition-colors hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </button>
          ) : (
            <span className="text-[12px] text-zinc-600">Backend OAuth</span>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">
            Connected Accounts
          </h3>
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-600">
            <ExternalLink size={12} />
            {backendBaseUrl}
          </span>
        </div>

        <div className="space-y-4">
          {(isSignedIn && currentOAuthProvider
            ? ACCOUNT_PROVIDERS.filter((provider) => provider.id === currentOAuthProvider)
            : ACCOUNT_PROVIDERS
          ).map((provider) => {
            const isConnected = currentOAuthProvider === provider.id && isSignedIn;
            const handle = isConnected ? `(@${user?.username})` : null;
            const isPendingProvider = pendingOAuthProvider === provider.id;
            const isAnyAccountActionPending = isSigningOut || pendingOAuthProvider !== null;

            return (
              <div key={provider.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-zinc-400">{provider.label}</span>
                  {handle && <span className="font-mono text-[11px] text-zinc-600">{handle}</span>}
                </div>

                {isSignedIn ? (
                  <span className="text-[12px] text-zinc-500">Signed In</span>
                ) : (
                  <button
                    onClick={() => void onConnect(provider.id)}
                    disabled={isAnyAccountActionPending}
                    className="text-[12px] text-zinc-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPendingProvider ? "Signing in..." : "Sign In"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 pt-4">
        <h3 className="text-[11px] font-medium uppercase tracking-widest text-red-500/50">
          Danger Zone
        </h3>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px] text-zinc-500">Delete Account</span>
          <button
            onClick={onDeleteAccount}
            className="text-[12px] text-red-400/70 transition-colors hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </section>
    </motion.div>
  );
}
