import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MonacoEditor } from "../editor/MonacoEditor";
import { useEditorStore } from "../../stores/editorStore";
import { SimpleLogo } from "../shared";

export function EditorView() {
  const { openFiles, activeFilePath, closeFile, setActiveFile } = useEditorStore();
  const [prompt, setPrompt] = useState("");

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  // 默认打开一个示例文件
  useEffect(() => {
    if (openFiles.length === 0) {
      // 这里可以添加默认文件
    }
  }, [openFiles.length]);

  return (
    <div className="flex-1 h-full bg-charcoal flex flex-col relative overflow-hidden">
      {/* Editor Tabs */}
      {openFiles.length > 0 && (
        <div className="h-10 border-b border-graphite bg-[#1a1a1a] flex items-center px-2 gap-1 overflow-x-auto select-none">
          {openFiles.map((file) => (
            <Tab
              key={file.path}
              name={file.name}
              isActive={activeFilePath === file.path}
              isModified={file.isModified}
              onClick={() => setActiveFile(file.path)}
              onClose={() => closeFile(file.path)}
            />
          ))}
        </div>
      )}

      {/* Editor Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {activeFile ? (
          <div className="flex-1 h-full">
            <MonacoEditor
              value={activeFile.content}
              language={activeFile.language}
              theme="vs-dark"
              height="100%"
              onChange={(value) => {
                if (activeFilePath) {
                  useEditorStore.getState().updateFileContent(activeFilePath, value);
                }
              }}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-20 h-20 rounded-2xl bg-[#1a1a1a] border border-graphite flex items-center justify-center mb-6">
              <svg viewBox="0 0 24 24" width="40" height="40" className="text-zinc-500">
                <path
                  fill="currentColor"
                  d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-zinc-300 mb-2">No file open</h3>
            <p className="text-sm text-zinc-500 max-w-md">
              Select a file from the sidebar to start editing, or create a new file.
            </p>
            <button
              onClick={() => {
                // 创建新文件
                useEditorStore.getState().openFile(
                  "/untitled.tsx",
                  "untitled.tsx",
                  `// New File
import React from 'react';

export default function Component() {
  return <div>Hello World</div>;
}
`,
                  "typescript"
                );
              }}
              className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Create New File
            </button>
          </div>
        )}
      </div>

      {/* Floating AI Toolbar */}
      <AnimatePresence>
        {activeFile && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 slate-glass p-2 rounded-2xl border border-zinc-800 shadow-2xl flex items-center gap-2 z-50 w-full max-w-xl"
          >
            <div className="flex items-center gap-2 px-3 border-r border-zinc-800 text-zinc-500">
              <div className="w-4 h-4">
                <SimpleLogo size={16} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest">Slate AI</span>
            </div>

            <input
              type="text"
              placeholder="Ask AI to edit or generate..."
              className="flex-1 bg-transparent border-none focus:outline-none text-sm text-zinc-200 placeholder-zinc-600 px-2"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-500 border border-zinc-700 font-mono">⌘ K</kbd>
              <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white">
                <Zap size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Status Bar */}
      <div className="h-6 bg-charcoal border-t border-graphite px-4 flex items-center justify-between text-[10px] font-medium text-zinc-600 uppercase tracking-widest">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-emerald-500" />
            <span>{activeFile?.language || "Ready"}</span>
          </div>
          <span>Ln 12, Col 4</span>
        </div>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3">
              <SimpleLogo size={12} />
            </div>
            Cloud Sync
          </span>
        </div>
      </div>
    </div>
  );
}

interface TabProps {
  name: string;
  isActive: boolean;
  isModified?: boolean;
  onClick: () => void;
  onClose: () => void;
}

function Tab({ name, isActive, isModified = false, onClick, onClose }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-full px-3 flex items-center gap-2 text-xs font-semibold transition-all border-t-2 border-transparent group",
        isActive
          ? "bg-charcoal text-zinc-100 border-t-blue-500"
          : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/20"
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full",
        name.endsWith(".tsx") || name.endsWith(".ts") ? "bg-blue-500" :
        name.endsWith(".css") ? "bg-emerald-500" :
        name.endsWith(".json") ? "bg-yellow-500" : "bg-zinc-500"
      )} />
      <span className="max-w-[150px] truncate">{name}</span>
      {isModified && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
      <X
        size={12}
        className={cn(
          "ml-1 opacity-0 group-hover:opacity-100 transition-opacity",
          isActive ? "opacity-100 hover:text-zinc-300" : ""
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
    </button>
  );
}
