import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { cn } from "@/lib/utils";
import { useProjectStore, useEditorStore } from "@/stores";
import { ProjectFile } from "@/services/project";
import {
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Folder,
  FileCode,
  FileJson,
  FileText,
  File,
  Image
} from "lucide-react";

interface ProjectFileTreeProps {
  className?: string;
}

// 文件图标映射
function getFileIcon(filename: string): React.ComponentType<{ size?: number; className?: string }> {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

  const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }> | null> = {
    '.ts': FileCode,
    '.tsx': FileCode,
    '.js': FileCode,
    '.jsx': FileCode,
    '.css': FileCode,
    '.scss': FileCode,
    '.sass': FileCode,
    '.html': FileCode,
    '.json': FileJson,
    '.md': FileText,
    '.txt': FileText,
    '.png': Image,
    '.jpg': Image,
    '.jpeg': Image,
    '.svg': Image,
    '.gif': Image,
    '.yaml': FileText,
    '.yml': FileText,
    '.toml': FileText,
  };

  return iconMap[ext] || File;
}

export function ProjectFileTree({ className }: ProjectFileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());

  const { currentProject, projectFiles } = useProjectStore();
  const { openFiles, activeFilePath } = useEditorStore();

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

  const handleFileClick = async (file: ProjectFile) => {
    if (file.type === 'folder') {
      toggleFolder(file.path);
    } else {
      // 如果文件已经在打开的标签页中，直接激活
      if (openFiles.some(f => f.path === file.path)) {
        const { setActiveFile } = useEditorStore.getState();
        setActiveFile(file.path);
        return;
      }

      // 懒加载：读取文件内容
      setLoadingFiles(prev => new Set(prev).add(file.path));
      try {
        const fullFilePath = await join(currentProject!.path, file.path.replace(/\//g, '\\'));
        const content = await invoke<string>('read_workspace_text_file', { path: fullFilePath });

        const { openFile } = useEditorStore.getState();
        openFile(file.path, file.name, content, file.language);
      } catch (error) {
        console.error('Failed to load file:', file.path, error);
      } finally {
        setLoadingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(file.path);
          return newSet;
        });
      }
    }
  };

  const isFileActive = (file: ProjectFile) => {
    return activeFilePath === file.path;
  };

  if (!currentProject) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <Folder size={32} className="text-zinc-700 mb-3" />
        <p className="text-sm text-zinc-600">No project open</p>
        <p className="text-xs text-zinc-700 mt-1">Select a folder to get started</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="px-2 pb-2">
        <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-2">
          {currentProject.name}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        <div className="space-y-0.5">
          {projectFiles.map(file => (
            <FileTreeItem
              key={file.path}
              file={file}
              onFileClick={handleFileClick}
              expandedFolders={expandedFolders}
              isFileActive={isFileActive}
              isLoading={(f) => f.type === 'file' && loadingFiles.has(f.path)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface FileTreeItemProps {
  file: ProjectFile;
  level?: number;
  onFileClick?: (file: ProjectFile) => void;
  expandedFolders?: Set<string>;
  isFileActive?: (file: ProjectFile) => boolean;
  isLoading?: (file: ProjectFile) => boolean;
}

function FileTreeItem({
  file,
  level = 0,
  onFileClick,
  expandedFolders = new Set(),
  isFileActive = () => false,
  isLoading = () => false
}: FileTreeItemProps) {
  const isFolder = file.type === 'folder';
  const isExpanded = expandedFolders.has(file.path);
  const isActive = !isFolder && isFileActive(file);
  const loading = isLoading(file);
  const FileIcon = getFileIcon(file.name);

  return (
    <div>
      <div
        onClick={() => !loading && onFileClick?.(file)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all",
          isActive
            ? "bg-zinc-800/80 text-zinc-100"
            : loading
            ? "text-zinc-600 cursor-wait"
            : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
        )}
        style={{ paddingLeft: `${8 + level * 12}px` }}
      >
        {isFolder ? (
          isExpanded ? (
            <ChevronDown size={14} className="text-zinc-500" />
          ) : (
            <ChevronRight size={14} className="text-zinc-500" />
          )
        ) : loading ? (
          <div className="w-[14px] flex items-center justify-center">
            <div className="w-2 h-2 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="w-[14px]" />
        )}
        {isFolder ? (
          isExpanded ? (
            <FolderOpen size={14} className="text-fog-blue" />
          ) : (
            <Folder size={14} className="text-fog-blue" />
          )
        ) : (
          <FileIcon size={14} className="text-zinc-500" />
        )}
        <span className="truncate">{loading ? '加载中...' : file.name}</span>
      </div>
      {isFolder && isExpanded && file.children && (
        <div className="space-y-0.5">
          {file.children.map(child => (
            <FileTreeItem
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
