import {
  Files,
  Search,
  History,
  Plus,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  Folder,
  File
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router";
import { useProjectStore, useEditorStore } from "@/stores";
import { ProjectFile } from "@/services/project";
import { getFileIcon } from "@/utils";

interface FileItemProps {
  file: ProjectFile;
  level?: number;
  onFileClick?: (file: ProjectFile) => void;
}

interface NavItem {
  id: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  action?: () => void;
}

export function LeftSidebar() {
  const [activeTab, setActiveTab] = useState("files");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const { currentProject, projectFiles } = useProjectStore();
  const { openFile, openFiles, activeFilePath } = useEditorStore();

  const navItems: NavItem[] = [
    { id: "files", icon: Files, label: "Files" },
    { id: "search", icon: Search, label: "Search" },
    { id: "history", icon: History, label: "History", action: () => navigate("/history") },
    { id: "layouts", icon: LayoutGrid, label: "Layouts" },
  ];

  const handleTabClick = (item: NavItem) => {
    setActiveTab(item.id);
    if (item.action) item.action();
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleFileClick = (file: ProjectFile) => {
    if (file.type === 'folder') {
      toggleFolder(file.path);
    } else {
      openFile(file.path, file.name, file.content, file.language);
    }
  };

  const isFileActive = (file: ProjectFile) => {
    return activeFilePath === file.path;
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a]">
      {/* Top Section: Tab Bar */}
      <div className="flex border-b border-[#262626]">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabClick(item)}
            className={cn(
              "p-4 flex flex-1 justify-center transition-all relative group overflow-hidden",
              activeTab === item.id
                ? "text-blue-500 bg-[#121212]"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-[#121212]"
            )}
            title={item.label}
          >
            <item.icon size={20} />
            {activeTab === item.id && (
              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-blue-500" />
            )}
          </button>
        ))}
      </div>

      {/* Explorer Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 scrollbar-thin">
        {activeTab === "files" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 uppercase tracking-widest">
              <span>{currentProject ? currentProject.name : 'EXPLORER'}</span>
              {currentProject && (
                <button className="p-1 hover:text-zinc-200 hover:bg-[#262626] rounded-md transition-colors">
                  <Plus size={14} />
                </button>
              )}
            </div>

            {!currentProject ? (
              <div className="text-center py-8">
                <Folder size={32} className="mx-auto text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-600">No project open</p>
                <p className="text-xs text-zinc-700 mt-1">Select a folder to get started</p>
              </div>
            ) : (
              <div className="space-y-1">
                {projectFiles.map(file => (
                  <FileItem
                    key={file.path}
                    file={file}
                    onFileClick={handleFileClick}
                    expandedFolders={expandedFolders}
                    isFileActive={isFileActive}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
              <span>SESSION HISTORY</span>
            </div>
            <div className="space-y-3">
              {[
                { time: "2m ago", label: "Fixed navigation bug" },
                { time: "15m ago", label: "Initial setup" },
                { time: "2h ago", label: "Added editor layout" },
              ].map((h, i) => (
                <div key={i} className="p-3 bg-[#121212] rounded-xl border border-[#262626] hover:border-blue-500/50 cursor-pointer transition-all">
                  <div className="text-xs text-zinc-500 mb-1">{h.time}</div>
                  <div className="text-sm font-medium text-zinc-300">{h.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer: User context or project info */}
      <div className="p-4 border-t border-[#262626] text-xs text-zinc-600 flex items-center justify-between">
        <span>V0.1.0-alpha</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20" />
          Cloud Connected
        </span>
      </div>
    </div>
  );
}

interface FileItemProps {
  file: ProjectFile;
  level?: number;
  onFileClick?: (file: ProjectFile) => void;
  expandedFolders?: Set<string>;
  isFileActive?: (file: ProjectFile) => boolean;
}

function FileItem({
  file,
  level = 0,
  onFileClick,
  expandedFolders = new Set(),
  isFileActive = () => false
}: FileItemProps) {
  const isFolder = file.type === 'folder';
  const isExpanded = expandedFolders.has(file.path);
  const isActive = !isFolder && isFileActive(file);
  const FileIcon = getFileIcon(file.name);

  return (
    <div>
      <div
        onClick={() => onFileClick?.(file)}
        className={cn(
          "flex items-center gap-2 py-1.5 px-3 rounded-lg text-sm transition-colors cursor-pointer group",
          isActive
            ? "bg-blue-600/10 text-blue-400 border border-blue-600/20"
            : "text-zinc-400 hover:bg-[#262626] hover:text-zinc-200 border border-transparent"
        )}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        {isFolder ? (
          isExpanded ? <ChevronDown size={14} className="text-zinc-600" /> : <ChevronRight size={14} className="text-zinc-600" />
        ) : (
          <div className="w-3.5 h-3.5" />
        )}
        {isFolder ? (
          isExpanded ? <FolderOpen size={14} className="text-blue-400" /> : <Folder size={14} className="text-blue-400" />
        ) : (
          <FileIcon size={14} className="text-zinc-500" />
        )}
        <span className="flex-1 truncate">{file.name}</span>
      </div>
      {isFolder && isExpanded && file.children && (
        <div className="space-y-1">
          {file.children.map(child => (
            <FileItem
              key={child.path}
              file={child}
              level={level + 1}
              onFileClick={onFileClick}
              expandedFolders={expandedFolders}
              isFileActive={isFileActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
