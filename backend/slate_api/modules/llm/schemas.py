from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from slate_api.core.schemas import ChatMessage, ToolDefinition


class LLMProviderRead(BaseModel):
    name: str
    display_name: str
    configured: bool
    base_url: str | None = None
    models: list[str]
    default_model: str | None = None
    source: Literal["builtin", "custom"] = "builtin"
    protocol: Literal["openai"] = "openai"
    editable: bool = False
    deletable: bool = False


class LLMModelRead(BaseModel):
    provider: str
    model: str
    configured: bool


class LLMChatRequest(BaseModel):
    conversation_id: UUID | None = None
    workspace_id: str | None = None
    provider: str | None = None
    model: str | None = None
    messages: list[ChatMessage]
    tools: list[ToolDefinition] = Field(default_factory=list)
    temperature: float | None = None
    max_tokens: int | None = None
    reasoning_effort: str | None = None


class LLMProviderUpsertRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=128)
    base_url: str = Field(min_length=1, max_length=1024)
    api_key: str | None = Field(default=None)
    models: list[str] = Field(default_factory=list)
    default_model: str | None = Field(default=None, max_length=128)


class LLMStreamEvent(BaseModel):
    type: Literal["content", "reasoning", "tool_use", "tool_result", "error", "done"]
    content: str | None = None
    toolUse: dict[str, Any] | None = None
    toolResult: dict[str, Any] | None = None
    error: str | None = None
