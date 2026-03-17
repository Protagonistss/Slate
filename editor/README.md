# Slate Editor Frontend

这是 Slate 项目的编辑器前端，基于 React + TypeScript + Vite 构建，运行在 Tauri 环境中。

## 🏛️ 架构概览

项目正在从传统的**分层架构**（Layered Architecture）逐步演进为**功能模块化架构**（Feature-based Architecture），以提高大型工程的可维护性和可扩展性。

### 目录结构

```
editor/
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
│   ├── components/           # 通用 UI 组件 (Button, Modal, Loading)
│   ├── hooks/                # 公共 React Hooks
│   ├── utils/                # 工具函数与路径处理
│   └── types/                # 全局 TypeScript 类型定义
├── infrastructure/           # 外部系统适配层
│   ├── llm/                  # 各种大模型供应商的适配实现
│   ├── backend/              # FastAPI 后端 API 通讯
│   ├── mcp/                  # Model Context Protocol 实现
│   └── tauri/                # Tauri 原生功能封装 (FS, Shell, Dialog)
├── stores/                   # [遗留] 全局状态存储 (逐步迁移至 features/*/store)
└── services/                 # [遗留] 业务服务类 (逐步迁移至 features/*/services)
```

## 🎨 开发规范

### 1. 样式系统
- **Tailwind CSS v4**: 核心样式方案，配置文件见 `theme.css`。
- **语义化命名**: 优先使用 `--color-obsidian` 等系统变量定义的类名。
- **工具类**: 使用 `cn()` (clsx + tailwind-merge) 合并类名。

### 2. 状态管理
- **Zustand Slice 模式**: 模块化存储，避免巨型 Store。
- **Feature Hooks**: 暴露给组件的 API 必须通过 Hooks 封装，禁止组件直接依赖 Store 细节。

### 3. 组件开发
- **Feature-first**: 新组件应首先考虑放置在对应的 `features/` 下。
- **Container/Presentational**: 复杂逻辑尽量抽离到模块私有的 `services/` 或 `hooks/`。

## 🚀 迁移路线图 (Migration Roadmap)

- ✅ **Phase 1**: 完成 `editor/` 目录重构与 Vite 配置。
- ✅ **Phase 2**: 实现 LLM 适配层与基础工具系统。
- ✅ **Phase 3**: 启动 Agent Store 的 Slice 化重构。
- 🔄 **Phase 4**: 将 `components/` 现有的 UI 代码迁移到 `features/` 对应的模块中。
- 🔄 **Phase 5**: 移除 `stores/` 和 `services/` 顶层目录，实现完全的模块化。

## 🛠️ 快速上手

```bash
# 进入 editor 开发环境 (通常在根目录执行)
npm run tauri:dev
```

更多信息请参考根目录的 [README.md](../README.md)。
