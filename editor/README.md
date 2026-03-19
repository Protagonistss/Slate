# Slate Editor Frontend

这是 Slate 项目的编辑器前端，基于 React + TypeScript + Vite 构建，运行在 Tauri 环境中。

## 🏛️ 架构概览

项目正在从传统的**分层架构**（Layered Architecture）逐步演进为**功能模块化架构**（Feature-based Architecture），以提高大型工程的可维护性和可扩展性。

### 目录结构

```
editor/
├── app/                      # 应用装配 (bootstrap、路由)
├── core/                     # 核心基础设施
│   ├── stores/               # 全局状态基类
│   └── styles/               # 全局主题与原子样式 (Tailwind v4)
├── features/                 # 业务功能模块 (垂直切片)
│   ├── agent/                # AI Agent 执行、推理展示与工件管理
│   ├── editor/               # Monaco 编辑器核心、语法高亮与 AI 辅助
│   ├── layout/               # 应用框架、导航与侧边栏
│   ├── settings/             # 配置管理、Provider 设置与账户
│   └── auth/                 # 用户认证与后端会话管理
├── shared/                   # 共享资源 (水平切片)
│   ├── hooks/                # 跨 feature 复用 Hooks (如 useAiEditorState)
│   └── ui/                   # 通用 UI 组件 (Button, Modal, Loading, Toast, Tabs, IconButton)
├── widgets/                  # 页面级组合件 (RightSidebar, AIStatusIndicator 等)
├── lib/                      # 工具函数 (如 cn)，推荐从 @/shared/ui 引用 cn
├── stores/                   # [遗留] 全局状态存储 (逐步迁移至 features/*/store)
├── services/                 # [遗留] 业务服务类 (逐步迁移至 features/*/services)
└── styles/                   # 全局样式 (theme.css 等)
```

## 🎨 开发规范

### 1. 样式系统
- **Tailwind CSS v4**: 核心样式方案，配置文件见 `theme.css`。
- **语义化命名**: 优先使用 `--color-obsidian` 等系统变量定义的类名。
- **工具类**: 使用 `cn()` (clsx + tailwind-merge) 合并类名；`cn` 从 `@/shared/ui` 或 `@/lib/utils` 引用，推荐统一用 `@/shared/ui`。

### 2. 状态管理
- **Zustand Slice 模式**: 模块化存储，避免巨型 Store。
- **Feature Hooks**: 暴露给组件的 API 必须通过 Hooks 封装，禁止组件直接依赖 Store 细节。
- **跨 Store 调用**：仅在 app 层、store 的 action、或 services 层使用 `useXxxStore.getState()` 调用其他 store；组件内不编排多 store。详见 [docs/CONVENTIONS.md](docs/CONVENTIONS.md)。

### 3. 组件开发
- **Feature-first**: 新组件应首先考虑放置在对应的 `features/` 下。
- **共享 UI**: 跨 feature 复用的 UI 放入 `shared/ui/`，入口为 `@/shared/ui`；通用 UI 仅从 `@/shared/ui` 引用。
- **Container/Presentational**: 复杂逻辑尽量抽离到模块私有的 `services/` 或 `hooks/`。

### 4. 引用约定
- **通用 UI 与 cn**：从 `@/shared/ui` 引用（如 `Button`、`Modal`、`Loading`、`ToastContainer`、`Tabs`、`IconButton`、`Logo`、`SimpleLogo`、`cn`）。
- **共享 Hooks**：从 `@/shared/hooks` 引用（如 `useAiEditorState`、`useEditorState`）；Agent 能力请用 `@/features/agent/hooks`。
- **页面级组合件**：从 `@/widgets` 或 `@/widgets/*` 引用（如 `RightSidebar`、`AIStatusIndicator`）。应用装配与路由从 `@/app/bootstrap`、`@/app/router` 引用。
- **Layout 与 Widgets 边界**：见 [docs/CONVENTIONS.md](docs/CONVENTIONS.md)。仅 editor 使用的重型组件（如 MonacoEditor）从 `@/features/editor/components` 引用。

## 🚀 迁移路线图 (Migration Roadmap)

- ✅ **Phase 1**: 完成 `editor/` 目录重构与 Vite 配置。
- ✅ **Phase 2**: 实现 LLM 适配层与基础工具系统。
- ✅ **Phase 3**: 启动 Agent Store 的 Slice 化重构。
- ✅ **Phase 4**: 通用 UI (Button/Modal/Loading/Toast) 已迁至 `shared/ui`。
- 🔄 **Phase 5**: 移除 `stores/` 和 `services/` 顶层目录，实现完全的模块化。归属表与迁移顺序见 [docs/CLEANUP-ANALYSIS.md](docs/CLEANUP-ANALYSIS.md)。

## 🛠️ 快速上手

```bash
# 进入 editor 开发环境 (通常在根目录执行)
npm run tauri:dev
```

## 🔧 运行时后端地址（Tauri 发布后可改）

Slate Editor（Tauri 桌面端）支持通过 `env.json` 在**运行时**覆盖后端服务地址，方便你把 editor 与 backend 分开部署/本地切换。

- **项目级（优先）**：`<project>/.slate/env.json`
- **用户级（兜底）**：`~/.slate/env.json`

文件格式：

```json
{
  "backendUrl": "http://127.0.0.1:8000/api/v1"
}
```

优先级（从高到低）：

1. `<project>/.slate/env.json`
2. `~/.slate/env.json`
3. `VITE_BACKEND_URL`（构建期变量）
4. 默认值（Tauri 下为 `http://127.0.0.1:8000/api/v1`）

更多信息请参考根目录的 [README.md](../README.md)。
