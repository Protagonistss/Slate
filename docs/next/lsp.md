# XDSL Language Server Java 落地设计

## 1. 背景

Slate 需要为 `xview`、`xmeta`、`xbiz` 提供可用的 DSL 编辑体验，包括：

- 诊断错误
- 标签、属性、属性值补全
- 悬浮说明
- 跳转到定义
- 文档结构大纲

已知约束如下：

- 不修改 `nop-entropy` 源码
- 允许依赖 `nop-entropy` 的类库
- Slate 只负责编辑器和 LSP 接入，不负责 DSL 语义实现
- 后续可能继续扩展更多 XDSL，但首期只覆盖 `xview`、`xmeta`、`xbiz`

因此，推荐方案是：

- 使用 **Java 17** 实现独立进程 `xdsl-ls`
- 通过 **LSP over stdio** 与 Slate 通信
- 在 `xdsl-ls` 内复用 `nop-xlang`、`nop-core`、`nop-xdefs` 的 XML/XDef/XDSL 解析能力
- 通过一层桥接代码隔离上游 API，避免 LSP 业务逻辑直接散落依赖 `nop-entropy`

## 2. 目标与非目标

### 2.1 V1 目标

- 支持 `xview`、`xmeta`、`xbiz`
- 支持 `textDocument/publishDiagnostics`
- 支持 `textDocument/completion`
- 支持 `textDocument/hover`
- 支持 `textDocument/definition`
- 支持 `textDocument/documentSymbol`
- 支持未保存文档的增量编辑分析

### 2.2 非目标

以下能力不进入 V1：

- `references`
- `rename`
- `code action`
- `formatting`
- 完整复刻 `nop-entropy` 运行时语义
- 完整执行 `xpl` / `xdef:post-parse` / Bean 反射逻辑
- 做成通用 XML IDE 平台

V1 的目标不是“百分之百还原运行时”，而是“先提供高可用的结构化智能编辑体验”。

## 3. 技术选型结论

### 3.1 为什么选 Java

Java 是当前最合适的实现语言，原因如下：

- `nop-entropy` 本身就是 Java 生态，语义资产在 Java 类库中
- `nop-xlang`、`nop-core`、`nop-xdefs` 已经提供了可复用的解析与 schema 能力
- Java 的 XML、LSP4J、测试、调试、打包链条成熟
- 相比 Rust，从零补 AST、位置映射、容错解析、XDef 解释器的成本更低
- 相比 Python，长期维护、分发、性能和类型约束更稳

### 3.2 协议结论

协议固定为标准 LSP：

- 进程模型：`stdio`
- 服务端：`xdsl-ls`
- 客户端：Slate 原生层托管 Java 子进程，前端 Monaco 只消费 LSP 能力

## 4. 总体架构

```text
Monaco Editor
    ↓
Slate Frontend
    ↓
Rust LspManager
    ↓ stdio / JSON-RPC
xdsl-ls (Java)
    ↓
xdsl-ls-core
    ↓
xdsl-ls-nop-bridge
    ↓
nop-xlang / nop-core / nop-xdefs
```

职责边界：

- Slate Frontend
  - 打开文件
  - 同步文本变更
  - 展示 diagnostics、completion、hover、definition、outline
- Rust LspManager
  - 管理 Java 语言服务进程生命周期
  - 转发 LSP request/notification
  - 处理异常退出、重启、日志
- `xdsl-ls-core`
  - 文档缓存
  - URI 与工作区路径映射
  - 增量分析调度
  - workspace 索引
  - LSP 能力编排
- `xdsl-ls-nop-bridge`
  - 封装所有对 `nop-entropy` 类库的调用
  - 统一把 `SourceLocation`、XDef、XNode 等转换成服务端内部模型
- `nop-*`
  - 提供 XML/XDef/XDSL 解析和 schema 能力

## 5. 工程拆分

建议独立建一个外部工程 `xdsl-ls`，拆成四个模块。

### 5.1 `xdsl-ls-core`

负责：

- 文档生命周期管理
- 文本版本管理
- workspace 文件扫描与索引
- LSP 能力编排
- DSL 类型识别
- `Range/Position` 映射

不直接依赖 `nop-entropy` 具体类。

### 5.2 `xdsl-ls-nop-bridge`

负责：

