import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Share2, Sparkles, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonacoEditor, type MonacoEditorRef } from "../editor/MonacoEditor";
import { SimpleLogo } from "../shared";
import { useEditorStore } from "../../stores/editorStore";

type AiStatus = "idle" | "generating" | "diff";

const AI_MODELS = [
  { value: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "claude-3.5-haiku", label: "Claude 3.5 Haiku" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
];

const DEFAULT_CURSOR = {
  lineNumber: 1,
  column: 1,
};

const EMPTY_FILE_TEMPLATE = `import React from 'react';

export default function Component() {
  return <div>Hello Slate</div>;
}
`;

function formatLanguageLabel(language?: string) {
  if (!language) return "Ready";

  const normalized = language.toLowerCase();
  const labels: Record<string, string> = {
    typescript: "TypeScript",
    javascript: "JavaScript",
    tsx: "TypeScript React",
    jsx: "JavaScript React",
    json: "JSON",
    css: "CSS",
    html: "HTML",
    markdown: "Markdown",
    md: "Markdown",
    plaintext: "Plain Text",
  };

  return labels[normalized] ?? language;
}

export function EditorView() {
  const editorRef = useRef<MonacoEditorRef | null>(null);
  const generationTimerRef = useRef<number | null>(null);
  const {
    openFiles,
    activeFilePath,
    closeFile,
    setActiveFile,
    updateFileContent,
    openFile,
    markFileModified,
    theme,
    fontSize,
    wordWrap,
    minimap,
    lineNumbers,
  } = useEditorStore();
  const [prompt, setPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].value);
  const [cursorPosition, setCursorPosition] = useState(DEFAULT_CURSOR);

  const activeFile = openFiles.find((file) => file.path === activeFilePath) ?? null;
  const selectedModelLabel =
    AI_MODELS.find((model) => model.value === selectedModel)?.label ?? AI_MODELS[0].label;

  const clearGenerationTimer = () => {
    if (generationTimerRef.current !== null) {
      window.clearTimeout(generationTimerRef.current);
      generationTimerRef.current = null;
    }
  };

  const resetAiState = (clearPrompt = false) => {
    clearGenerationTimer();
    setAiStatus("idle");
    if (clearPrompt) {
      setPrompt("");
    }
  };

  const handleAiSubmit = () => {
    if (!activeFile || !prompt.trim() || aiStatus === "generating") {
      return;
    }

    clearGenerationTimer();
    setAiStatus("generating");
    generationTimerRef.current = window.setTimeout(() => {
      setAiStatus("diff");
      generationTimerRef.current = null;
    }, 2200);
  };

  const handleAcceptOrDiscard = () => {
    resetAiState(true);
  };

  const handleCreateFile = () => {
    openFile("/untitled.tsx", "untitled.tsx", EMPTY_FILE_TEMPLATE, "typescript");
  };

  useEffect(() => {
    return () => {
      clearGenerationTimer();
    };
  }, []);

  useEffect(() => {
    if (!activeFilePath && openFiles.length > 0) {
      setActiveFile(openFiles[0].path);
    }
  }, [activeFilePath, openFiles, setActiveFile]);

  useEffect(() => {
    if (!activeFile) {
      setCursorPosition(DEFAULT_CURSOR);
      resetAiState(true);
      return;
    }

    resetAiState(false);
  }, [activeFile?.path]);

  return (
    <div className="flex-1 h-full bg-transparent flex flex-col relative overflow-hidden">
      {openFiles.length > 0 && (
        <div className="h-9 border-b border-graphite bg-obsidian flex items-center overflow-x-auto select-none px-2 shrink-0">
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

      <div className="flex-1 flex overflow-hidden bg-obsidian relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.02] to-transparent" />
        {activeFile ? (
          <div className="flex-1 min-w-0 h-full relative">
            <MonacoEditor
              ref={editorRef}
              value={activeFile.content}
              language={activeFile.language}
              theme={theme}
              fontSize={fontSize}
              wordWrap={wordWrap}
              minimap={minimap}
              lineNumbers={lineNumbers}
              height="100%"
              className="h-full"
              onChange={(value) => {
                updateFileContent(activeFile.path, value);
              }}
              onSave={() => {
                markFileModified(activeFile.path, false);
              }}
              onCursorPositionChange={(position) => {
                setCursorPosition({
                  lineNumber: position.lineNumber,
                  column: position.column,
                });
              }}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="flex w-full max-w-xs flex-col items-center text-center -translate-y-8">
              <div className="mb-5 h-6 w-6 ai-pulse">
                <SimpleLogo size={24} />
              </div>
              <h3 className="text-[24px] font-medium tracking-[-0.03em] text-zinc-100">
                No file open
              </h3>
              <p className="mt-2 text-sm text-zinc-500">
                Open from Explorer or create a file.
              </p>
              <button
                onClick={handleCreateFile}
                className="mt-6 inline-flex h-9 items-center justify-center rounded-sm border border-zinc-800 bg-transparent px-4 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-900 hover:text-white"
              >
                New File
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {activeFile && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={cn(
              "absolute bottom-12 left-1/2 -translate-x-1/2 slate-glass p-2 rounded-2xl border shadow-2xl flex items-center gap-2 z-50 w-[calc(100%-2rem)] max-w-xl transition-all duration-300",
              aiStatus === "generating"
                ? "border-zinc-700 bg-zinc-900/90 shadow-[0_0_30px_-5px_rgba(255,255,255,0.05)]"
                : "border-zinc-800"
            )}
          >
            <div className="flex items-center gap-2 pl-3 pr-2 border-r border-zinc-800/80">
              <Sparkles
                size={14}
                className={cn(
                  "shrink-0 transition-colors",
                  aiStatus === "generating" ? "text-zinc-100" : "text-zinc-300"
                )}
              />
            </div>

            <input
              type="text"
              placeholder={
                aiStatus === "generating"
                  ? "Generating... (Press ESC to stop)"
                  : aiStatus === "diff"
                  ? "Ask AI to tweak this diff..."
                  : "Ask AI to edit or generate..."
              }
              className="flex-1 bg-transparent border-none focus:outline-none text-sm text-zinc-200 placeholder-zinc-600 px-3"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleAiSubmit();
                }

                if (event.key === "Escape" && aiStatus === "generating") {
                  resetAiState(false);
                }
              }}
              readOnly={aiStatus === "generating"}
            />

            <div className="flex items-center gap-1.5 pr-1">
              {aiStatus === "generating" ? (
                <button
                  onClick={() => resetAiState(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors text-xs font-medium"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  Stop & Edit
                </button>
              ) : aiStatus === "diff" ? (
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-500 border border-zinc-700 font-mono hidden sm:inline-block">
                    ↵
                  </kbd>
                  <button
                    onClick={handleAiSubmit}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors text-xs font-medium"
                    title="Follow up or regenerate"
                  >
                    <Zap size={14} />
                    <span>Update</span>
                  </button>
                  <div className="w-px h-3.5 bg-zinc-800 mx-0.5" />
                  <button
                    onClick={handleAcceptOrDiscard}
                    className="px-3 py-1.5 rounded-lg bg-transparent text-zinc-400 hover:text-zinc-200 transition-colors text-xs font-medium border border-zinc-800 hover:border-zinc-700"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleAcceptOrDiscard}
                    className="px-3 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors text-xs font-medium"
                  >
                    Accept
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative group/model">
                    <select
                      value={selectedModel}
                      onChange={(event) => setSelectedModel(event.target.value)}
                      className="appearance-none bg-transparent hover:bg-zinc-800/40 text-[11px] font-medium text-zinc-500 hover:text-zinc-300 pl-2 pr-5 py-1 rounded cursor-pointer outline-none transition-all w-[115px] truncate text-right"
                    >
                      {AI_MODELS.map((model) => (
                        <option
                          key={model.value}
                          value={model.value}
                          className="bg-zinc-900 text-zinc-300 py-1"
                        >
                          {model.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={10}
                      className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover/model:opacity-100 transition-opacity"
                    />
                  </div>

                  <div className="w-px h-3.5 bg-zinc-800 mx-0.5" />

                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-500 border border-zinc-700 font-mono hidden sm:inline-block">
                    ↵
                  </kbd>
                  <button
                    onClick={handleAiSubmit}
                    disabled={!prompt.trim()}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      prompt.trim()
                        ? "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        : "text-zinc-700 cursor-not-allowed"
                    )}
                  >
                    <Zap size={16} />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-6 bg-charcoal border-t border-graphite px-4 flex items-center justify-between text-[10px] font-medium text-zinc-500 uppercase tracking-wider shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            <span>{formatLanguageLabel(activeFile?.language)}</span>
          </div>
          <span>
            Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}
          </span>
        </div>
        <div className="flex items-center gap-4 min-w-0">
          <span>UTF-8</span>
          <span className="hidden md:inline truncate">{selectedModelLabel}</span>
          <span className="flex items-center gap-1 hover:text-zinc-300 transition-colors cursor-pointer">
            <Share2 size={10} />
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
        "h-full px-3 flex items-center gap-2 text-[12px] transition-all border-b-2 group/tab shrink-0",
        isActive
          ? "bg-zinc-800/50 text-zinc-100 border-b-zinc-400 font-medium"
          : "text-zinc-500 border-b-transparent hover:text-zinc-300 hover:bg-white/5 font-normal"
      )}
    >
      <div className="flex items-center justify-center w-2 flex-shrink-0">
        {isModified ? (
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
        )}
      </div>
      <span className="max-w-[160px] truncate leading-none">{name}</span>
      <div
        className="group/close flex items-center justify-center ml-0.5 w-4 h-4 rounded hover:bg-white/10 transition-colors cursor-pointer"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <X
          size={14}
          className={cn(
            "transition-colors",
            isActive
              ? "text-zinc-500 group-hover/close:text-zinc-200"
              : "text-transparent group-hover/tab:text-zinc-500 group-hover/close:!text-zinc-200"
          )}
        />
      </div>
    </button>
  );
}
