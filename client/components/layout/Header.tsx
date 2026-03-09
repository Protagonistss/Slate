import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useUIStore, useConfigStore, useWorkspaceStore } from '../../stores';
import { openFolderDialog } from '../../services/tauri/dialog';
import './Header.css';

export const Header: React.FC = () => {
  const { mode, setMode, openSettings } = useUIStore();
  const { currentProvider } = useConfigStore();
  const { openWorkspace, workspacePath } = useWorkspaceStore();

  const handleOpenFolder = async () => {
    const selectedPath = await openFolderDialog();
    if (selectedPath) {
      await openWorkspace(selectedPath);
    }
  };

  const handleMinimize = () => {
    getCurrentWindow().minimize();
  };

  const handleMaximize = () => {
    getCurrentWindow().toggleMaximize();
  };

  const handleClose = () => {
    getCurrentWindow().close();
  };

  return (
    <header className="header" onMouseDown={(e) => {
      // 只在非按钮区域拖动
      if ((e.target as HTMLElement).closest('button')) return;
      getCurrentWindow().startDragging();
    }}>
      <div className="header-left">
        <div className="header-logo">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
            />
          </svg>
          <span className="header-title">Slate Editor</span>
        </div>
        {mode === 'editor' && (
          <button className="header-action-btn" onClick={handleOpenFolder} title="打开文件夹">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
              />
            </svg>
            <span>{workspacePath ? '切换文件夹' : '打开文件夹'}</span>
          </button>
        )}
      </div>

      <div className="header-center">
        <div className="mode-switch">
          <button
            className={`mode-btn ${mode === 'editor' ? 'active' : ''}`}
            onClick={() => setMode('editor')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"
              />
            </svg>
            编辑器
          </button>
          <button
            className={`mode-btn ${mode === 'agent' ? 'active' : ''}`}
            onClick={() => setMode('agent')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
              />
            </svg>
            Agent
          </button>
        </div>
      </div>

      <div className="header-right">
        <div className="provider-badge">
          <span className={`provider-dot provider-${currentProvider}`}></span>
          {currentProvider.toUpperCase()}
        </div>
        <button className="header-btn" onClick={() => openSettings()} title="设置">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="currentColor"
              d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
            />
          </svg>
        </button>
        <div className="window-controls">
          <button className="window-btn minimize" onClick={handleMinimize} title="最小化">
            <svg viewBox="0 0 24 24" width="12" height="12">
              <path fill="currentColor" d="M19 13H5v-2h14v2z" />
            </svg>
          </button>
          <button className="window-btn maximize" onClick={handleMaximize} title="最大化">
            <svg viewBox="0 0 24 24" width="12" height="12">
              <path fill="currentColor" d="M4 4h16v16H4V4zm2 2v12h12V6H6z" />
            </svg>
          </button>
          <button className="window-btn close" onClick={handleClose} title="关闭">
            <svg viewBox="0 0 24 24" width="12" height="12">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};
