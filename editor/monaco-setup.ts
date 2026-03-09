/**
 * Monaco Editor 在 Vite 下需要先配置 Web Worker，必须在首次 import monaco-editor 之前执行。
 * 使用 Vite 的 ?worker 语法由打包器生成 Worker 产物。
 */
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

const getWorker = (_: unknown, label: string): Worker => {
  if (label === "json") return new jsonWorker();
  if (label === "css" || label === "scss" || label === "less")
    return new cssWorker();
  if (label === "html" || label === "handlebars" || label === "razor")
    return new htmlWorker();
  if (label === "typescript" || label === "javascript")
    return new tsWorker();
  return new editorWorker();
};

(self as unknown as { MonacoEnvironment: { getWorker: typeof getWorker } }).MonacoEnvironment = {
  getWorker,
};
