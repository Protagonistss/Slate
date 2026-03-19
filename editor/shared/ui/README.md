## shared/ui 约定（新增代码请遵循）

- **入口**：统一从 `@/shared/ui` 引用（如 `Button`、`Modal`、`Loading`、`ToastContainer`、`Tabs`、`IconButton`）。
- **默认样式体系**：Tailwind CSS + `cn()`（见 `editor/lib/utils.ts`）。
- **放置规则**：
  - **真正跨 feature 复用**的 UI 放 `editor/shared/ui/*`。
  - **只在单一业务模块内复用**的放对应 `editor/features/<feature>/components/*`。

