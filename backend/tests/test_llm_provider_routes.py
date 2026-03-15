from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from slate_api.core.config import settings
from slate_api.core.deps import get_current_user
from slate_api.infra.database import Base, get_db
from slate_api.infra.models import User
from slate_api.main import create_app


@contextmanager
def build_test_client() -> Iterator[TestClient]:
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

    seed_db = testing_session_local()
    user = User(
        id=uuid4(),
        email="provider@test.dev",
        username="provider-test",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    seed_db.add(user)
    seed_db.commit()
    seed_db.refresh(user)
    seed_db.close()

    app = create_app()

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    def override_get_current_user() -> User:
        return user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(app) as client:
        try:
            yield client
        finally:
            app.dependency_overrides.clear()
            Base.metadata.drop_all(bind=engine)


def test_llm_provider_catalog_hides_unconfigured_builtin_providers(monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_deepseek_api_key", "")
    monkeypatch.setattr(settings, "llm_qwen_api_key", "")
    monkeypatch.setattr(settings, "llm_zhipu_api_key", "")
    monkeypatch.setattr(settings, "llm_doubao_api_key", "")
    monkeypatch.setattr(settings, "llm_qwen_base_url", "")
    monkeypatch.setattr(settings, "llm_zhipu_base_url", "")
    monkeypatch.setattr(settings, "llm_doubao_base_url", "")

    with build_test_client() as client:
        response = client.get("/api/v1/llm/providers")

    assert response.status_code == 200
    assert response.json() == []


def test_llm_provider_routes_support_dynamic_openai_compatible_providers(monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_deepseek_api_key", "")
    monkeypatch.setattr(settings, "llm_qwen_api_key", "")
    monkeypatch.setattr(settings, "llm_zhipu_api_key", "")
    monkeypatch.setattr(settings, "llm_doubao_api_key", "")
    monkeypatch.setattr(settings, "llm_qwen_base_url", "")
    monkeypatch.setattr(settings, "llm_zhipu_base_url", "")
    monkeypatch.setattr(settings, "llm_doubao_base_url", "")

    payload = {
        "display_name": "Qwen",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "api_key": "secret-key",
        "models": ["qwen-plus", "qwen-max"],
        "default_model": "qwen-max",
    }

    with build_test_client() as client:
        create_response = client.post("/api/v1/llm/providers", json=payload)
        assert create_response.status_code == 201
        created = create_response.json()
        assert created["name"] == "qwen"
        assert created["display_name"] == "Qwen"
        assert created["source"] == "custom"
        assert created["protocol"] == "openai"
        assert created["deletable"] is True
        assert created["default_model"] == "qwen-max"

        list_response = client.get("/api/v1/llm/providers")
        assert list_response.status_code == 200
        providers = list_response.json()
        assert len(providers) == 1
        assert providers[0]["name"] == "qwen"
        assert providers[0]["models"] == ["qwen-plus", "qwen-max"]

        update_response = client.put(
            "/api/v1/llm/providers/qwen",
            json={
                "display_name": "Qwen Plus",
                "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                "api_key": None,
                "models": ["qwen-plus"],
                "default_model": "qwen-plus",
            },
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["name"] == "qwen-plus"
        assert updated["display_name"] == "Qwen Plus"
        assert updated["models"] == ["qwen-plus"]

        delete_response = client.delete("/api/v1/llm/providers/qwen")
        assert delete_response.status_code == 404

        delete_response = client.delete("/api/v1/llm/providers/qwen-plus")
        assert delete_response.status_code == 204

        final_response = client.get("/api/v1/llm/providers")
        assert final_response.status_code == 200
        assert final_response.json() == []
