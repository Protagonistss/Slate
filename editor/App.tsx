import { useEffect } from 'react';
import { AppLayout } from './components/layout';
import { ChatPanel } from './components/agent';
import { MonacoEditor } from './components/editor';
import { SettingsPanel } from './components/settings';
import { ToastContainer } from './components/common';
import { useUIStore, useConfigStore, useEditorStore } from './stores';
import './App.css';

function App() {
  const { mode } = useUIStore();
  const { theme } = useConfigStore();
  const { openFiles, activeFilePath, updateFileContent } = useEditorStore();

  // 应用主题
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 获取当前活动文件
  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  return (
    <div className="app">
      <AppLayout
        agentPanel={mode === 'agent' ? <ChatPanel /> : undefined}
      >
        {mode === 'editor' ? (
          <div className="editor-mode">
            {activeFile ? (
              <MonacoEditor
                key={activeFile.path}
                value={activeFile.content}
                language={activeFile.language}
                onChange={(value) => {
                  if (activeFilePath) {
                    updateFileContent(activeFilePath, value);
                  }
                }}
                height="100%"
              />
            ) : (
              <div className="editor-placeholder">
                <div className="placeholder-content">
                  <svg viewBox="0 0 24 24" width="64" height="64">
                    <path
                      fill="currentColor"
                      d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"
                    />
                  </svg>
                  <h2>编辑器模式</h2>
                  <p>选择文件开始编辑，或切换到 Agent 模式与 AI 对话</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="agent-mode">
            <div className="agent-workspace">
              {activeFile ? (
                <MonacoEditor
                  key={activeFile.path}
                  value={activeFile.content}
                  language={activeFile.language}
                  onChange={(value) => {
                    if (activeFilePath) {
                      updateFileContent(activeFilePath, value);
                    }
                  }}
                  height="100%"
                  readOnly
                />
              ) : (
                <div className="workspace-placeholder">
                  <p>AI 可以在这里展示代码修改</p>
                </div>
              )}
            </div>
          </div>
        )}
      </AppLayout>

      <SettingsPanel />
      <ToastContainer />
    </div>
  );
}

export default App;
