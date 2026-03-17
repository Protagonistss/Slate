# Editor 代码重构迁移指南

## 概述

本文档说明了 editor 项目的代码重构和新模块化结构的使用方法。

## 新的目录结构

```
editor/
├── core/                     # 核心基础设施
│   ├── stores/               # 状态管理基础
│   └── styles/               # 全局样式
│
├── features/                 # 业务功能模块
│   ├── auth/                 # 认证功能
│   ├── agent/                # AI Agent 功能
│   │   ├── components/       # Agent 相关组件
│   │   ├── hooks/            # Agent hooks
│   │   ├── services/         # Agent 服务
│   │   ├── store/            # Agent store (slices)
│   │   └── types.ts          # Agent 类型
│   ├── conversation/         # 会话管理
│   ├── editor/               # 编辑器功能
│   ├── project/              # 项目管理
│   ├── settings/             # 设置功能
│   │   ├── components/       # 设置组件
│   │   └── tabs/             # 设置标签页
│   └── layout/               # 布局功能
│       └── components/       # 布局组件
│
├── shared/                   # 共享资源
│   ├── components/ui/        # 基础 UI 组件
│   ├── hooks/                # 通用 hooks
│   ├── utils/                # 工具函数
│   ├── types/                # 共享类型
│   └── constants/            # 常量
│
└── infrastructure/           # 基础设施
    ├── llm/                  # LLM 服务层
    ├── backend/              # 后端 API
    ├── tools/                # 工具系统
    ├── mcp/                  # MCP 服务
    └── tauri/                # Tauri API
```

## 迁移指南

### Agent Store 迁移

**旧方式：**
```typescript
import { useAgentStore } from '@/stores';

const status = useAgentStore((state) => state.status);
const sendMessage = useAgentStore((state) => state.sendMessage);
```

**新方式（推荐）：**
```typescript
import { useAgent } from '@/features/agent/hooks';

const { status, sendMessage, isProcessing } = useAgent();
```

或者使用更细粒度的 hooks：
```typescript
import { useAgentRun } from '@/features/agent/hooks';
import { useToolExecution } from '@/features/agent/hooks';

const run = useAgentRun();
const tools = useToolExecution();
```

### 布局组件迁移

**旧方式：**
```typescript
import { AppLayout } from '@/components/layout';
```

**新方式：**
```typescript
import { AppLayout } from '@/features/layout/components';
// 或
import { AppLayout } from '@/features/layout';
```

### 设置组件迁移

**旧方式：**
```typescript
import { SettingsView } from '@/components/views';
```

**新方式：**
```typescript
import { SettingsView } from '@/features/settings/components';
// 或使用单独的标签页组件
import { AccountSettings, MCPSettings } from '@/features/settings/tabs';
```

### Agent 组件迁移

**新方式：**
```typescript
// 使用重构后的子组件
import { ReasoningView } from '@/features/agent/components';
import { StepList } from '@/features/agent/components';
import { ArtifactPanel } from '@/features/agent/components';
```

## 服务层使用

### Agent Execution Service

```typescript
import { AgentExecutionService } from '@/features/agent/services';

// 准备上下文
const context = AgentExecutionService.prepareMessageContext(
  conversationId,
  llmConfig,
  accessToken,
  toolContext,
  externalTools,
  systemPrompt
);

// 执行 agent 运行
const run = await AgentExecutionService.executeAgentRun(
  context,
  goal,
  signal,
  onUpdate
);
```

### Plan Parser

```typescript
import { PlanParser } from '@/features/agent/services';

// 解析计划
const plan = PlanParser.parseFromToolInput(input);

// 验证计划
const validation = PlanParser.validatePlan(plan);

// 转换为 markdown
const markdown = PlanParser.toMarkdown(plan);
```

### Tool Executor

```typescript
import { ToolExecutor } from '@/features/agent/services';

// 执行工具
const result = await ToolExecutor.executeToolCall(
  name,
  input,
  conversationId,
  updateRunState
);
```

## 向后兼容性

旧的导入路径仍然可用，通过重定向到新的模块化结构实现：

```typescript
// stores/index.ts 重新导出
export { useAgentStore } from '@/features/agent/store';

// components/layout/index.ts 重新导出
export { AppLayout } from '@/features/layout/components';

// components/views/index.ts 重新导出
export { SettingsView } from '@/features/settings/components';
```

## 后续步骤

1. **逐步迁移**：建议逐步将新组件迁移到新的导入路径
2. **测试验证**：确保所有功能正常工作
3. **删除旧代码**：在确认所有功能正常后，可以删除旧的实现文件

## 注意事项

- 新的模块化结构提供了更好的代码组织和可维护性
- Feature Hooks 层提供了更清晰的数据访问接口
- 服务层抽象使业务逻辑更加独立
- 所有旧代码通过重新导出保持向后兼容
