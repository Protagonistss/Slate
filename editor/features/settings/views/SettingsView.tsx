// SettingsView - 设置页面主组件
import { AnimatePresence, motion } from "motion/react";
import {
  Cpu,
  Keyboard,
  Palette,
  Plug,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { AIModelsSettings } from "../components/AIModelsSettings";
import { AccountSettings } from "../tabs/AccountSettings";
import { MCPSettings } from "../tabs/MCPSettings";
import { GeneralSettings } from "../tabs/GeneralSettings";
import { AppearanceSettings } from "../tabs/AppearanceSettings";
import { ShortcutsSettings } from "../tabs/ShortcutsSettings";
import { useSettingsAuth, useSettingsMcp } from "../hooks";

const NAV_ITEMS = [
  { id: "general", label: "General", icon: Cpu },
  { id: "models", label: "AI Models", icon: Cpu },
  { id: "mcp", label: "MCP Servers", icon: Plug },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "account", label: "Account", icon: Cpu },
] as const;

type SettingsTab = (typeof NAV_ITEMS)[number]["id"];

export function SettingsView() {
  const navigate = useNavigate();
  const location = useLocation();

  // Tab state
  const searchParams = new URLSearchParams(location.search);
  const activeTab = (searchParams.get("tab") as SettingsTab) || "general";

  // Auth state and handlers
  const auth = useSettingsAuth();

  // MCP state and handlers
  const mcp = useSettingsMcp();

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return <GeneralSettings />;
      case "models":
        return <AIModelsSettings />;
      case "mcp":
        return (
          <MCPSettings
            mcpSupported={mcp.mcpSupported}
            currentProject={mcp.currentProject}
            servers={mcp.servers}
            tools={mcp.tools}
            isLoading={mcp.isLoading}
            scopeOptions={mcp.scopeOptions}
            formOpen={mcp.formOpen}
            setFormOpen={mcp.setFormOpen}
            draft={mcp.draft}
            setDraft={mcp.setDraft}
            configText={mcp.configText}
            setConfigText={mcp.setConfigText}
            searchQuery={mcp.searchQuery}
            setSearchQuery={mcp.setSearchQuery}
            parsedSuccessfully={mcp.parsedSuccessfully}
            openNewForm={mcp.openNewForm}
            openEditForm={mcp.openEditForm}
            handleSaveServer={mcp.handleSaveServer}
            handleToggleServer={mcp.handleToggleServer}
            handleRetryServer={mcp.handleRetryServer}
            handleDeleteServer={mcp.handleDeleteServer}
            handleDeleteDraft={mcp.handleDeleteDraft}
            parseConfigText={mcp.parseConfigText}
            scopePathHint={mcp.scopePathHint}
            scopePathLabel={mcp.scopePathLabel}
            isEditing={mcp.isEditing}
          />
        );
      case "appearance":
        return <AppearanceSettings />;
      case "shortcuts":
        return <ShortcutsSettings />;
      case "account":
        return (
          <AccountSettings
            user={auth.user}
            currentOAuthProvider={auth.currentOAuthProvider}
            pendingAction={auth.pendingAction}
            pendingOAuthProvider={auth.pendingOAuthProvider}
            backendBaseUrl={auth.backendBaseUrl}
            onConnect={auth.handleOAuthSignIn}
            onSignOut={auth.handleSignOut}
            onDeleteAccount={auth.handleDeleteAccount}
          />
        );
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div className="flex items-center gap-2">
          <h1 className="text-[17px] font-medium text-zinc-100">Settings</h1>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <nav className="w-48 border-r border-white/5 p-3">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => navigate(`/settings?tab=${item.id}`)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] transition-colors",
                      isActive
                        ? "bg-white/5 text-zinc-100"
                        : "text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300"
                    )}
                  >
                    <item.icon size={14} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
