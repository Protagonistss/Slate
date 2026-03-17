// MCPSettings - MCP servers settings tab
import { motion } from "motion/react";
import { Plus, Search, Terminal } from "lucide-react";
import { useState } from "react";
import type {
  McpConfigScope,
  McpServerConfig,
  McpServerStatus,
  McpToolDescriptor,
} from "@/services/mcp";

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
  openNewForm: () => void;
  openEditForm: (server: McpServerStatus) => void;
  handleSaveServer: () => Promise<void>;
  handleToggleServer: (server: McpServerStatus) => Promise<void>;
  handleRetryServer: (server: McpServerStatus) => Promise<void>;
  handleDeleteServer: (server: McpServerStatus) => Promise<void>;
}

export function MCPSettings({
  mcpSupported,
  currentProject,
  servers,
  tools,
  isLoading,
  scopeOptions,
  formOpen,
  setFormOpen,
  draft,
  setDraft,
  configText,
  setConfigText,
  openNewForm,
  openEditForm,
  handleSaveServer,
  handleToggleServer,
  handleRetryServer,
  handleDeleteServer,
}: MCPSettingsProps) {
  return (
    <motion.div
      key="mcp"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="max-w-[700px] space-y-10"
    >
      <div>
        <h2 className="mb-1 text-[20px] font-medium text-zinc-100">MCP Servers</h2>
        <p className="text-[13px] text-zinc-500">
          Manage Model Context Protocol servers for extending agent capabilities.
        </p>
      </div>

      {!mcpSupported ? (
        <MCPUnsupported />
      ) : (
        <>
          <MCPProjectInfo currentProject={currentProject} />

          <MCPToolsList tools={tools} />

          <MCPServersList
            servers={servers}
            isLoading={isLoading}
            onToggle={handleToggleServer}
            onEdit={openEditForm}
            onRetry={handleRetryServer}
            onDelete={handleDeleteServer}
          />

          <MCPAddButton onClick={openNewForm} />
        </>
      )}
    </motion.div>
  );
}

function MCPUnsupported() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
      <Terminal size={42} className="mb-4 opacity-25 text-zinc-500" />
      <h2 className="text-[16px] font-medium text-zinc-300">MCP Not Supported</h2>
      <p className="mt-2 text-[13px] text-zinc-500">
        MCP is only available in the desktop app.
      </p>
    </div>
  );
}

function MCPProjectInfo({ currentProject }: { currentProject: { name: string; path: string } | null }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">
        Project Scope
      </h3>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        {currentProject ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-zinc-200">{currentProject.name}</div>
              <div className="text-[11px] text-zinc-600 font-mono">{currentProject.path}</div>
            </div>
          </div>
        ) : (
          <div className="text-[12px] text-zinc-600">No project open</div>
        )}
      </div>
    </section>
  );
}

function MCPToolsList({ tools }: { tools: McpToolDescriptor[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">
          Available Tools ({tools.length})
        </h3>
      </div>
      {tools.length === 0 ? (
        <div className="text-[12px] text-zinc-600">No tools available. Connect an MCP server to get started.</div>
      ) : (
        <div className="space-y-2">
          {tools.map((tool) => (
            <div
              key={`${tool.serverId}:${tool.name}`}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-zinc-200">{tool.name}</span>
                    <span className="text-[10px] text-zinc-600">{tool.serverName}</span>
                  </div>
                  {tool.description && (
                    <p className="mt-1 text-[11px] text-zinc-500 line-clamp-2">{tool.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

interface MCPServersListProps {
  servers: McpServerStatus[];
  isLoading: boolean;
  onToggle: (server: McpServerStatus) => Promise<void>;
  onEdit: (server: McpServerStatus) => void;
  onRetry: (server: McpServerStatus) => Promise<void>;
  onDelete: (server: McpServerStatus) => Promise<void>;
}

function MCPServersList({ servers, isLoading, onToggle, onEdit, onRetry, onDelete }: MCPServersListProps) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">
        Configured Servers ({servers.length})
      </h3>
      {servers.length === 0 ? (
        <div className="text-[12px] text-zinc-600">No servers configured yet.</div>
      ) : (
        <div className="space-y-2">
          {servers.map((server) => (
            <MCPServerItem
              key={server.id}
              server={server}
              onToggle={onToggle}
              onEdit={onEdit}
              onRetry={onRetry}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface MCPServerItemProps {
  server: McpServerStatus;
  onToggle: (server: McpServerStatus) => Promise<void>;
  onEdit: (server: McpServerStatus) => void;
  onRetry: (server: McpServerStatus) => Promise<void>;
  onDelete: (server: McpServerStatus) => Promise<void>;
}

function MCPServerItem({ server, onToggle, onEdit, onRetry, onDelete }: MCPServerItemProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${statusDot(server.status)}`} />
          <div>
            <div className="text-[13px] font-medium text-zinc-200">{server.name}</div>
            <div className="text-[10px] text-zinc-600">{describeMcpStatus(server.status)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void onToggle(server)}
            className="text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            {server.enabled ? "Disable" : "Enable"}
          </button>
          <button
            onClick={() => onEdit(server)}
            className="text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            Edit
          </button>
          {server.status === "error" && (
            <button
              onClick={() => void onRetry(server)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              Retry
            </button>
          )}
          <button
            onClick={() => void onDelete(server)}
            className="text-[11px] text-zinc-500 hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function MCPAddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 w-full rounded-lg border border-dashed border-zinc-700 py-3 text-[12px] text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
    >
      <Plus size={14} />
      Add MCP Server
    </button>
  );
}

function statusDot(status: McpServerStatus["status"]): string {
  switch (status) {
    case "connected":
      return "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.45)]";
    case "connecting":
      return "bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.35)]";
    case "approvalRequired":
      return "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]";
    case "error":
      return "bg-red-400";
    default:
      return "bg-zinc-600";
  }
}

function describeMcpStatus(status: McpServerStatus["status"]): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "approvalRequired":
      return "Awaiting Approval";
    case "connecting":
      return "Connecting";
    case "disabled":
      return "Disabled";
    case "unsupported":
      return "Unsupported";
    case "error":
      return "Error";
    default:
      return "Offline";
  }
}