- 对接 `nop-xlang`、`nop-core`、`nop-xdefs`
- 统一装配 `XNodeParser`、`XDefinitionLoader` 等
- 将 `nop` 模型转为 `xdsl-ls` 内部 DTO
- 处理 `_vfs` schema 资源加载

这是唯一允许直接引用 `nop-entropy` API 的模块。

### 5.3 `xdsl-ls-server`

负责：

- 基于 LSP4J 暴露标准 LSP
- 初始化 capability
- 接收文档事件
- 返回 diagnostics、completion、hover、definition、document symbols

### 5.4 `xdsl-ls-cli`

负责：

- `main` 入口
- 启动参数解析
- `stdio` 模式启动
- 日志配置
- 开发模式与生产模式切换

## 6. 依赖与复用点

### 6.1 Maven 依赖

核心依赖建议如下：

- `org.eclipse.lsp4j:lsp4j`
- `io.github.entropy-cloud:nop-xlang`
- `io.github.entropy-cloud:nop-core`
- `io.github.entropy-cloud:nop-xdefs`
- `org.slf4j:slf4j-api`
- `ch.qos.logback:logback-classic`

实际引入时优先以 `nop-xlang` 为主，由其传递依赖带入 `nop-core`、`nop-xdefs`；如果某些资源或类型解析不完整，再显式补依赖。

### 6.2 关键复用类

设计上优先复用这些能力：

- `io.nop.core.lang.xml.parse.XNodeParser`
- `io.nop.xlang.xdef.parse.XDefinitionLoader`
- `io.nop.api.core.util.SourceLocation`
- `_vfs/nop/schema/**` 下的 `.xdef` schema

已确认 V1 重点 schema 路径包括：

- `nop-kernel/nop-xdefs/src/main/resources/_vfs/nop/schema/xui/xview.xdef`
- `nop-kernel/nop-xdefs/src/main/resources/_vfs/nop/schema/xmeta.xdef`
- `nop-kernel/nop-xdefs/src/main/resources/_vfs/nop/schema/biz/xbiz.xdef`

### 6.3 设计约束

禁止在 `completion`、`hover`、`definition` 等业务代码里直接散落调用 `nop-*` API。

所有上游调用必须经过 `NopFacade`：

- 便于后续版本升级
- 便于做 mock 测试
- 便于隔离上游 API 改动

## 7. 核心数据模型

### 7.1 文档模型

```java
record WorkspaceDocument(
    URI uri,
    Path path,
    String text,
    int version,
    DslKind dslKind
) {}
```

### 7.2 解析结果

```java
record ParsedDocument(
    WorkspaceDocument document,
    XmlDocumentSnapshot xml,
    ResolvedSchema schema,
    List<ResolvedSymbol> symbols,
    List<DiagnosticItem> diagnostics
) {}
```

### 7.3 DSL 类型

```java
enum DslKind {
    XVIEW,
    XMETA,
    XBIZ,
    UNKNOWN
}
```

DSL 类型识别规则：

- 优先根据根节点 `x:schema`
- 其次根据典型根标签
- 最后根据文件路径或后缀兜底

### 7.4 光标上下文

```java
record CursorContext(
    Position position,
    XmlNodeRef currentNode,
    XmlAttributeRef currentAttribute,
    CompletionSite site
) {}
```

`CompletionSite` 至少区分：

- 标签名位置
- 属性名位置
- 属性值位置
- 文本节点位置

### 7.5 符号解析

```java
record ResolvedSymbol(
    String name,
    SymbolKind kind,
    Range range,
    URI definitionUri,
    Range definitionRange
) {}
```

## 8. 桥接层设计

`xdsl-ls-nop-bridge` 中固定建立一组桥接接口。

### 8.1 `NopFacade`

```java
public interface NopFacade {
    ParsedXml parseXml(WorkspaceDocument document);
    ResolvedSchema resolveSchema(ParsedXml xml);
    List<DiagnosticItem> collectDiagnostics(WorkspaceDocument document, ParsedXml xml, ResolvedSchema schema);
    Optional<HoverInfo> getHover(WorkspaceDocument document, Position position);
    Optional<DefinitionTarget> getDefinition(WorkspaceDocument document, Position position);
    CompletionContext getCompletionContext(WorkspaceDocument document, Position position);
}
```

### 8.2 `NopFacade` 实现职责

