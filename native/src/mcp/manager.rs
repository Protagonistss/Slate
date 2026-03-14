use super::types::*;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{hash_map::DefaultHasher, HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio::time::timeout;

const MCP_PROTOCOL_VERSION: &str = "2025-06-18";
const MCP_CLIENT_NAME: &str = "Slate";
const REQUEST_TIMEOUT_SECS: u64 = 30;
const CHANNEL_BUFFER: usize = 64;

#[derive(Clone)]
pub struct McpManager {
    inner: Arc<McpManagerInner>,
}

struct McpManagerInner {
    app: AppHandle,
    state: Mutex<McpState>,
}

#[derive(Default)]
struct McpState {
    sessions: HashMap<String, ServerSession>,
    order: Vec<String>,
}

struct ServerSession {
    config: ResolvedMcpServerConfig,
    runtime: Option<SessionRuntime>,
    pending: HashMap<u64, oneshot::Sender<Result<Value, String>>>,
    next_request_id: u64,
    tools: Vec<McpToolDescriptor>,
    capabilities: McpCapabilitySummary,
    status: McpServerStatusKind,
    error: Option<String>,
    unsupported_reason: Option<String>,
    requires_approval: bool,
    last_stderr: Option<String>,
}

struct SessionRuntime {
    stdin_tx: mpsc::Sender<String>,
    _child: Child,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InitializeResult {
    #[serde(default)]
    capabilities: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolsListResult {
    #[serde(default)]
    tools: Vec<RawMcpTool>,
    #[serde(default)]
    next_cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawMcpTool {
    name: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default = "default_input_schema")]
    input_schema: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CallToolResult {
    #[serde(default)]
    content: Vec<Value>,
    #[serde(default)]
    structured_content: Option<Value>,
    #[serde(default)]
    is_error: bool,
}

fn default_input_schema() -> Value {
    json!({
        "type": "object",
        "properties": {}
    })
}

impl ServerSession {
    fn new(config: ResolvedMcpServerConfig) -> Self {
        let mut session = Self {
            config,
            runtime: None,
            pending: HashMap::new(),
            next_request_id: 0,
            tools: Vec::new(),
            capabilities: McpCapabilitySummary::default(),
            status: McpServerStatusKind::Disconnected,
            error: None,
            unsupported_reason: None,
            requires_approval: false,
            last_stderr: None,
        };
        set_inactive_state(&mut session);
        session
    }
}

impl McpManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            inner: Arc::new(McpManagerInner {
                app,
                state: Mutex::new(McpState::default()),
            }),
        }
    }

    pub async fn apply_servers(
        &self,
        servers: Vec<ResolvedMcpServerConfig>,
    ) -> Result<(), String> {
        let mut connect_ids = Vec::new();
        let new_order = servers
            .iter()
            .map(|server| server.server.id.clone())
            .collect::<Vec<_>>();
        let next_ids = new_order.iter().cloned().collect::<HashSet<_>>();

        {
            let mut state = self.inner.state.lock().await;

            let removed_ids = state
                .order
                .iter()
                .filter(|id| !next_ids.contains(*id))
                .cloned()
                .collect::<Vec<_>>();

            for id in removed_ids {
                if let Some(session) = state.sessions.get_mut(&id) {
                    shutdown_session(session, "MCP server 已移除");
                }
                state.sessions.remove(&id);
            }

            state.order = new_order;

            for resolved in servers {
                let id = resolved.server.id.clone();
                match state.sessions.get_mut(&id) {
                    Some(existing) => {
                        if existing.config != resolved {
                            shutdown_session(existing, "MCP server 配置已变更");
                            existing.config = resolved;
                            existing.next_request_id = 0;
                            existing.last_stderr = None;
                            existing.capabilities = McpCapabilitySummary::default();
                            existing.tools.clear();
                            existing.error = None;
                            set_inactive_state(existing);
                            if can_connect(existing) {
                                connect_ids.push(id.clone());
                            }
                        } else {
                            refresh_static_flags(existing);
                            if !can_connect(existing) {
                                shutdown_session(existing, "MCP server 当前不可连接");
                                set_inactive_state(existing);
                            } else if existing.runtime.is_none() {
                                existing.status = McpServerStatusKind::Disconnected;
                                existing.error = None;
                                connect_ids.push(id.clone());
                            }
                        }
                    }
                    None => {
                        let session = ServerSession::new(resolved);
                        if can_connect(&session) {
                            connect_ids.push(id.clone());
                        }
                        state.sessions.insert(id, session);
                    }
                }
            }
        }

        self.emit_state().await;

        for id in connect_ids {
            if let Err(error) = self.connect_session(&id).await {
                self.mark_session_error(&id, error).await;
            }
        }

        Ok(())
    }

    pub async fn snapshot_servers(&self) -> Vec<McpServerStatus> {
        let state = self.inner.state.lock().await;
        build_server_snapshots(&state)
    }

    pub async fn snapshot_tools(&self) -> Vec<McpToolDescriptor> {
        let state = self.inner.state.lock().await;
        build_tool_snapshots(&state)
    }

    pub async fn build_mutation_response(
        &self,
        target_server_id: &str,
    ) -> McpServerMutationResponse {
        let state = self.inner.state.lock().await;
        let servers = build_server_snapshots(&state);
        let target_server = servers
            .iter()
            .find(|server| server.id == target_server_id)
            .cloned();
        McpServerMutationResponse {
            servers,
            target_server,
        }
    }

    pub async fn call_tool(
        &self,
        server_id: &str,
        tool_name: &str,
        arguments: Value,
    ) -> Result<McpCallToolResult, String> {
        let value = self
            .send_request_value(
                server_id,
                "tools/call",
                Some(json!({
                    "name": tool_name,
                    "arguments": arguments,
                })),
            )
            .await?;

        let result: CallToolResult = serde_json::from_value(value)
            .map_err(|error| format!("解析 MCP tools/call 返回失败: {}", error))?;

        Ok(McpCallToolResult {
            content: result.content,
            structured_content: result.structured_content,
            is_error: result.is_error,
        })
    }

    async fn connect_session(&self, server_id: &str) -> Result<(), String> {
        let config = {
            let mut state = self.inner.state.lock().await;
            let session = state
                .sessions
                .get_mut(server_id)
                .ok_or_else(|| format!("未找到 MCP server: {}", server_id))?;

            if !can_connect(session) {
                return Err(format!("MCP server 当前不可连接: {}", server_id));
            }

            if session.runtime.is_some() {
                return Ok(());
            }

            session.status = McpServerStatusKind::Connecting;
            session.error = None;
            session.tools.clear();
            session.capabilities = McpCapabilitySummary::default();
            session.last_stderr = None;

            session.config.clone()
        };

        self.emit_state().await;

        let (runtime, stdout, stderr) = self.spawn_runtime(&config).await?;
        let server_id_owned = server_id.to_string();

        {
            let mut state = self.inner.state.lock().await;
            let session = state
                .sessions
                .get_mut(&server_id_owned)
                .ok_or_else(|| format!("未找到 MCP server: {}", server_id_owned))?;
            session.runtime = Some(runtime);
            session.status = McpServerStatusKind::Connecting;
            session.error = None;
        }

        self.spawn_stdout_task(server_id_owned.clone(), stdout);
        self.spawn_stderr_task(server_id_owned.clone(), stderr);

        let init_value = self
            .send_request_value(
                &server_id_owned,
                "initialize",
                Some(json!({
                    "protocolVersion": MCP_PROTOCOL_VERSION,
                    "capabilities": {},
                    "clientInfo": {
                        "name": MCP_CLIENT_NAME,
                        "version": env!("CARGO_PKG_VERSION"),
                    }
                })),
            )
            .await?;

        let init_result: InitializeResult = serde_json::from_value(init_value)
            .map_err(|error| format!("解析 MCP initialize 返回失败: {}", error))?;

        {
            let mut state = self.inner.state.lock().await;
            if let Some(session) = state.sessions.get_mut(&server_id_owned) {
                session.capabilities = summarize_capabilities(&init_result.capabilities);
            }
        }

        self.send_notification(&server_id_owned, "notifications/initialized", None)
            .await?;
        self.refresh_tools(&server_id_owned).await?;

        {
            let mut state = self.inner.state.lock().await;
            if let Some(session) = state.sessions.get_mut(&server_id_owned) {
                session.status = McpServerStatusKind::Connected;
                session.error = None;
            }
        }

        self.emit_state().await;
        Ok(())
    }

    async fn refresh_tools(&self, server_id: &str) -> Result<(), String> {
        let (server_name, registration_prefix) = {
            let state = self.inner.state.lock().await;
            let session = state
                .sessions
                .get(server_id)
                .ok_or_else(|| format!("未找到 MCP server: {}", server_id))?;
            (
                session.config.server.name.clone(),
                sanitize_for_tool_name(&session.config.server.id),
            )
        };

        let mut tools = Vec::new();
        let mut cursor: Option<String> = None;

        loop {
            let params = cursor
                .as_ref()
                .map(|next| json!({ "cursor": next }))
                .unwrap_or_else(|| json!({}));

            let value = self
                .send_request_value(server_id, "tools/list", Some(params))
                .await?;

            let response: ToolsListResult = serde_json::from_value(value)
                .map_err(|error| format!("解析 MCP tools/list 返回失败: {}", error))?;

            for tool in response.tools {
                tools.push(McpToolDescriptor {
                    server_id: server_id.to_string(),
                    server_name: server_name.clone(),
                    registration_name: format!(
                        "mcp_{}_{}",
                        registration_prefix,
                        sanitize_for_tool_name(&tool.name)
                    ),
                    name: tool.name,
                    description: tool.description,
                    input_schema: tool.input_schema,
                });
            }

            cursor = response.next_cursor;
            if cursor.is_none() {
                break;
            }
        }

        {
            let mut state = self.inner.state.lock().await;
            if let Some(session) = state.sessions.get_mut(server_id) {
                session.tools = tools;
                if session.runtime.is_some() {
                    session.status = McpServerStatusKind::Connected;
                    session.error = None;
                }
            }
        }

        self.emit_tools_updated().await;
        self.emit_servers_updated().await;
        Ok(())
    }

    async fn spawn_runtime(
        &self,
        config: &ResolvedMcpServerConfig,
    ) -> Result<(SessionRuntime, tokio::process::ChildStdout, tokio::process::ChildStderr), String>
    {
        let mut command = match &config.server.transport {
            McpTransportConfig::Stdio { command, args } => {
                let mut cmd = Command::new(command);
                cmd.args(args);
                cmd
            }
            McpTransportConfig::Sse { .. } => {
                return Err("当前仅支持 stdio MCP server".to_string());
            }
        };

        if let Some(cwd) = config.server.cwd.as_deref() {
            command.current_dir(cwd);
        }

        if !config.server.env.is_empty() {
            command.envs(config.server.env.clone());
        }

        command.kill_on_drop(true);
        command.stdin(Stdio::piped());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|error| format!("启动 MCP server 失败: {}", error))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "无法获取 MCP server stdin".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "无法获取 MCP server stdout".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "无法获取 MCP server stderr".to_string())?;

        let (stdin_tx, mut stdin_rx) = mpsc::channel::<String>(CHANNEL_BUFFER);
        let manager = self.clone();
        let server_id = config.server.id.clone();

        tauri::async_runtime::spawn(async move {
            let mut stdin = stdin;
            while let Some(message) = stdin_rx.recv().await {
                if stdin.write_all(message.as_bytes()).await.is_err() {
                    manager
                        .mark_session_disconnected(&server_id, Some("写入 MCP stdin 失败".into()))
                        .await;
                    return;
                }
                if stdin.write_all(b"\n").await.is_err() || stdin.flush().await.is_err() {
                    manager
                        .mark_session_disconnected(&server_id, Some("刷新 MCP stdin 失败".into()))
                        .await;
                    return;
                }
            }
        });

        Ok((SessionRuntime { stdin_tx, _child: child }, stdout, stderr))
    }

    fn spawn_stdout_task(&self, server_id: String, stdout: tokio::process::ChildStdout) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();

            loop {
                match lines.next_line().await {
                    Ok(Some(line)) => {
                        manager.handle_stdout_line(&server_id, line).await;
                    }
                    Ok(None) => {
                        manager.mark_session_disconnected(&server_id, None).await;
                        return;
                    }
                    Err(error) => {
                        manager
                            .mark_session_disconnected(
                                &server_id,
                                Some(format!("读取 MCP stdout 失败: {}", error)),
                            )
                            .await;
                        return;
                    }
                }
            }
        });
    }

    fn spawn_stderr_task(&self, server_id: String, stderr: tokio::process::ChildStderr) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            loop {
                match lines.next_line().await {
                    Ok(Some(line)) => {
                        if !line.trim().is_empty() {
                            manager.set_last_stderr(&server_id, line).await;
                        }
                    }
                    Ok(None) => return,
                    Err(error) => {
                        manager
                            .set_last_stderr(
                                &server_id,
                                format!("读取 MCP stderr 失败: {}", error),
                            )
                            .await;
                        return;
                    }
                }
            }
        });
    }

    async fn handle_stdout_line(&self, server_id: &str, line: String) {
        let message: Value = match serde_json::from_str(&line) {
            Ok(value) => value,
            Err(_) => return,
        };

        if let Some(id) = message.get("id").and_then(|value| value.as_u64()) {
            let result = if let Some(error) = message.get("error") {
                let error_message = error
                    .get("message")
                    .and_then(|value| value.as_str())
                    .unwrap_or("未知 MCP 错误")
                    .to_string();
                Err(error_message)
            } else {
                Ok(message.get("result").cloned().unwrap_or(Value::Null))
            };

            let sender = {
                let mut state = self.inner.state.lock().await;
                state
                    .sessions
                    .get_mut(server_id)
                    .and_then(|session| session.pending.remove(&id))
            };

            if let Some(sender) = sender {
                let _ = sender.send(result);
            }
            return;
        }

        if let Some(method) = message.get("method").and_then(|value| value.as_str()) {
            if method == "notifications/tools/list_changed" {
                if let Err(error) = self.refresh_tools(server_id).await {
                    self.mark_session_error(server_id, error).await;
                }
            }
        }
    }

    async fn send_request_value(
        &self,
        server_id: &str,
        method: &str,
        params: Option<Value>,
    ) -> Result<Value, String> {
        let (request_id, stdin_tx, response_rx) = {
            let mut state = self.inner.state.lock().await;
            let session = state
                .sessions
                .get_mut(server_id)
                .ok_or_else(|| format!("未找到 MCP server: {}", server_id))?;

            let runtime = session
                .runtime
                .as_ref()
                .ok_or_else(|| format!("MCP server 未连接: {}", server_id))?;

            session.next_request_id += 1;
            let request_id = session.next_request_id;
            let (response_tx, response_rx) = oneshot::channel();
            session.pending.insert(request_id, response_tx);

            (request_id, runtime.stdin_tx.clone(), response_rx)
        };

        let mut payload = json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
        });

        if let Some(params) = params {
            payload["params"] = params;
        }

        if stdin_tx.send(payload.to_string()).await.is_err() {
            self.remove_pending(server_id, request_id).await;
            return Err(format!("发送 MCP 请求失败: {}", method));
        }

        match timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS), response_rx).await {
            Ok(Ok(Ok(value))) => Ok(value),
            Ok(Ok(Err(error))) => Err(error),
            Ok(Err(_)) => Err(format!("MCP 请求通道已关闭: {}", method)),
            Err(_) => {
                self.remove_pending(server_id, request_id).await;
                Err(format!("MCP 请求超时: {}", method))
            }
        }
    }

    async fn send_notification(
        &self,
        server_id: &str,
        method: &str,
        params: Option<Value>,
    ) -> Result<(), String> {
        let stdin_tx = {
            let state = self.inner.state.lock().await;
            let session = state
                .sessions
                .get(server_id)
                .ok_or_else(|| format!("未找到 MCP server: {}", server_id))?;
            let runtime = session
                .runtime
                .as_ref()
                .ok_or_else(|| format!("MCP server 未连接: {}", server_id))?;
            runtime.stdin_tx.clone()
        };

        let mut payload = json!({
            "jsonrpc": "2.0",
            "method": method,
        });

        if let Some(params) = params {
            payload["params"] = params;
        }

        stdin_tx
            .send(payload.to_string())
            .await
            .map_err(|_| format!("发送 MCP 通知失败: {}", method))?;

        Ok(())
    }

    async fn remove_pending(&self, server_id: &str, request_id: u64) {
        let mut state = self.inner.state.lock().await;
        if let Some(session) = state.sessions.get_mut(server_id) {
            session.pending.remove(&request_id);
        }
    }

    async fn set_last_stderr(&self, server_id: &str, stderr_line: String) {
        let mut state = self.inner.state.lock().await;
        if let Some(session) = state.sessions.get_mut(server_id) {
            session.last_stderr = Some(stderr_line);
        }
    }

    async fn mark_session_error(&self, server_id: &str, error: String) {
        {
            let mut state = self.inner.state.lock().await;
            if let Some(session) = state.sessions.get_mut(server_id) {
                shutdown_session(session, &error);
                session.status = McpServerStatusKind::Error;
                session.error = Some(error);
            }
        }
        self.emit_state().await;
    }

    async fn mark_session_disconnected(&self, server_id: &str, reason: Option<String>) {
        {
            let mut state = self.inner.state.lock().await;
            if let Some(session) = state.sessions.get_mut(server_id) {
                let fallback = session
                    .last_stderr
                    .clone()
                    .filter(|line| !line.trim().is_empty());
                let message = reason
                    .or(fallback)
                    .unwrap_or_else(|| "MCP server 已断开".to_string());
                shutdown_session(session, &message);
                if can_connect(session) {
                    session.status = McpServerStatusKind::Disconnected;
                    session.error = Some(message);
                } else {
                    set_inactive_state(session);
                }
            }
        }
        self.emit_state().await;
    }

    async fn emit_state(&self) {
        self.emit_servers_updated().await;
        self.emit_tools_updated().await;
    }

    async fn emit_servers_updated(&self) {
        let servers = self.snapshot_servers().await;
        let _ = self.inner.app.emit("mcp://servers-updated", &servers);
    }

    async fn emit_tools_updated(&self) {
        let tools = self.snapshot_tools().await;
        let _ = self.inner.app.emit("mcp://tools-updated", &tools);
    }
}

