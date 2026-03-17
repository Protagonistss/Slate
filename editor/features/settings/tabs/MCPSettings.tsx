// MCPSettings - MCP servers settings tab
import { motion, AnimatePresence } from "motion/react";
import type {
  McpConfigScope,
  McpServerStatus,
  McpToolDescriptor,
} from "@/services/mcp";
import { MCPUnsupported } from "./mcp/MCPUnsupported";
import { MCPServerList } from "./mcp/MCPServerList";
import { MCPAddButton } from "./mcp/MCPAddButton";
import { MCPServerForm } from "./mcp/MCPServerForm";
import { MCPServerSearch } from "./mcp/MCPServerSearch";

export interface McpServerDraft {
  scope: McpConfigScope;
  id: string;
  name: string;
  enabled: boolean;
  command: string;
  argsText: string;
  cwd: string;
  envText: string;
}

export interface MCPSettingsProps {
  mcpSupported: boolean;
  currentProject: { name: string; path: string } | null;
  servers: McpServerStatus[];
  tools: McpToolDescriptor[];
  isLoading: boolean;
  scopeOptions: readonly { value: McpConfigScope; label: string }[];
  formOpen: boolean;
  setFormOpen: (open: boolean) => void;
  draft: McpServerDraft;
  setDraft: React.Dispatch<React.SetStateAction<McpServerDraft>>;
  configText: string;
  setConfigText: React.Dispatch<React.SetStateAction<string>>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  parsedSuccessfully: boolean;
  openNewForm: () => void;
  openEditForm: (server: McpServerStatus) => void;
  handleSaveServer: () => Promise<void>;
  handleToggleServer: (server: McpServerStatus) => Promise<void>;
  handleRetryServer: (server: McpServerStatus) => Promise<void>;
  handleDeleteServer: (server: McpServerStatus) => Promise<void>;
  handleDeleteDraft: () => Promise<void>;
  parseConfigText: (text: string) => void;
  scopePathHint: string;
  scopePathLabel: string;
  isEditing: boolean;
}

export function MCPSettings({
  mcpSupported,
  servers,
  isLoading,
  handleToggleServer,
  openEditForm,
  handleRetryServer,
  handleDeleteServer,
  openNewForm,
  scopeOptions,
  formOpen,
  setFormOpen,
  draft,
  configText,
  searchQuery,
  setSearchQuery,
  parsedSuccessfully,
  setDraft,
  setConfigText,
  handleSaveServer,
  handleDeleteDraft,
  parseConfigText,
  scopePathHint,
  scopePathLabel,
  isEditing,
}: MCPSettingsProps) {
  // 根据搜索查询过滤服务器
  const filteredServers = servers.filter((server) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      server.name.toLowerCase().includes(query) ||
      server.id.toLowerCase().includes(query)
    );
  });

  return (
    <motion.div
      key="mcp"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-10 pb-24"
    >
      {/* Header with Add Server button */}
      <div className="flex items-start justify-between pb-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h2 className="text-[20px] font-medium tracking-tight text-zinc-100">
              MCP Servers
            </h2>
            <div className="px-2 py-0.5 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-[10px] font-medium text-zinc-400">
              BETA
            </div>
          </div>
          <p className="text-[13px] text-zinc-500 max-w-[400px] leading-relaxed">
            Expand your Agent's capabilities by connecting to external tools, databases, and local file systems.
          </p>
        </div>
        <MCPAddButton
          onClick={formOpen ? () => setFormOpen(false) : openNewForm}
          isAdding={formOpen}
        />
      </div>

      {!mcpSupported ? (
        <MCPUnsupported />
      ) : (
        <>
          {/* 服务器表单 - 添加/编辑模式 */}
          <MCPServerForm
            formOpen={formOpen}
            draft={draft}
            configText={configText}
            scopeOptions={scopeOptions}
            currentProject={null}
            parsedSuccessfully={parsedSuccessfully}
            onConfigTextChange={(value) => {
              setConfigText(value);
              if (value.trim()) {
                parseConfigText(value);
              } else {
                parseConfigText("");
              }
            }}
            onDraftChange={setDraft}
            onSave={() => void handleSaveServer()}
            onDelete={() => void handleDeleteDraft()}
            onCancel={() => setFormOpen(false)}
            scopePathHint={scopePathHint}
            scopePathLabel={scopePathLabel}
            isEditing={isEditing}
          />

          {/* 搜索和服务器列表 */}
          <div className="flex flex-col gap-6">
            <MCPServerSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search connected servers..."
            />

            <MCPServerList
              servers={filteredServers}
              isLoading={isLoading}
              onToggle={handleToggleServer}
              onEdit={openEditForm}
              onRetry={handleRetryServer}
              onDelete={handleDeleteServer}
            />
          </div>
        </>
      )}
    </motion.div>
  );
}