- 使用 `XNodeParser` 解析文本
- 使用 `XDefinitionLoader` 装载 schema
- 从 `SourceLocation` 转换为 LSP `Range`
- 解析 `xdef:ref`
- 读取节点、属性、注释说明
- 为上层提供统一 DTO，而不是暴露原始 `nop` 类型

### 8.3 资源解析策略

需要实现一个 `WorkspaceOverlayResourceResolver`，职责如下：

- 当前文档未保存时，优先读内存版本
- 当前 workspace 文件优先于磁盘旧版本
- schema 仍从 `nop` classpath `_vfs` 中读取
- 支持从业务路径映射到 `_vfs` 或 DSL 约定路径

这层是 V1 的关键，因为 Language Server 必须基于未保存内容工作。

## 9. 解析与索引方案

### 9.1 文档解析流程

每次 `didOpen/didChange` 后执行以下流程：

1. 根据 URI 获取最新文本
2. 识别 `DslKind`
3. 调用 `NopFacade.parseXml`
4. 调用 `NopFacade.resolveSchema`
5. 收集 diagnostics
6. 抽取 symbols
7. 更新 workspace 索引

### 9.2 workspace 索引

V1 只做必要索引，不做完整全局编译。

索引内容包括：

- `xmeta` 中实体和字段定义
- `xview` 中页面、grid、form、crud 等结构性节点
- `xbiz` 中 `biz`、`query`、`mutation`、`action`
- 跨文件引用目标

建议建立以下索引表：

- `Map<String, SymbolRef>` by qualified name
- `Map<Path, ParsedDocument>` by file
- `Map<DslKind, List<SymbolRef>>` by DSL type

### 9.3 容错策略

不能把所有能力都绑定在“完整解析成功”上。

规则如下：

- diagnostics 可以报告 XML 语法错误
- completion 尽量基于当前位置和最近父节点工作
- hover/definition 在无法可靠解析时返回空结果，而不是抛异常
- document symbols 在解析失败时降级到浅层结构

## 10. LSP 能力设计

### 10.1 Diagnostics

来源分三类：

- XML 语法错误
- schema 结构错误
- 基础引用错误

V1 诊断内容包括：

- 未知标签
- 未知属性
- 缺失必填属性
- 枚举值非法
- `xdef:ref` 无法解析
- 常见引用如 `objMeta` 无法解析

诊断级别：

- 结构错误：`Error`
- 可疑但不致命：`Warning`
- 能力未覆盖：不报错，最多记录 debug 日志

### 10.2 Completion

分三层：

- 标签补全
- 属性名补全
- 属性值补全

补全来源：

- 当前 schema 对应元素定义
- `xdef:ref` 指向的子定义
- DSL 特定引用候选

DSL 特定行为：

- `xview`
  - 补全 `grid`、`form`、`crud` 等标签
  - 补全 `objMeta` 等模型引用
- `xmeta`
  - 补全实体、字段、类型、schema 相关属性
- `xbiz`
  - 补全 `query`、`mutation`、`action`、`arg`、`return`

### 10.3 Hover

Hover 信息按优先级返回：

1. DSL 适配器补充说明
2. xdef 注释
3. 元素/属性签名
4. 引用目标摘要

建议输出结构：

- 元素或属性名称
- 类型
- 是否必填
- 简短说明
- 引用来源

### 10.4 Definition

V1 至少支持：

- `x:schema` 跳到对应 `.xdef`
- `xdef:ref` 跳到引用定义
- `objMeta` 跳到对应 `.xmeta`
- `xbiz` 常见模型引用跳到对应定义

Definition 的判断必须基于当前位置语义，而不是简单字符串匹配。

### 10.5 Document Symbols

按 DSL 生成结构化大纲：

- `xview`
  - page / crud / form / grid
- `xmeta`
  - meta / field / key / selection / define
- `xbiz`
  - biz / query / mutation / action / loader / interceptor

## 11. DSL 适配器设计

建议在 `xdsl-ls-core` 中抽象一个 DSL 适配器接口。

```java
public interface DslAdapter {
    boolean supports(WorkspaceDocument document, ParsedXml xml);
    List<DocumentSymbol> buildSymbols(ParsedDocument document);
    List<CompletionItem> complete(ParsedDocument document, CursorContext context);
    Optional<HoverInfo> hover(ParsedDocument document, CursorContext context);
    Optional<DefinitionTarget> define(ParsedDocument document, CursorContext context);
}
```

三个实现：

- `XViewAdapter`
- `XMetaAdapter`
- `XBizAdapter`