fn shutdown_session(session: &mut ServerSession, reason: &str) {
    session.runtime.take();
    session.tools.clear();
    session.capabilities = McpCapabilitySummary::default();
    for (_, sender) in session.pending.drain() {
        let _ = sender.send(Err(reason.to_string()));
    }
}

fn refresh_static_flags(session: &mut ServerSession) {
    session.unsupported_reason = unsupported_reason(&session.config.server);
    session.requires_approval = session.config.server.enabled
        && session.unsupported_reason.is_none()
        && !is_server_approved(&session.config.server);
}

fn set_inactive_state(session: &mut ServerSession) {
    refresh_static_flags(session);
    session.tools.clear();
    session.capabilities = McpCapabilitySummary::default();

    session.status = if !session.config.server.enabled {
        McpServerStatusKind::Disabled
    } else if session.unsupported_reason.is_some() {
        McpServerStatusKind::Unsupported
    } else if session.requires_approval {
        McpServerStatusKind::ApprovalRequired
    } else {
        McpServerStatusKind::Disconnected
    };
}

fn can_connect(session: &ServerSession) -> bool {
    session.config.server.enabled
        && session.unsupported_reason.is_none()
        && !session.requires_approval
}

fn build_server_snapshots(state: &McpState) -> Vec<McpServerStatus> {
    state
        .order
        .iter()
        .filter_map(|id| state.sessions.get(id))
        .map(|session| {
            let (transport_type, transport_summary) = transport_summary(&session.config.server);
            McpServerStatus {
                id: session.config.server.id.clone(),
                name: session.config.server.name.clone(),
                enabled: session.config.server.enabled,
                scope: session.config.scope,
                config: session.config.server.clone(),
                status: session.status,
                transport_type,
                transport_summary,
                tool_count: session.tools.len(),
                requires_approval: session.requires_approval,
                unsupported_reason: session.unsupported_reason.clone(),
                error: session.error.clone(),
                capabilities: session.capabilities.clone(),
            }
        })
        .collect()
}

