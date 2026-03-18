from __future__ import annotations

import asyncio

import pytest


def _load_llm_dependencies():
    pytest.importorskip("httpx")
    pytest.importorskip("pydantic_settings")
    pytest.importorskip("sqlalchemy")

    from slate_api.core.schemas import (
        ChatMessage,
        ImageContentBlock,
        ImageSource,
        TextContentBlock,
        ToolResultContentBlock,
        ToolUseContentBlock,
    )
    from slate_api.modules.llm import service as llm

    return llm, ChatMessage, ImageContentBlock, ImageSource, TextContentBlock, ToolResultContentBlock, ToolUseContentBlock


def test_format_messages_for_openai_supports_tool_use_blocks() -> None:
    (
        llm,
        ChatMessage,
        _ImageContentBlock,
        _ImageSource,
        TextContentBlock,
        _ToolResultContentBlock,
        ToolUseContentBlock,
    ) = _load_llm_dependencies()

    messages = [
        ChatMessage(
            role="assistant",
            content=[
                TextContentBlock(type="text", text="先查一下"),
                ToolUseContentBlock(
                    type="tool_use",
                    id="tool_1",
                    name="read_file",
                    input={"path": "README.md"},
                ),
            ],
        )
    ]

    formatted = llm.format_messages_for_openai(messages)

    assert formatted == [
        {
            "role": "assistant",
            "content": "先查一下",
            "tool_calls": [
                {
                    "id": "tool_1",
                    "type": "function",
                    "function": {
                        "name": "read_file",
                        "arguments": '{"path": "README.md"}',
                    },
                }
            ],
        }
    ]


def test_format_messages_for_openai_supports_tool_results_and_images() -> None:
    (
        llm,
        ChatMessage,
        ImageContentBlock,
        ImageSource,
        TextContentBlock,
        ToolResultContentBlock,
        _ToolUseContentBlock,
    ) = _load_llm_dependencies()

    messages = [
        ChatMessage(
            role="user",
            content=[
                TextContentBlock(type="text", text="这是工具输出"),
                ToolResultContentBlock(type="tool_result", tool_use_id="tool_1", content="done"),
            ],
        ),
        ChatMessage(
            role="user",
            content=[
                TextContentBlock(type="text", text="看看这个"),
                ImageContentBlock(
                    type="image",
                    source=ImageSource(
                        type="base64",
                        media_type="image/png",
                        data="abc123",
                    ),
                ),
            ],
        ),
    ]

    formatted = llm.format_messages_for_openai(messages)

    assert formatted[0] == {"role": "user", "content": "这是工具输出"}
    assert formatted[1] == {"role": "tool", "tool_call_id": "tool_1", "content": "done"}
    assert formatted[2] == {
        "role": "user",
        "content": [
            {"type": "text", "text": "看看这个"},
            {"type": "image_url", "image_url": {"url": "data:image/png;base64,abc123"}},
        ],
    }


def test_format_messages_for_openai_drops_empty_messages_and_uses_empty_string_for_tool_calls() -> None:
    (
        llm,
        ChatMessage,
        _ImageContentBlock,
        _ImageSource,
        _TextContentBlock,
        _ToolResultContentBlock,
        ToolUseContentBlock,
    ) = _load_llm_dependencies()

    messages = [
        ChatMessage(role="system", content="   "),
        ChatMessage(
            role="assistant",
            content=[
                ToolUseContentBlock(
                    type="tool_use",
                    id="tool_1",
                    name="list_files",
                    input={},
                ),
            ],
        ),
        ChatMessage(role="user", content="  继续  "),
    ]

    formatted = llm.format_messages_for_openai(messages)

    assert formatted == [
        {
            "role": "assistant",
            "content": "",
            "tool_calls": [
                {
                    "id": "tool_1",
                    "type": "function",
                    "function": {
                        "name": "list_files",
                        "arguments": "{}",
                    },
                }
            ],
        },
        {
            "role": "user",
            "content": "继续",
        },
    ]


def test_resolve_provider_prefers_explicit_configured_provider() -> None:
    llm, *_ = _load_llm_dependencies()

    original_api_key = llm.settings.llm_deepseek_api_key
    original_base_url = llm.settings.llm_deepseek_base_url
    original_models = llm.settings.llm_deepseek_models
    original_default_provider = llm.settings.llm_default_provider

    llm.settings.llm_deepseek_api_key = "secret"
    llm.settings.llm_deepseek_base_url = "https://api.deepseek.com/v1"
    llm.settings.llm_deepseek_models = "deepseek-chat"
    llm.settings.llm_default_provider = "deepseek"

    try:
        provider, model = llm.resolve_provider("deepseek", None)
    finally:
        llm.settings.llm_deepseek_api_key = original_api_key
        llm.settings.llm_deepseek_base_url = original_base_url
        llm.settings.llm_deepseek_models = original_models
        llm.settings.llm_default_provider = original_default_provider

    assert provider.name == "deepseek"
    assert model == "deepseek-chat"


def test_stream_chat_completion_ignores_unknown_conversation_id(monkeypatch) -> None:
    llm, ChatMessage, *_ = _load_llm_dependencies()

    from datetime import datetime, timezone
    from types import SimpleNamespace
    from uuid import uuid4

    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from slate_api.infra.database import Base
    from slate_api.infra.models import LLMUsageLog, User
    from slate_api.modules.llm.schemas import LLMChatRequest

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    testing_session_local = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )
    Base.metadata.create_all(bind=engine)
    db = testing_session_local()

    user = User(
        id=uuid4(),
        email="llm@test.dev",
        username="llm-test",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    class FakeResponse:
        status_code = 200

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def aread(self) -> bytes:
            return b""

        async def aiter_lines(self):
            yield "data: [DONE]"

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        def stream(self, *args, **kwargs) -> FakeResponse:
            return FakeResponse()

    fake_provider = SimpleNamespace(
        name="glm",
        api_key="secret-key",
        base_url="https://example.com/v1",
    )

    monkeypatch.setattr(
        llm,
        "resolve_provider_for_user",
        lambda db_session, current_user, provider_name, model_name: (fake_provider, model_name or "GLM-5"),
    )
    monkeypatch.setattr(llm.httpx, "AsyncClient", FakeAsyncClient)

    request = LLMChatRequest(
        conversation_id=uuid4(),
        provider="glm",
        model="GLM-5",
        messages=[ChatMessage(role="user", content="你好")],
    )

    async def collect_events() -> list[str]:
        events: list[str] = []
        async for event in llm.stream_chat_completion(db, user, request):
            events.append(event)
        return events

    try:
        events = asyncio.run(collect_events())
        usage_log = db.execute(select(LLMUsageLog)).scalar_one()

        assert usage_log.conversation_id is None
        assert usage_log.status == "completed"
        assert events == ['data: {"type": "done"}\n\n']
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
