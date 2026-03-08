import React, { useState } from 'react';
import { useConversationStore, useUIStore, useWorkspaceStore, useEditorStore } from '../../stores';
import { FileTreeNode } from '../../stores/workspaceStore';
import { readTextFile } from '../../services/tauri/fs';
import { getFileExtension, getFileFullName, getLanguageFromExtension, normalizePath } from '../../utils/pathUtils';
import { openFolderDialog } from '../../services/tauri/dialog';
import './Sidebar.css';

// 文件图标组件
const FileIcon: React.FC<{ name: string; isDirectory: boolean; isExpanded?: boolean }> = ({
  name,
  isDirectory,
  isExpanded,
}) => {
  const ext = getFileExtension(name);

  if (isDirectory) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" className="file-icon folder">
        {isExpanded ? (
          <path
            fill="currentColor"
            d="M19 20H5c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h6l2 2h6c1.1 0 2 .9 2 2v1H4v9c0 .55.45 1 1 1h14c.55 0 1-.45 1-1v-1h1v2c0 1.1-.9 2-2 2z"
          />
        ) : (
          <path
            fill="currentColor"
            d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
          />
        )}
      </svg>
    );
  }

  // 根据文件扩展名显示不同颜色
  const iconClass = `file-icon ${getIconClass(ext)}`;

  return (
    <svg viewBox="0 0 24 24" width="16" height="16" className={iconClass}>
      <path
        fill="currentColor"
        d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"
      />
    </svg>
  );
};

// 根据扩展名获取图标样式类
function getIconClass(ext: string): string {
  const jsTypes = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'];
  const webTypes = ['html', 'htm', 'css', 'scss', 'less', 'sass', 'vue', 'svelte'];
  const dataTypes = ['json', 'yaml', 'yml', 'xml', 'toml', 'ini', 'env'];
  const pyTypes = ['py', 'pyw', 'pyx'];
  const sysTypes = ['c', 'h', 'cpp', 'hpp', 'cc', 'rs', 'go', 'zig'];
  const jvmTypes = ['java', 'kt', 'kts', 'scala', 'groovy'];
  const scriptTypes = ['sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'lua', 'rb', 'pl', 'pm'];
  const configTypes = ['dockerfile', 'makefile', 'cmake', 'gitignore', 'env'];

  if (jsTypes.includes(ext)) return 'lang-js';
  if (webTypes.includes(ext)) return 'lang-web';
  if (dataTypes.includes(ext)) return 'lang-data';
  if (pyTypes.includes(ext)) return 'lang-py';
  if (sysTypes.includes(ext)) return 'lang-code';
  if (jvmTypes.includes(ext)) return 'lang-jvm';
  if (scriptTypes.includes(ext)) return 'lang-script';
  if (configTypes.includes(ext)) return 'lang-config';
  if (ext === 'md' || ext === 'mdx') return 'lang-md';
  if (ext === 'sql') return 'lang-data';
  if (ext === 'php') return 'lang-web';
  return '';
}

// 文件树节点组件
interface TreeNodeProps {
  node: FileTreeNode;
  depth: number;
  onToggle: (path: string) => void;
  onFileClick: (path: string, name: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, onToggle, onFileClick }) => {
  const { expandedPaths } = useWorkspaceStore();
  const { activeFilePath } = useEditorStore();

  // 规范化路径进行匹配
  const normalizedPath = normalizePath(node.path);
  const isExpanded = expandedPaths.has(normalizedPath);
  const isActive = normalizePath(activeFilePath || '') === normalizedPath;

  const handleClick = () => {
    if (node.isDirectory) {
      onToggle(node.path);
    } else {
      onFileClick(node.path, node.name);
    }
  };

  return (
    <div className="tree-node">
      <div
        className={`tree-node-content ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {node.isDirectory && (
          <span className={`tree-chevron ${isExpanded ? 'expanded' : ''}`}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </span>
        )}
        {!node.isDirectory && <span className="tree-chevron-placeholder" />}
        <FileIcon name={node.name} isDirectory={node.isDirectory} isExpanded={isExpanded} />
        <span className="tree-node-name">{node.name}</span>
      </div>
      {node.isDirectory && isExpanded && node.children && node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { conversations, currentConversationId, setCurrentConversation, createConversation, deleteConversation } =
    useConversationStore();
  const { mode } = useUIStore();
  const { workspacePath, workspaceName, fileTree, isLoading, openWorkspace, closeWorkspace, toggleFolder } =
    useWorkspaceStore();
  const { openFile } = useEditorStore();

  const handleNewChat = () => {
    createConversation();
  };

  const handleDeleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个对话吗？')) {
      deleteConversation(id);
    }
  };

  const handleOpenFolder = async () => {
    const selectedPath = await openFolderDialog();
    if (selectedPath) {
      await openWorkspace(selectedPath);
    }
  };

  const handleFileClick = async (path: string, name: string) => {
    try {
      const content = await readTextFile(path);
      const ext = getFileExtension(path);
      const language = getLanguageFromExtension(ext);
      openFile(path, name, content, language);
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3>{mode === 'agent' ? '对话历史' : workspaceName || '文件浏览器'}</h3>
        {mode === 'agent' ? (
          <button className="sidebar-action" onClick={handleNewChat} title="新对话">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </button>
        ) : workspacePath ? (
          <button className="sidebar-action" onClick={closeWorkspace} title="关闭工作区">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="sidebar-content">
        {mode === 'agent' ? (
          <div className="conversation-list">
            {conversations.length === 0 ? (
              <div className="empty-state">
                <p>暂无对话</p>
                <p className="hint">点击上方按钮开始新对话</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`conversation-item ${
                    currentConversationId === conversation.id ? 'active' : ''
                  }`}
                  onClick={() => setCurrentConversation(conversation.id)}
                >
                  <div className="conversation-info">
                    <span className="conversation-title">{conversation.title}</span>
                    <span className="conversation-time">
                      {new Date(conversation.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    className="conversation-delete"
                    onClick={(e) => handleDeleteChat(e, conversation.id)}
                    title="删除"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        fill="currentColor"
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="file-tree">
            {isLoading ? (
              <div className="empty-state">
                <p>加载中...</p>
              </div>
            ) : workspacePath && fileTree.length > 0 ? (
              fileTree.map((node) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  onToggle={toggleFolder}
                  onFileClick={handleFileClick}
                />
              ))
            ) : workspacePath ? (
              <div className="empty-state">
                <p>空文件夹</p>
              </div>
            ) : (
              <div className="empty-state">
                <p>未打开文件夹</p>
                <button className="open-folder-btn" onClick={handleOpenFolder}>
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  </svg>
                  打开文件夹
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