fn build_tool_snapshots(state: &McpState) -> Vec<McpToolDescriptor> {
    state
        .order
        .iter()
        .filter_map(|id| state.sessions.get(id))
        .filter(|session| session.status == McpServerStatusKind::Connected)
        .flat_map(|session| session.tools.clone())
        .collect()
}

fn transport_summary(server: &McpServerConfig) -> (String, String) {
    match &server.transport {
        McpTransportConfig::Stdio { command, args } => {
            let summary = if args.is_empty() {
                command.clone()
            } else {
                format!("{} {}", command, args.join(" "))
            };
            ("stdio".to_string(), summary)
        }
        McpTransportConfig::Sse { url } => ("sse".to_string(), url.clone()),
    }
}

fn unsupported_reason(server: &McpServerConfig) -> Option<String> {
    match &server.transport {
        McpTransportConfig::Stdio { .. } => None,
        McpTransportConfig::Sse { .. } => Some("当前版本暂不支持 SSE MCP server".to_string()),
    }
}

fn summarize_capabilities(capabilities: &Value) -> McpCapabilitySummary {
    let object = capabilities.as_object();
    McpCapabilitySummary {
        tools: object.and_then(|map| map.get("tools")).is_some(),
        resources: object.and_then(|map| map.get("resources")).is_some(),
        prompts: object.and_then(|map| map.get("prompts")).is_some(),
    }
}

