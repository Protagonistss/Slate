import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import type { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import './MonacoEditor.css';

export interface MonacoEditorProps {
  value?: string;
  language?: string;
  theme?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  height?: string | number;
  className?: string;
  onSave?: (value: string) => void;
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
      theme = 'vs-dark',
      readOnly = false,
      onChange,
      height = '100%',
      className = '',
      onSave,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const onChangeRef = useRef(onChange);
    const onSaveRef = useRef(onSave);

    // 更新 refs
    useEffect(() => {
      onChangeRef.current = onChange;
      onSaveRef.current = onSave;
    }, [onChange, onSave]);

    // 暴露编辑器 API
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

    // 初始化编辑器
    useEffect(() => {
      if (!containerRef.current) return;

      monaco.editor.setTheme(theme);

      const editorInstance = monaco.editor.create(containerRef.current, {
        value,
        language,
        readOnly,
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        renderWhitespace: 'selection',
        cursorBlinking: 'smooth',
        smoothScrolling: true,
        padding: { top: 12 },
      });

      editorRef.current = editorInstance;

      // 监听内容变化
      const disposable = editorInstance.onDidChangeModelContent(() => {
        onChangeRef.current?.(editorInstance.getValue());
      });

      // 添加保存快捷键
      editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSaveRef.current?.(editorInstance.getValue());
      });

      return () => {
        disposable.dispose();
        editorInstance.dispose();
        editorRef.current = null;
      };
    }, [theme, language, readOnly]);

    // 更新值
    useEffect(() => {
      const ed = editorRef.current;
      if (!ed) return;

      const currentValue = ed.getValue();
      if (currentValue !== value) {
        ed.setValue(value);
      }
    }, [value]);

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