职责边界：

- 通用 XML/XDef 规则由 `NopFacade` 和 schema 层提供
- DSL 适配器只补充业务语义和跨文件引用规则

## 12. Slate 接入方案

### 12.1 Rust 侧

新增 `LspManager`，职责如下：

- 启动 Java 进程
- 管理 stdin/stdout
- 维护 request id
- 处理退出、超时、重启
- 将事件桥接给前端

建议对前端暴露最小命令面：

- `start_lsp(workspaceRoot)`
- `stop_lsp()`
- `lsp_did_open(uri, text, version)`
- `lsp_did_change(uri, changes, version)`
- `lsp_did_close(uri)`
- `lsp_request(method, params)`

### 12.2 Frontend 侧

Monaco 侧注册：

- diagnostics sink
- completion provider
- hover provider
- definition provider
- document symbols provider

前端只处理展示，不解析 DSL。

### 12.3 文件类型识别

建议规则：

- 当前文件是 XML
- 文件中存在 `x:schema`
- `x:schema` 命中 `xview`、`xmeta`、`xbiz`

满足后将该模型交给 `xdsl-ls`。

## 13. 打包与分发

建议两种模式：

- 开发模式
  - 直接使用本地 JDK 运行
  - `java -jar xdsl-ls-cli.jar`
- 产品模式
  - 打 fat jar
  - 随 Slate 一起分发或单独下载

建议把 `xdsl-ls` 输出为单独产物，而不是塞进 Slate 主仓库构建链。

## 14. 性能与缓存

V1 缓存策略：

- 文档缓存：按 URI + version
- AST 缓存：按最新文本
- schema 缓存：按 `x:schema`
- workspace 索引缓存：按文件 path

增量策略：

- `didChange` 后只重算当前文档
- 如涉及跨文件引用，再局部更新索引
- 不做全 workspace 全量重编译

性能底线：

- 常规补全与 hover 维持交互级响应
- workspace 初次索引允许稍慢，但不能阻塞当前文档基础能力

## 15. 风险与控制

### 15.1 上游 API 变动

风险：

- `nop-entropy` 升级后接口或行为变化

控制：

- 所有上游调用收敛到 `xdsl-ls-nop-bridge`
- 为 `NopFacade` 建立专门回归测试

### 15.2 未保存文档与资源解析

风险：

- `nop` 默认资源加载更偏向磁盘和 classpath，未保存文档容易失真

控制：

- 自定义 `WorkspaceOverlayResourceResolver`
- 所有分析都优先以内存文本为准

### 15.3 运行时语义过重

风险：

- 如果一开始追求完整语义，会拖慢交付

控制：

- V1 只做结构化智能
- 把复杂运行时语义放到 Phase 2

## 16. 测试计划

### 16.1 单元测试

- `DslKind` 识别
- `SourceLocation -> Range` 转换
- `CursorContext` 判断
- `xdef:ref` 解析

### 16.2 Fixture 测试

使用真实 `xview`、`xmeta`、`xbiz` 文件样例验证：

- diagnostics
- completion
- hover
- definition
- document symbols

### 16.3 LSP 集成测试

直接驱动 `xdsl-ls` 进程，发送标准 LSP 请求，验证返回结果。

### 16.4 Slate 联调测试

在 Slate 中验证：

- 打开 XML 文件有错误高亮
- 输入标签和属性时有补全
- 悬浮有说明
- 跳转到定义可用
- outline 可展示结构

## 17. 分期实施建议

### Phase 1

- 搭建 `xdsl-ls` 工程骨架
- 接入 `nop-xlang` / `nop-xdefs`
- 打通 XML 解析、schema 装载、基础 diagnostics
- 实现 `completion`、`hover`、`definition`、`document symbols`
- 接入 Slate

### Phase 2

- 补 `references`
- 补 `rename`
- 补 `code action`
- 评估 `formatting`
- 逐步增强 `x:extends`、`x:override` 等复杂语义支持

## 18. 最终结论

该方案的核心原则是：

- **服务端用 Java 做**
- **协议用标准 LSP**
- **语义尽量复用 `nop-entropy` 现有能力**
- **所有上游依赖收口到桥接层**
- **Slate 只做接入，不做 DSL 解析**

这能在不修改 `nop-entropy` 的前提下，以最低风险尽快把 `xview`、`xmeta`、`xbiz` 的编辑智能跑起来。
