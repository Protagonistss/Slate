use crate::config::ConfigManager;
use crate::mcp::{
    CallMcpToolRequest, McpManager, McpServerMutationResponse, McpToolDescriptor,
    RemoveMcpServerRequest, RetryMcpServerRequest, SetMcpServerEnabledRequest,
    UpsertMcpServerRequest,
};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub async fn list_mcp_servers(
    mcp_manager: State<'_, McpManager>,
) -> Result<Vec<crate::mcp::McpServerStatus>, String> {
    Ok(mcp_manager.snapshot_servers().await)
}

#[tauri::command]
pub async fn upsert_mcp_server(
    manager: State<'_, Mutex<ConfigManager>>,
    mcp_manager: State<'_, McpManager>,
    request: UpsertMcpServerRequest,
) -> Result<McpServerMutationResponse, String> {
    let target_id = request.server.id.clone();
    let effective_servers = {
        let manager = manager.lock().unwrap();
        manager
            .upsert_mcp_server(request.scope, request.server, request.approve)
            .map_err(|error| error.to_string())?;
        manager
            .get_effective_mcp_servers()
            .map_err(|error| error.to_string())?
    };

    mcp_manager.apply_servers(effective_servers).await?;
    Ok(mcp_manager.build_mutation_response(&target_id).await)
}

#[tauri::command]
pub async fn remove_mcp_server(
    manager: State<'_, Mutex<ConfigManager>>,
    mcp_manager: State<'_, McpManager>,
    request: RemoveMcpServerRequest,
) -> Result<McpServerMutationResponse, String> {
    let target_id = request.id.clone();
    let effective_servers = {
        let manager = manager.lock().unwrap();
        manager
            .remove_mcp_server(request.scope, &request.id)
            .map_err(|error| error.to_string())?;
        manager
            .get_effective_mcp_servers()
            .map_err(|error| error.to_string())?
    };

    mcp_manager.apply_servers(effective_servers).await?;
    Ok(mcp_manager.build_mutation_response(&target_id).await)
}

#[tauri::command]
pub async fn set_mcp_server_enabled(
    manager: State<'_, Mutex<ConfigManager>>,
    mcp_manager: State<'_, McpManager>,
    request: SetMcpServerEnabledRequest,
) -> Result<McpServerMutationResponse, String> {
    let target_id = request.id.clone();
    let effective_servers = {
        let manager = manager.lock().unwrap();
        manager
            .set_mcp_server_enabled(
                request.scope,
                &request.id,
                request.enabled,
                request.approve,
            )
            .map_err(|error| error.to_string())?;
        manager
            .get_effective_mcp_servers()
            .map_err(|error| error.to_string())?
    };

    mcp_manager.apply_servers(effective_servers).await?;
    Ok(mcp_manager.build_mutation_response(&target_id).await)
}

#[tauri::command]
pub async fn retry_mcp_server(
    manager: State<'_, Mutex<ConfigManager>>,
    mcp_manager: State<'_, McpManager>,
    request: RetryMcpServerRequest,
) -> Result<McpServerMutationResponse, String> {
    let target_id = request.id.clone();
    let effective_servers = {
        let manager = manager.lock().unwrap();
        if request.approve {
            manager
                .approve_mcp_server(request.scope, &request.id)
                .map_err(|error| error.to_string())?;
        }
        manager
            .get_effective_mcp_servers()
            .map_err(|error| error.to_string())?
    };

    mcp_manager.apply_servers(effective_servers).await?;
    Ok(mcp_manager.build_mutation_response(&target_id).await)
}

#[tauri::command]
pub async fn list_mcp_tools(
    mcp_manager: State<'_, McpManager>,
) -> Result<Vec<McpToolDescriptor>, String> {
    Ok(mcp_manager.snapshot_tools().await)
}

#[tauri::command]
pub async fn call_mcp_tool(
    mcp_manager: State<'_, McpManager>,
    request: CallMcpToolRequest,
) -> Result<crate::mcp::McpCallToolResult, String> {
    mcp_manager
        .call_tool(&request.server_id, &request.tool_name, request.arguments)
        .await
}
