from __future__ import annotations

import json
import secrets
from typing import Any, AsyncIterator
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from slate_api.core.config import settings
from slate_api.core.schemas import ChatMessage
from slate_api.infra.database import utcnow
from slate_api.infra.llm.providers import (
    LLMGatewayError,
    delete_custom_provider,
    list_provider_specs_for_user,
    resolve_provider,
    resolve_provider_for_user,
    upsert_custom_provider,
)
from slate_api.infra.models import Conversation, LLMUsageLog, User
from slate_api.modules.llm.schemas import LLMChatRequest, LLMModelRead, LLMProviderRead


def get_provider_catalog(db: Session, user: User) -> list[LLMProviderRead]:
    return [
        LLMProviderRead(
            name=spec.name,
            display_name=spec.display_name,
            configured=spec.configured,
            base_url=spec.base_url or None,
            models=list(spec.models),
            default_model=spec.default_model,
            source=spec.source,  # type: ignore[arg-type]
            protocol=spec.protocol,  # type: ignore[arg-type]
            editable=spec.editable,
            deletable=spec.deletable,
        )
        for spec in list_provider_specs_for_user(db, user)
    ]


def get_model_catalog(db: Session, user: User) -> list[LLMModelRead]:
    items: list[LLMModelRead] = []
    for spec in list_provider_specs_for_user(db, user):
        for model in spec.models:
            items.append(LLMModelRead(provider=spec.name, model=model, configured=spec.configured))
    return items


def save_custom_provider(
    db: Session,
    user: User,
    display_name: str,
    base_url: str,
    api_key: str | None,
    models: list[str],
    default_model: str | None = None,
    existing_provider_name: str | None = None,
) -> LLMProviderRead:
    provider = upsert_custom_provider(
        db=db,
        user=user,
        display_name=display_name,
        base_url=base_url,
        api_key=api_key,
        models=models,
        default_model=default_model,
        existing_provider_name=existing_provider_name,
    )
    return LLMProviderRead(
        name=provider.name,
        display_name=provider.display_name,
        configured=True,
        base_url=provider.base_url,
        models=list(provider.models or []),
        default_model=provider.default_model,
        source="custom",
        protocol="openai",
        editable=True,
        deletable=True,
    )


def remove_custom_provider(db: Session, user: User, provider_name: str) -> None:
    delete_custom_provider(db, user, provider_name)


def format_messages_for_openai(messages: list[ChatMessage]) -> list[dict[str, Any]]:
    formatted: list[dict[str, Any]] = []

    for message in messages:
        if isinstance(message.content, str):
            content = message.content.strip()
            if not content:
                continue
            formatted.append({"role": message.role, "content": content})
            continue

        text_blocks = [block for block in message.content if block.type == "text"]
        tool_use_blocks = [block for block in message.content if block.type == "tool_use"]
        tool_result_blocks = [block for block in message.content if block.type == "tool_result"]
        image_blocks = [block for block in message.content if block.type == "image"]

        if message.role == "assistant" and tool_use_blocks:
            formatted.append(
                {
                    "role": "assistant",
                    "content": "".join(block.text for block in text_blocks).strip(),
                    "tool_calls": [
                        {
                            "id": block.id,
                            "type": "function",
                            "function": {
                                "name": block.name,
                                "arguments": json.dumps(block.input, ensure_ascii=False),
                            },
                        }
                        for block in tool_use_blocks
                    ],
                }
            )
            continue

        if message.role == "user" and tool_result_blocks:
            text_content = "".join(block.text for block in text_blocks).strip()
            if text_content:
                formatted.append({"role": "user", "content": text_content})
            for block in tool_result_blocks:
                formatted.append(
                    {
                        "role": "tool",
                        "tool_call_id": block.tool_use_id,
                        "content": block.content,
                    }
                )
            continue

        if image_blocks:
            formatted.append(
                {
                    "role": message.role,
                    "content": [
                        *[
                            {
                                "type": "text",
                                "text": block.text,
                            }
                            for block in text_blocks
                        ],
                        *[
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": (
                                        f"data:{block.source.media_type};base64,{block.source.data}"
                                        if block.source.type == "base64"
                                        else block.source.data
                                    )
                                },
                            }
                            for block in image_blocks
                        ],
                    ],
                }
            )
            continue

        text_content = "".join(block.text for block in text_blocks).strip()
        if text_content:
            formatted.append(
                {
                    "role": message.role,
                    "content": text_content,
                }
            )

    return formatted


def format_tools_for_openai(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["input_schema"],
            },
        }
        for tool in tools
    ]


