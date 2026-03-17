# 快速参考 - 如何使用新的模块化结构

## 🎯 现在就可以使用的新功能

### 1. 新的 Agent Store 工具函数

在现有代码中，你可以使用这些纯函数来操作 Agent 运行：

```typescript
import {
  setStepStatus,
  appendStepSummary,
  attachArtifactToRun,
  addReasoningEntry,
  createArtifact,
  replaceArtifact
} from '@/features/agent/store/utils';

import type {
  AgentRun,
  AgentStepStatus,
  ArtifactKind,
  AgentReasoningPhase
} from '@/features/agent/store/types';

// 示例：更新步骤状态
const updatedRun = setStepStatus(run, 'step_1', 'running', '开始执行...');

// 示例：追加步骤摘要
const updatedRun = appendStepSummary(run, 'step_1', '完成了文件读取');

// 示例：附加工件
const updatedRun = attachArtifactToRun(run, {
  stepId: 'step_1',
  path: '/src/index.ts',
  kind: 'file',
  title: '主入口文件',
  preview: '新增路由逻辑...'
});

// 示例：添加推理记录
const updatedRun = addReasoningEntry(run, 'execution', '正在分析代码结构...');
```

### 2. 新的类型定义

使用集中管理的类型定义：

```typescript
// 旧方式
import type { AgentRun, ArtifactKind } from '@/stores';

// 新方式（更清晰）
import type {
  AgentRun,
  AgentStep,
  AgentStepStatus,
  AgentRunPhase,
  ArtifactKind,
  ArtifactRef,
  ReasoningEntry
} from '@/features/agent/store/types';
```

### 3. Slice 工具函数

直接使用 slice 中的工具函数：

```typescript
import {
  createStepsFromPlan,
  updateRun,
  pauseRun,
  ensureRunnableStep
} from '@/features/agent/store/slices';

// 解析并创建步骤
const steps = createStepsFromPlan(parsedPlan);

// 运行控制
const pausedRun = pauseRun(currentRun);
const readyRun = ensureRunnableStep(currentRun);
```

## 📋 完整示例

### 示例 1：在现有组件中使用工具函数

```typescript
import { useAgentStore } from '@/stores';
import {
  setStepStatus,
  attachArtifactToRun,
  addReasoningEntry
} from '@/features/agent/store/utils';
import type { ArtifactKind } from '@/features/agent/store/types';

function MyComponent() {
  const currentRun = useAgentStore((state) =>
    Object.values(state.runsByConversation)[0]
  );

  const handleStepComplete = (stepId: string) => {
    if (!currentRun) return;

    // 更新步骤状态
    const updatedRun = setStepStatus(currentRun, stepId, 'completed', '完成');

    // 添加工件
    attachArtifactToRun(updatedRun, {
      stepId,
      path: '/src/example.ts',
      kind: 'file',
      title: '示例文件'
    });

    // 添加推理记录
    addReasoningEntry(updatedRun, 'execution', '步骤执行成功');
  };
}
```

### 示例 2：创建工具函数包装器

```typescript
// utils/agentHelpers.ts
import {
  setStepStatus,
  appendStepSummary,
  attachArtifactToRun
} from '@/features/agent/store/utils';
import type { AgentRun, ArtifactKind } from '@/features/agent/store/types';

export function markStepComplete(
  run: AgentRun,
  stepId: string,
  summary: string
): AgentRun {
  let updatedRun = setStepStatus(run, stepId, 'completed', summary);
  updatedRun = appendStepSummary(updatedRun, stepId, summary);
  return updatedRun;
}

export function attachFileArtifact(
  run: AgentRun,
  stepId: string,
  filePath: string,
  title?: string
): AgentRun {
  return attachArtifactToRun(run, {
    stepId,
    path: filePath,
    kind: 'file',
    title: title || filePath,
    preview: `文件已修改: ${filePath}`
  });
}
```

### 示例 3：扩展现有功能

```typescript
import {
  attachArtifactToRun,
  addReasoningEntry
} from '@/features/agent/store/utils';
import { useAgentStore } from '@/stores';

// 扩展 store 的功能
useAgentStore.getState().updateRun(conversationId, (run) => {
  // 使用工具函数操作 run
  let updatedRun = attachArtifactToRun(run, {
    path: '/src/config.ts',
    kind: 'file',
    preview: '配置文件已更新'
  });

  updatedRun = addReasoningEntry(updatedRun, 'execution', '配置已同步');

  return updatedRun;
});
```

## 🚀 迁移路径

### 步骤 1：在现有代码中试用新工具函数

选择一个小功能，尝试使用新的工具函数：

```typescript
// 在现有组件中
import { attachArtifactToRun } from '@/features/agent/store/utils';

// 替换原有的逻辑
const newRun = attachArtifactToRun(currentRun, {
  path: artifactPath,
  kind: 'file'
});
```

### 步骤 2：验证功能正常

确保编译通过，功能正常工作。

### 步骤 3：逐步推广

在更多地方使用新的工具函数和类型定义。

### 步骤 4：准备组件迁移

当团队熟悉新的结构后，可以开始组件迁移。

## ⚠️ 注意事项

1. **保持向后兼容**
   - 原有的导入路径仍然可用
   - 可以新旧代码混用

2. **渐进式采用**
   - 不要一次性迁移所有代码
   - 每次只迁移一个小功能

3. **测试优先**
   - 每次更改后都要测试
   - 确保功能正常

## 📞 支持

如果遇到问题，请参考：
- `PROGRESSIVE_MIGRATION.md` - 渐进式迁移指南
- `REFACTOR_SUMMARY.md` - 重构总结
- 原有的代码和文档

---

**记住**：新的结构是可选的增强，不是强制要求。按照自己的节奏逐步采用即可。