pub fn validate_mcp_server(server: &McpServerConfig) -> Result<(), String> {
    if server.id.trim().is_empty() {
        return Err("MCP server id 不能为空".to_string());
    }

    if server.name.trim().is_empty() {
        return Err("MCP server 名称不能为空".to_string());
    }

    match &server.transport {
        McpTransportConfig::Stdio { command, .. } => {
            if command.trim().is_empty() {
                return Err("stdio command 不能为空".to_string());
            }
        }
        McpTransportConfig::Sse { url } => {
            if url.trim().is_empty() {
                return Err("SSE url 不能为空".to_string());
            }
        }
    }

    Ok(())
}

pub fn compute_approval_fingerprint(server: &McpServerConfig) -> String {
    let mut hasher = DefaultHasher::new();
    match &server.transport {
        McpTransportConfig::Stdio { command, args } => {
            "stdio".hash(&mut hasher);
            command.hash(&mut hasher);
            args.hash(&mut hasher);
        }
        McpTransportConfig::Sse { url } => {
            "sse".hash(&mut hasher);
            url.hash(&mut hasher);
        }
    }
    server.cwd.hash(&mut hasher);

    let mut env_pairs = server
        .env
        .iter()
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect::<Vec<_>>();
    env_pairs.sort_by(|left, right| left.0.cmp(&right.0));
    env_pairs.hash(&mut hasher);

    format!("{:016x}", hasher.finish())
}

