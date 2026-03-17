# Editor 样式系统指南

## 概述

本项目采用 **Tailwind CSS v4** 作为主要样式方案，配合 CSS 变量实现主题定制。

## 设计系统颜色

### 主色调
```css
--color-obsidian: #0A0A0A    /* 主背景 */
--color-charcoal: #121212    /* 次要背景 */
--color-graphite: #262626    /* 边框颜色 */
--color-fog-blue: #5E7BA3    /* 强调色 */
--color-dusty-purple: #7C6F91 /* 辅助色 */
--color-warm-gray: #4A4A4A   /* 中性色 */
```

### 语义化类名

已提供语义化的 Tailwind 类名：

```tsx
// 背景色
<div className="bg-obsidian"> {/* #0A0A0A */}
<div className="bg-charcoal"> {/* #121212 */}
<div className="bg-graphite">  {/* #262626 */}

// 边框色
<div className="border-graphite"> {/* #262626 */}

// 文本色
<div className="text-zinc-100"> {/* 亮色文本 */}
<div className="text-zinc-400"> {/* 次要文本 */}
<div className="text-zinc-600"> {/* 辅助文本 */}
```

## 通用工具类

### 玻璃态效果
```tsx
<div className="slate-glass">
  {/* 半透明背景 + 模糊效果 */}
</div>
```

### 面板容器
```tsx
<div className="slate-panel">
  {/* 标准面板样式 */}
</div>
```

### 滚动条
```tsx
<div className="scrollbar-thin">
  {/* 细滚动条样式 */}
</div>
```

### AI 脉冲动画
```tsx
<div className="ai-pulse">
  {/* 脉冲动画效果 */}
</div>
```

## 类名合并工具

使用 `cn()` 函数合并类名：

```tsx
import { cn } from "@/lib/utils";

// 条件类名
<div className={cn(
  "base-class",
  isActive && "active-class",
  "another-class"
)} />

// 动态类名
<div className={cn(
  "text-zinc-100",
  variant === "primary" && "text-blue-400",
  className
)} />
```

## 组件样式规范

### 新组件开发

1. **优先使用 Tailwind 类名**
```tsx
// ✅ 推荐
function MyComponent() {
  return (
    <div className="bg-charcoal border border-graphite rounded-lg p-4">
      <h2 className="text-sm font-medium text-zinc-100">Title</h2>
    </div>
  );
}

// ❌ 避免（除非必要）
import styles from './MyComponent.css';
function MyComponent() {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Title</h2>
    </div>
  );
}
```

2. **使用语义化的颜色类名**
```tsx
// 使用设计系统颜色
<div className="bg-charcoal border border-graphite">
<div className="text-zinc-100 hover:text-zinc-200">
```

3. **响应式设计**
```tsx
<div className="text-sm md:text-base lg:text-lg">
<div className="w-full md:w-1/2 lg:w-1/3">
```

### 迁移现有 CSS 模块

对于现有的 CSS 模块文件，逐步迁移到 Tailwind：

**Before:**
```css
/* Button.css */
.button {
  padding: 8px 16px;
  border-radius: 6px;
  background: #262626;
  color: #e5e7eb;
}
```

**After:**
```tsx
// Button.tsx
<button className="px-4 py-2 rounded-md bg-graphite text-zinc-100">
```

## 自定义动画

使用 Tailwind 的动画系统：

```tsx
// 在 theme.css 中定义
@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

// 在组件中使用
<div className="animate-[slideIn_0.3s_ease-out]">
```

## 暗色模式支持

项目默认使用暗色主题，颜色变量已配置：

```tsx
<div className="dark:bg-obsidian dark:text-zinc-100">
```

## 最佳实践

1. **使用 Tailwind 的任意值语法**
```tsx
<div className="w-[320px] h-[180px]">
<div className="bg-[#262626]">
```

2. **使用 group 和 peer 修饰符**
```tsx
<div className="group">
  <div className="opacity-0 group-hover:opacity-100">
    Hover me
  </div>
</div>
```

3. **使用状态变体**
```tsx
<button className="bg-graphite hover:bg-warm-gray active:bg-obsidian disabled:opacity-50">
  Button
</button>
```

4. **组合工具类**
```tsx
<div className="flex items-center justify-between gap-4 px-4 py-2">
```

## 迁移检查清单

- [ ] 将 CSS 模块迁移到 Tailwind 类名
- [ ] 使用 `cn()` 函数合并动态类名
- [ ] 使用语义化颜色类名
- [ ] 移除未使用的 CSS 文件
- [ ] 确保所有组件使用一致的设计系统

## 注意事项

1. **性能**：Tailwind v4 使用新的编译器，性能更好
2. **维护性**：使用 Tailwind 使样式更易维护
3. **一致性**：统一的设计系统确保视觉一致性
4. **灵活性**：Tailwind 的任意值语法提供最大灵活性
