import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import type { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import { invoke } from '@tauri-apps/api/core';
import './MonacoEditor.css';

export interface MonacoEditorProps {
  value?: string;
  language?: string;
  theme?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onCursorPositionChange?: (position: monaco.IPosition) => void;
  height?: string | number;
  className?: string;
  onSave?: (value: string) => void;
  fontSize?: number;
  minimap?: boolean;
  wordWrap?: editor.IEditorOptions['wordWrap'];
  lineNumbers?: editor.IEditorOptions['lineNumbers'];
  projectPath?: string | null;
  filePath?: string | null;
  gitDiffRefreshSeq?: number;
}

export interface EditorSelection {
  text: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

export interface MonacoEditorRef {
  getEditorInstance: () => editor.IStandaloneCodeEditor | null;
  getContent: () => string;
  setContent: (content: string) => void;
  insertText: (text: string, position?: { line: number; column: number }) => void;
  replaceSelection: (text: string) => void;
  getSelection: () => EditorSelection | null;
  setLanguage: (lang: string) => void;
  getLanguage: () => string;
}

const defaultCode = `// Slate Editor
// AI-powered code editor

function greet(name: string) {
  console.log(\`Hello, \${name}!\`);
}

greet('World');
`;

export const MonacoEditor = forwardRef<MonacoEditorRef, MonacoEditorProps>(
  (
    {
      value = defaultCode,
      language = 'typescript',
      theme = 'slate-dark',
      readOnly = false,
      onChange,
      onCursorPositionChange,
      height = '100%',
      className = '',
      onSave,
      fontSize = 13,
      minimap = false,
      wordWrap = 'on',
      lineNumbers = 'on',
      projectPath = null,
      filePath = null,
      gitDiffRefreshSeq = 0,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const onChangeRef = useRef(onChange);
    const onSaveRef = useRef(onSave);
    const onCursorPositionChangeRef = useRef(onCursorPositionChange);
    const decorationsRef = useRef<string[]>([]);
    const diffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      onChangeRef.current = onChange;
      onSaveRef.current = onSave;
      onCursorPositionChangeRef.current = onCursorPositionChange;
    }, [onChange, onSave, onCursorPositionChange]);

    const getContent = useCallback(() => editorRef.current?.getValue() || '', []);
    const setContent = useCallback((content: string) => {
      editorRef.current?.setValue(content);
    }, []);

    const insertText = useCallback((text: string, position?: { line: number; column: number }) => {
      const editor = editorRef.current;
      if (!editor) return;

      if (position) {
        editor.executeEdits('', [
          {
            range: new monaco.Range(
              position.line,
              position.column,
              position.line,
              position.column
            ),
            text,
          },
        ]);
      } else {
        const pos = editor.getPosition();
        if (pos) {
          editor.executeEdits('', [
            {
              range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
              text,
            },
          ]);
        }
      }
    }, []);

    const replaceSelection = useCallback((text: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      const selection = editor.getSelection();
      if (selection) {
        editor.executeEdits('', [{ range: selection, text }]);
      }
    }, []);

    const getSelection = useCallback((): EditorSelection | null => {
      const editor = editorRef.current;
      if (!editor) return null;

      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) return null;

      const model = editor.getModel();
      if (!model) return null;

      return {
        text: model.getValueInRange(selection),
        startLine: selection.startLineNumber,
        endLine: selection.endLineNumber,
        startColumn: selection.startColumn,
        endColumn: selection.endColumn,
      };
    }, []);

    const setLanguage = useCallback((lang: string) => {
      const model = editorRef.current?.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, lang);
      }
    }, []);

    const getLanguage = useCallback(() => {
      return editorRef.current?.getModel()?.getLanguageId() || 'plaintext';
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getEditorInstance: () => editorRef.current,
        getContent,
        setContent,
        insertText,
        replaceSelection,
        getSelection,
        setLanguage,
        getLanguage,
      }),
      [getContent, setContent, insertText, replaceSelection, getSelection, setLanguage, getLanguage]
    );

    const defineSlateTheme = useCallback(() => {
      monaco.editor.defineTheme('slate-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '71717A', fontStyle: 'italic' },
          { token: 'keyword', foreground: 'A1A1AA' },
          { token: 'string', foreground: 'D4D4D8' },
          { token: 'number', foreground: 'A1A1AA' },
          { token: 'delimiter', foreground: '71717A' },
          { token: 'type.identifier', foreground: 'E4E4E7' },
          { token: 'identifier', foreground: 'D4D4D8' },
        ],
        colors: {
          'editor.background': '#0A0A0A',
          'editor.foreground': '#D4D4D8',
          'editorLineNumber.foreground': '#52525B',
          'editorLineNumber.activeForeground': '#A1A1AA',
          'editorCursor.foreground': '#FAFAFA',
          'editor.selectionBackground': '#27272A',
          'editor.inactiveSelectionBackground': '#18181B',
          'editor.lineHighlightBackground': '#0F0F10',
          'editor.lineHighlightBorder': '#00000000',
          'editorWhitespace.foreground': '#27272A',
          'editorIndentGuide.background1': '#1F1F22',
          'editorIndentGuide.activeBackground1': '#3F3F46',
          'editorGutter.background': '#0A0A0A',
          'editorWidget.background': '#121212',
          'editorWidget.border': '#262626',
          'scrollbarSlider.background': '#3F3F4680',
          'scrollbarSlider.hoverBackground': '#52525B99',
          'scrollbarSlider.activeBackground': '#71717ACC',
          'minimap.background': '#0A0A0A',
        },
      });
    }, []);

    useEffect(() => {
      if (!containerRef.current || editorRef.current) return;

      defineSlateTheme();
      monaco.editor.setTheme(theme);
      const editorInstance = monaco.editor.create(containerRef.current, {
        value,
        language,
        readOnly,
        automaticLayout: true,
        minimap: { enabled: minimap },
        fontSize,
        lineNumbers,
        scrollBeyondLastLine: false,
        wordWrap,
        tabSize: 2,
        renderWhitespace: 'none',
        cursorBlinking: 'smooth',
        smoothScrolling: true,
        padding: { top: 24, bottom: 24 },
        overviewRulerBorder: false,
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 16,
        lineNumbersMinChars: 3,
        renderLineHighlightOnlyWhenFocus: false,
        bracketPairColorization: { enabled: false },
        guides: {
          indentation: true,
          highlightActiveIndentation: true,
          bracketPairs: false,
        },
        scrollbar: {
          verticalScrollbarSize: 6,
          horizontalScrollbarSize: 6,
          useShadows: false,
        },
      });

      editorRef.current = editorInstance;

      const disposable = editorInstance.onDidChangeModelContent(() => {
        onChangeRef.current?.(editorInstance.getValue());
      });

      editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSaveRef.current?.(editorInstance.getValue());
      });

      const cursorDisposable = editorInstance.onDidChangeCursorPosition((event) => {
        onCursorPositionChangeRef.current?.(event.position);
      });

      const initialPosition = editorInstance.getPosition();
      if (initialPosition) {
        onCursorPositionChangeRef.current?.(initialPosition);
      }

      return () => {
        disposable.dispose();
        cursorDisposable.dispose();
        editorInstance.dispose();
        editorRef.current = null;
      };
    }, [defineSlateTheme, fontSize, language, lineNumbers, minimap, readOnly, theme, value, wordWrap]);

    useEffect(() => {
      const ed = editorRef.current;
      if (!ed) return;

      const currentValue = ed.getValue();
      if (currentValue !== value) {
        ed.setValue(value);
      }
    }, [value]);

    useEffect(() => {
      defineSlateTheme();
      monaco.editor.setTheme(theme);
    }, [defineSlateTheme, theme]);

    useEffect(() => {
      const ed = editorRef.current;
      const model = ed?.getModel();
      if (!ed || !model) return;

      if (model.getLanguageId() !== language) {
        monaco.editor.setModelLanguage(model, language);
      }
    }, [language]);

    useEffect(() => {
      const ed = editorRef.current;
      if (!ed) return;

      ed.updateOptions({
        readOnly,
        fontSize,
        minimap: { enabled: minimap },
        wordWrap,
        lineNumbers,
      });
    }, [fontSize, lineNumbers, minimap, readOnly, wordWrap]);

    type GitDiffRange = {
      kind: 'added' | 'modified' | 'deleted' | string;
      startLine: number;
      endLine: number;
    };

    const applyGitDiffDecorations = useCallback((ranges: GitDiffRange[]) => {
      const ed = editorRef.current;
      const model = ed?.getModel();
      if (!ed || !model) return;

      const newDecorations: editor.IModelDeltaDecoration[] = [];
      for (const r of ranges) {
        const start = Math.max(1, r.startLine);
        const end = Math.max(start, r.endLine);

        const kind = r.kind;
        const isDeleted = kind === 'deleted';
        const isAdded = kind === 'added';
        const lineClass = isAdded
          ? 'slateDiffLineAdded'
          : isDeleted
            ? 'slateDiffLineDeleted'
            : 'slateDiffLineModified';
        const gutterClass = isAdded
          ? 'slateDiffGutterAdded'
          : isDeleted
            ? 'slateDiffGutterDeleted'
            : 'slateDiffGutterModified';

        newDecorations.push({
          range: new monaco.Range(start, 1, end, 1),
          options: {
            isWholeLine: true,
            className: lineClass,
            linesDecorationsClassName: gutterClass,
          },
        });
      }

      decorationsRef.current = ed.deltaDecorations(decorationsRef.current, newDecorations);
    }, []);

    const refreshGitDiff = useCallback(async () => {
      if (!projectPath || !filePath) {
        applyGitDiffDecorations([]);
        return;
      }
      try {
        const ranges = await invoke<GitDiffRange[]>('get_git_diff_ranges', {
          projectPath,
          relativePath: filePath,
        });
        applyGitDiffDecorations(Array.isArray(ranges) ? ranges : []);
      } catch {
        applyGitDiffDecorations([]);
      }
    }, [applyGitDiffDecorations, filePath, projectPath]);

    useEffect(() => {
      if (diffTimerRef.current) {
        clearTimeout(diffTimerRef.current);
      }
      diffTimerRef.current = setTimeout(() => {
        diffTimerRef.current = null;
        void refreshGitDiff();
      }, 150);

      return () => {
        if (diffTimerRef.current) {
          clearTimeout(diffTimerRef.current);
          diffTimerRef.current = null;
        }
      };
    }, [gitDiffRefreshSeq, projectPath, filePath, refreshGitDiff]);

    return (
      <div
        className={`monaco-editor-wrapper ${className}`}
        ref={containerRef}
        style={{ height, width: '100%', minHeight: 200 }}
      />
    );
  }
);

MonacoEditor.displayName = 'MonacoEditor';