fn is_server_approved(server: &McpServerConfig) -> bool {
    server
        .approval_fingerprint
        .as_ref()
        .map(|fingerprint| fingerprint == &compute_approval_fingerprint(server))
        .unwrap_or(false)
}

fn sanitize_for_tool_name(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|char| {
            if char.is_ascii_alphanumeric() {
                char.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect::<String>();

    let trimmed = sanitized.trim_matches('_');
    if trimmed.is_empty() {
        "tool".to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stdio_server(command: &str) -> McpServerConfig {
        McpServerConfig {
            id: "local-files".to_string(),
            name: "Local Files".to_string(),
            enabled: true,
            transport: McpTransportConfig::Stdio {
                command: command.to_string(),
                args: vec!["serve".to_string()],
            },
            cwd: Some("/tmp".to_string()),
            env: HashMap::from([("TOKEN".to_string(), "123".to_string())]),
            approval_fingerprint: None,
        }
    }

    #[test]
    fn fingerprint_changes_with_command() {
        let first = stdio_server("npx");
        let second = stdio_server("bunx");

        assert_ne!(
            compute_approval_fingerprint(&first),
            compute_approval_fingerprint(&second)
        );
    }

    #[test]
    fn sanitize_tool_name_keeps_ascii_shape() {
        assert_eq!(sanitize_for_tool_name("GitHub/Repo-Read"), "github_repo_read");
        assert_eq!(sanitize_for_tool_name("___"), "tool");
    }

    #[test]
    fn approval_requires_matching_fingerprint() {
        let mut server = stdio_server("npx");
        assert!(!is_server_approved(&server));

        server.approval_fingerprint = Some(compute_approval_fingerprint(&server));
        assert!(is_server_approved(&server));
    }
}
