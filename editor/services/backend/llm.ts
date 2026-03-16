import { buildBackendUrl, getBackendErrorMessage } from "./base";
import { requestBackend, requestBackendStream } from "./client";
import type { Message, StreamChunk, ToolDefinition } from "@/services/llm/types";

export interface BackendLLMProvider {
  name: string;
  display_name: string;
  configured: boolean;
  base_url: string | null;
  models: string[];
  default_model: string | null;
  source: "builtin" | "custom";
  protocol: "openai";
  editable: boolean;
  deletable: boolean;
}

export interface BackendLLMModel {
  provider: string;
  model: string;
  configured: boolean;
}

export interface BackendLLMChatRequest {
  conversation_id?: string | null;
  workspace_id?: string | null;
  provider?: string | null;
  model?: string | null;
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  max_tokens?: number;
}

export interface BackendLLMProviderUpsertRequest {
  display_name: string;
  base_url: string;
  api_key?: string | null;
  models: string[];
  default_model?: string | null;
}

export async function listBackendLLMProviders(): Promise<BackendLLMProvider[]> {
  const response = await requestBackend({
    url: buildBackendUrl("/llm/providers"),
    auth: "required",
    networkErrorMessage: "获取模型目录失败",
  });

  if (!response.ok || !Array.isArray(response.data)) {
    throw new Error(getBackendErrorMessage(response.status, response.data, "获取模型目录失败"));
  }

  return response.data as BackendLLMProvider[];
}

export async function listBackendLLMModels(): Promise<BackendLLMModel[]> {
  const response = await requestBackend({
    url: buildBackendUrl("/llm/models"),
    auth: "required",
    networkErrorMessage: "获取模型列表失败",
  });

  if (!response.ok || !Array.isArray(response.data)) {
    throw new Error(getBackendErrorMessage(response.status, response.data, "获取模型列表失败"));
  }

  return response.data as BackendLLMModel[];
}

export async function createBackendLLMProvider(
  payload: BackendLLMProviderUpsertRequest
): Promise<BackendLLMProvider> {
  const response = await requestBackend({
    url: buildBackendUrl("/llm/providers"),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
    auth: "required",
    networkErrorMessage: "保存模型 Provider 失败",
  });

  if (!response.ok || !response.data || typeof response.data !== "object") {
    throw new Error(getBackendErrorMessage(response.status, response.data, "保存模型 Provider 失败"));
  }

  return response.data as BackendLLMProvider;
}

export async function updateBackendLLMProvider(
  providerName: string,
  payload: BackendLLMProviderUpsertRequest
): Promise<BackendLLMProvider> {
  const response = await requestBackend({
    url: buildBackendUrl(`/llm/providers/${encodeURIComponent(providerName)}`),
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
    auth: "required",
    networkErrorMessage: "更新模型 Provider 失败",
  });

  if (!response.ok || !response.data || typeof response.data !== "object") {
    throw new Error(getBackendErrorMessage(response.status, response.data, "更新模型 Provider 失败"));
  }

  return response.data as BackendLLMProvider;
}

export async function deleteBackendLLMProvider(providerName: string): Promise<void> {
  const response = await requestBackend({
    url: buildBackendUrl(`/llm/providers/${encodeURIComponent(providerName)}`),
    method: "DELETE",
    auth: "required",
    networkErrorMessage: "删除模型 Provider 失败",
  });

  if (!response.ok) {
    throw new Error(getBackendErrorMessage(response.status, response.data, "删除模型 Provider 失败"));
  }
}

export async function* streamBackendLLMChat(
  payload: BackendLLMChatRequest,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const response = await requestBackendStream({
    url: buildBackendUrl("/llm/chat/stream"),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
    signal,
    auth: "required",
    networkErrorMessage: "调用模型网关失败",
  });

  if (!response.ok) {
    const data = await response.json().catch(async () => response.text().catch(() => null));
    throw new Error(getBackendErrorMessage(response.status, data, "调用模型网关失败"));
  }

  if (!response.body) {
    throw new Error("模型网关没有返回可读流");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data: ")) {
        continue;
      }

      const data = line.slice(6);
      if (!data) {
        continue;
      }

      try {
        const event = JSON.parse(data) as StreamChunk;
        yield event;

        if (event.type === "done") {
          return;
        }
      } catch {
        // 忽略非法 SSE 行，继续读取后续数据。
      }
    }
  }

  yield { type: "done" };
}
