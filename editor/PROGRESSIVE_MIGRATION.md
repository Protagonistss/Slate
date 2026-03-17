# Editor 渐进式迁移指南

## ✅ 当前状态

项目已成功编译！新的模块化目录结构已创建，但暂时禁用了一些新组件以确保编译通过。

## 📁 新目录结构概览

```
editor/
├── core/                     # 核心基础设施（暂时禁用导出）
│   ├── stores/
│   └── styles/
│
├── features/                 # 业务功能模块（已创建，部分禁用）
│   ├── agent/                # AI Agent 功能
│   │   ├── store/            # ✅ 新的 agentStore (slices 模式)
│   │   │   ├── slices/       # ✅ 5 个 slices
│   │   │   └── utils.ts      # ✅ 工具函数
│   │   ├── components/       # ⏸️ 暂时禁用
│   │   ├── hooks/            # ⏸️ 暂时禁用
│   │   └── services/         # ⏸️ 暂时禁用
│   │
│   ├── layout/               # 布局功能
│   │   └── components/       # ⏸️ 暂时禁用
│   │
│   └── settings/             # 设置功能
│       └── tabs/             # ✅ 标签页组件已创建
│
├── shared/                   # 共享资源（已创建）
│   ├── components/ui/
│   ├── hooks/
│   ├── utils/
│   ├── types/
│   └── constants/
│
└── infrastructure/           # 基础设施（暂时禁用）
    ├── llm/
    ├── backend/
    ├── tools/
    ├── mcp/
    └── tauri/
```

## 🎯 渐进式迁移策略

### 第一阶段：使用新的 Agent Store（✅ 可用）

新的 agentStore 已经集成并可用！

**现有用法（继续有效）：**
```typescript
import { useAgentStore } from '@/stores';
```

**新用法（可选）：**
```typescript
import { useAgentStore } from '@/features/agent/store';
import type { AgentRun, AgentStep } from '@/features/agent/store/types';
```

**工具函数（新增）：**
```typescript
import {
  setStepStatus,
  appendStepSummary,
  attachArtifactToRun,
  addReasoningEntry
} from '@/features/agent/store/utils';
```

### 第二阶段：迁移到新的组件（下一步）

在确保第一阶段稳定后，可以逐步迁移到新的组件：

1. **Layout 组件迁移**
   - 当前：使用 `@/components/layout/AppLayout`
   - 新：使用 `@/features/layout/components/AppLayout`（暂时禁用）

2. **Settings 组件迁移**
   - 当前：使用 `@/components/views/SettingsView`
   - 新：使用 `@/features/settings/components/SettingsView`（暂时禁用）

3. **Agent 组件迁移**
   - 当前：使用 `@/components/views/AgentView`
   - 新：使用 `@/features/agent/components/*`（暂时禁用）

### 第三阶段：使用 Feature Hooks（未来）

当组件迁移完成后，可以使用新的 Feature Hooks：

```typescript
// 当前方式
const status = useAgentStore((state) => state.status);
const sendMessage = useAgentStore((state) => state.sendMessage);

// 新方式（可选）
import { useAgent } from '@/features/agent/hooks';
const { status, sendMessage, isProcessing } = useAgent();
```

### 第四阶段：使用服务层（未来）

最后可以引入服务层抽象：

```typescript
import { AgentExecutionService } from '@/features/agent/services';
import { PlanParser } from '@/features/agent/services';
import { ToolExecutor } from '@/features/agent/services';
```

## 🔧 启用新模块的方法

### 方法 1：逐个启用（推荐）

1. 选择一个模块（如 `features/agent/components`）
2. 移除 `.bak` 或 `.disabled` 后缀
3. 修复编译错误
4. 测试功能
5. 重复步骤 1-4

### 方法 2：功能分支

1. 创建新分支 `feature/modularization`
2. 在分支上启用所有新模块
3. 修复所有编译错误
4. 测试验证
5. 合并回主分支

## 📋 当前可用的功能

- ✅ 原有的所有功能（保持不变）
- ✅ 新的 agentStore 结构（向后兼容）
- ✅ 新的工具函数（可在现有代码中使用）
- ✅ 类型定义（`@/features/agent/store/types`）

## ⚠️ 暂时禁用的功能

- ⏸️ 新的 Layout 组件
- ⏸️ 新的 Settings 组件
- ⏸️ 新的 Agent 组件
- ⏸️ Feature Hooks
- ⏸️ 服务层抽象
- ⏸️ Infrastructure 模块

## 📝 下一步建议

### 立即可做的事情：

1. **使用新的工具函数**
   ```typescript
   import { setStepStatus, attachArtifactToRun } from '@/features/agent/store/utils';
   ```

2. **使用新的类型定义**
   ```typescript
   import type { AgentRun, ArtifactKind } from '@/features/agent/store/types';
   ```

3. **探索新的目录结构**
   - 查看 `features/agent/store/slices/` 了解 slice 结构
   - 查看 `features/settings/tabs/` 了解设置组件拆分

### 中期计划（1-2周）：

1. 启用并测试 `features/agent/components`
2. 迁移一个小功能的组件（如 SessionList）
3. 验证编译和功能正常

### 长期计划（1个月）：

1. 逐步迁移所有组件
2. 启用 Feature Hooks 层
3. 引入服务层抽象
4. 完成代码迁移

## 🔄 回滚方案

如果需要回滚，只需：
1. 恢复原有组件的导入路径
2. 删除 `features/` 目录
3. 项目完全恢复到重构前状态

## 📚 参考文档

- `REFACTOR_SUMMARY.md` - 重构总结
- `REFACTOR_MIGRATION.md` - 迁移指南
- `STYLE_GUIDE.md` - 样式系统指南

---

**状态**：✅ 编译通过，可随时开始渐进式迁移