def sse_event(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _reasoning_strings_from_delta(delta: dict[str, Any]) -> list[str]:
    """Top-level reasoning fields on delta (not content[] parts — those are handled inline)."""
    out: list[str] = []

    rc = delta.get("reasoning_content")
    if isinstance(rc, str) and rc:
        out.append(rc)

    r = delta.get("reasoning")
    if isinstance(r, str) and r.strip():
        out.append(r)

    return out


def _safe_json_loads(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _extract_upstream_error_message(raw: str) -> str:
    payload = _safe_json_loads(raw)
    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()
        detail = payload.get("detail")
        if isinstance(detail, str) and detail.strip():
            return detail.strip()
        message = payload.get("message")
        if isinstance(message, str) and message.strip():
            return message.strip()

    return raw.strip()


def resolve_usage_conversation_id(
    db: Session,
    user: User,
    conversation_id: UUID | None,
) -> UUID | None:
    if conversation_id is None:
        return None

    existing_conversation_id = db.execute(
        select(Conversation.id).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id,
        )
    ).scalar_one_or_none()

    return existing_conversation_id


async def stream_chat_completion(
    db: Session,
    user: User,
    request: LLMChatRequest,
) -> AsyncIterator[str]:
    provider, model = resolve_provider_for_user(db, user, request.provider, request.model)
    use_openai_protocol = getattr(provider, "protocol", "openai") == "openai"
    usage_log = LLMUsageLog(
        request_id=secrets.token_urlsafe(16),
        user_id=user.id,
        conversation_id=resolve_usage_conversation_id(db, user, request.conversation_id),
        provider=provider.name,
        model=model,
        status="started",
    )
    db.add(usage_log)
    db.commit()
    db.refresh(usage_log)

    body: dict[str, Any] = {
        "model": model,
        "messages": format_messages_for_openai(request.messages),
        "stream": True,
    }
    if request.max_tokens is not None:
        body["max_tokens"] = request.max_tokens
    if request.temperature is not None:
        body["temperature"] = request.temperature
    if request.tools:
        body["tools"] = format_tools_for_openai([tool.model_dump() for tool in request.tools])
        body["tool_choice"] = "auto"

    if use_openai_protocol and request.reasoning_effort:
        body["reasoning_effort"] = request.reasoning_effort

    pending_tool_calls: dict[int, dict[str, str]] = {}
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {provider.api_key}",
    }

    try:
        timeout = httpx.Timeout(settings.llm_request_timeout_seconds, connect=20.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                f"{provider.base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json=body,
            ) as response:
                if response.status_code >= 400:
                    message = (await response.aread()).decode("utf-8", errors="ignore")
                    usage_log.status = "error"
                    usage_log.error = _extract_upstream_error_message(message) or "上游模型调用失败"
                    usage_log.completed_at = utcnow()
                    db.add(usage_log)
                    db.commit()
                    yield sse_event({"type": "error", "error": usage_log.error})
                    return

                async for raw_line in response.aiter_lines():
                    line = raw_line.strip()
                    if not line or not line.startswith("data: "):
                        continue

                    data = line[6:]
                    if data == "[DONE]":
                        usage_log.status = "completed"
                        usage_log.completed_at = utcnow()
                        db.add(usage_log)
                        db.commit()
                        yield sse_event({"type": "done"})
                        return

                    try:
                        parsed = json.loads(data)
                    except json.JSONDecodeError:
                        continue

                    choice = (parsed.get("choices") or [{}])[0]
                    delta = choice.get("delta") or {}
                    finish_reason = choice.get("finish_reason")

                    content = delta.get("content")
                    if isinstance(content, str) and content:
                        yield sse_event({"type": "content", "content": content})
                    elif isinstance(content, list):
                        for part in content:
                            if not isinstance(part, dict):
                                continue
                            ptype = part.get("type")
                            if ptype == "text":
                                text = part.get("text", "")
                                if isinstance(text, str) and text:
                                    yield sse_event({"type": "content", "content": text})
                            elif ptype in ("reasoning", "thinking"):
                                text = part.get("text") or part.get("summary") or ""
                                if isinstance(text, str) and text:
                                    yield sse_event({"type": "reasoning", "content": text})

                    for reasoning_text in _reasoning_strings_from_delta(delta):
                        yield sse_event({"type": "reasoning", "content": reasoning_text})

                    if delta.get("tool_calls"):
                        for tool_call in delta["tool_calls"]:
                            index = tool_call.get("index", 0)
                            current = pending_tool_calls.get(index, {"id": "", "name": "", "arguments": ""})
                            pending_tool_calls[index] = {
                                "id": tool_call.get("id") or current["id"],
                                "name": tool_call.get("function", {}).get("name") or current["name"],
                                "arguments": current["arguments"]
                                + (tool_call.get("function", {}).get("arguments") or ""),
                            }

                    if finish_reason == "tool_calls":
                        for tool_call in pending_tool_calls.values():
                            if not tool_call["name"]:
                                continue
                            yield sse_event(
                                {
                                    "type": "tool_use",
                                    "toolUse": {
                                        "id": tool_call["id"],
                                        "name": tool_call["name"],
                                        "input": _safe_json_loads(tool_call["arguments"]),
                                    },
                                }
                            )
                        pending_tool_calls.clear()

    except Exception as exc:
        usage_log.status = "error"
        usage_log.error = str(exc)
        usage_log.completed_at = utcnow()
        db.add(usage_log)
        db.commit()
        yield sse_event({"type": "error", "error": str(exc)})
        return

    usage_log.status = "completed"
    usage_log.completed_at = utcnow()
    db.add(usage_log)
    db.commit()
    yield sse_event({"type": "done"})
