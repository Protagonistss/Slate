# Slate Native (Tauri Rust Backend)

这里是 Slate 的原生后端实现，基于 **Tauri 2** 构建。它负责处理系统级操作、工作区文件访问、以及 AI Agent 与本地工具之间的桥接。

## 🛠️ 环境初始化

在开始开发之前，请确保您的机器已安装以下基础环境：

### 1. Rust 编译环境
- **安装 Rust**: 访问 [rustup.rs](https://rustup.rs/) 安装最新稳定版。
- **验证**: 运行 `rustc --version` 确保安装成功。

### 2. 系统级依赖 (平台相关)
- **Windows**: 
  - 必须安装 [Microsoft Visual Studio C++ 生成工具](https://visualstudio.microsoft.com/visual-cpp-build-tools/)。
  - 确保已安装 WebView2 (Windows 10/11 通常自带)。
- **macOS**: 
  - 安装 Xcode 命令行工具: `xcode-select --install`。
- **Linux**: 
  - 需要安装 `libwebkit2gtk-4.1` 等开发库。具体参考 [Tauri Linux 依赖指南](https://v2.tauri.app/start/install/linux/)。

### 3. Tauri CLI
建议全局安装 Tauri CLI 以便于调试：
```bash
cargo install tauri-cli --version "^2.0.0"
```

## 🏗️ 架构组织

Rust 代码按照功能模块进行组织，确保核心逻辑的解耦：

- **src/main.rs & src/lib.rs**: 应用入口，负责 Tauri 插件注册、窗口管理及命令映射。
- **src/commands/**: 暴露给前端调用的 Tauri Commands 实现。
- **src/mcp/**: Model Context Protocol (MCP) 的原生实现。
- **src/config/**: 本地配置持久化及工作区状态管理。
- **src/utils/**: 跨平台的路径处理、日志记录及错误处理工具。

## ⚙️ 核心配置

- **tauri.conf.json**: Tauri 主配置文件（包括窗口样式、构建策略及捆绑信息）。
- **capabilities/**: Tauri 权限系统配置，定义了前端可访问的原生能力集。
- **Cargo.toml**: Rust 依赖管理。

## 🚀 常用开发命令

建议在项目根目录下执行：
```bash
# 首次运行会下载所有 Rust 依赖
npm run tauri:dev

# 清理 Rust 编译缓存
cd native && cargo clean
```

## 📦 构建产物
构建结果将根据平台生成在 `target/release/bundle` 目录下。
```bash
npm run tauri:build
```
