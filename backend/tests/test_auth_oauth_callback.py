from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator
from uuid import uuid4

from fastapi.testclient import TestClient

from slate_api.infra.database import get_db
from slate_api.main import create_app
from slate_api.modules.auth import router as auth_router_module
from slate_api.modules.auth import oauth as oauth_module
from slate_api.modules.auth.oauth import OAuthProviderConfig, create_oauth_state
from slate_api.modules.auth.schemas import TokenPairResponse, UserRead


@contextmanager
def build_test_client() -> Iterator[TestClient]:
    app = create_app()

    def override_get_db():
        yield None

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        try:
            yield client
        finally:
            app.dependency_overrides.clear()


def _token_pair_response() -> TokenPairResponse:
    return TokenPairResponse(
        access_token="access-token",
        refresh_token="refresh-token",
        expires_in=900,
        user=UserRead(
            id=uuid4(),
            email="octocat@example.com",
            username="octocat",
            is_active=True,
            created_at=datetime.now(timezone.utc),
        ),
    )


def test_oauth_callback_returns_json_when_frontend_redirects_are_empty(monkeypatch) -> None:
    async def fake_exchange_code_for_access_token(provider: str, code: str) -> dict[str, str]:
        return {"access_token": f"{provider}-{code}"}

    async def fake_fetch_user_profile(provider: str, access_token: str) -> dict[str, str]:
        return {"id": "github-user", "login": "octocat", "email": "octocat@example.com"}

    monkeypatch.setattr(auth_router_module.settings, "frontend_oauth_success_url", "")
    monkeypatch.setattr(auth_router_module.settings, "frontend_oauth_failure_url", "")
    monkeypatch.setattr(auth_router_module, "exchange_code_for_access_token", fake_exchange_code_for_access_token)
    monkeypatch.setattr(auth_router_module, "fetch_user_profile", fake_fetch_user_profile)
    monkeypatch.setattr(auth_router_module, "upsert_oauth_user", lambda *args, **kwargs: _token_pair_response())

    state = create_oauth_state("github")

    with build_test_client() as client:
        response = client.get(
            "/api/v1/auth/oauth/github/callback",
            params={"code": "code-123", "state": state},
        )

    assert response.status_code == 200
    assert response.json()["access_token"] == "access-token"
    assert response.json()["refresh_token"] == "refresh-token"
    assert response.json()["user"]["username"] == "octocat"


def test_gitee_oauth_start_returns_authorization_url(monkeypatch) -> None:
    monkeypatch.setitem(
        oauth_module.PROVIDERS,
        "gitee",
        OAuthProviderConfig(
            name="gitee",
            authorize_url="https://gitee.com/oauth/authorize",
            token_url="https://gitee.com/oauth/token",
            userinfo_url="https://gitee.com/api/v5/user",
            scopes=("user_info",),
            client_id="gitee-client-id",
            client_secret="gitee-client-secret",
            redirect_uri="http://localhost:8000/api/v1/auth/oauth/gitee/callback",
        ),
    )

    with build_test_client() as client:
        response = client.get("/api/v1/auth/oauth/gitee/start")

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "gitee"
    assert payload["authorization_url"].startswith("https://gitee.com/oauth/authorize?")
    assert "scope=user_info" in payload["authorization_url"]
    assert payload["state"]


def test_oauth_callback_returns_json_error_when_frontend_redirects_are_empty(monkeypatch) -> None:
    monkeypatch.setattr(auth_router_module.settings, "frontend_oauth_success_url", "")
    monkeypatch.setattr(auth_router_module.settings, "frontend_oauth_failure_url", "")

    state = create_oauth_state("google")

    with build_test_client() as client:
        response = client.get(
            "/api/v1/auth/oauth/github/callback",
            params={"code": "code-123", "state": state},
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "OAuth provider 与 state 不匹配"}


def test_gitee_oauth_callback_returns_json_when_frontend_redirects_are_empty(monkeypatch) -> None:
    async def fake_exchange_code_for_access_token(provider: str, code: str) -> dict[str, str]:
        return {"access_token": f"{provider}-{code}"}

    async def fake_fetch_user_profile(provider: str, access_token: str) -> dict[str, str]:
        return {"id": "gitee-user", "login": "giteecat"}

    monkeypatch.setattr(auth_router_module.settings, "frontend_oauth_success_url", "")
    monkeypatch.setattr(auth_router_module.settings, "frontend_oauth_failure_url", "")
    monkeypatch.setattr(auth_router_module, "exchange_code_for_access_token", fake_exchange_code_for_access_token)
    monkeypatch.setattr(auth_router_module, "fetch_user_profile", fake_fetch_user_profile)
    monkeypatch.setattr(auth_router_module, "upsert_oauth_user", lambda *args, **kwargs: _token_pair_response())

    state = create_oauth_state("gitee")

    with build_test_client() as client:
        response = client.get(
            "/api/v1/auth/oauth/gitee/callback",
            params={"code": "code-123", "state": state},
        )

    assert response.status_code == 200
    assert response.json()["access_token"] == "access-token"
    assert response.json()["refresh_token"] == "refresh-token"


def test_oauth_callback_redirects_when_redirect_to_is_present(monkeypatch) -> None:
    async def fake_exchange_code_for_access_token(provider: str, code: str) -> dict[str, str]:
        return {"access_token": f"{provider}-{code}"}

    async def fake_fetch_user_profile(provider: str, access_token: str) -> dict[str, str]:
        return {"id": "github-user", "login": "octocat", "email": "octocat@example.com"}

    monkeypatch.setattr(auth_router_module.settings, "frontend_oauth_success_url", "")
    monkeypatch.setattr(auth_router_module.settings, "frontend_oauth_failure_url", "")
    monkeypatch.setattr(auth_router_module, "exchange_code_for_access_token", fake_exchange_code_for_access_token)
    monkeypatch.setattr(auth_router_module, "fetch_user_profile", fake_fetch_user_profile)
    monkeypatch.setattr(auth_router_module, "upsert_oauth_user", lambda *args, **kwargs: _token_pair_response())

    state = create_oauth_state("github", "http://localhost:1420/auth/callback")

    with build_test_client() as client:
        response = client.get(
            "/api/v1/auth/oauth/github/callback",
            params={"code": "code-123", "state": state},
            follow_redirects=False,
        )

    assert response.status_code == 302
    assert response.headers["location"].startswith("http://localhost:1420/auth/callback#")


def test_github_oauth_callback_redirects_to_app_deep_link_with_ticket(monkeypatch) -> None:
    async def fake_exchange_code_for_access_token(provider: str, code: str) -> dict[str, str]:
        return {"access_token": f"{provider}-{code}"}

    async def fake_fetch_user_profile(provider: str, access_token: str) -> dict[str, str]:
        return {"id": "github-user", "login": "octocat", "email": "octocat@example.com"}

    monkeypatch.setattr(auth_router_module.settings, "frontend_oauth_success_url", "")
    monkeypatch.setattr(auth_router_module.settings, "frontend_oauth_failure_url", "")
    monkeypatch.setattr(auth_router_module, "exchange_code_for_access_token", fake_exchange_code_for_access_token)
    monkeypatch.setattr(auth_router_module, "fetch_user_profile", fake_fetch_user_profile)
    monkeypatch.setattr(auth_router_module, "upsert_oauth_user", lambda *args, **kwargs: _token_pair_response())
    monkeypatch.setattr(auth_router_module, "store_oauth_exchange_ticket", lambda provider, payload: "ticket-123")

    state = create_oauth_state("github", "slate://auth/callback")

    with build_test_client() as client:
        response = client.get(
            "/api/v1/auth/oauth/github/callback",
            params={"code": "code-123", "state": state},
            follow_redirects=False,
        )

    assert response.status_code == 302
    assert response.headers["location"] == "slate://auth/callback?ticket=ticket-123&provider=github"


def test_gitee_oauth_callback_redirects_when_redirect_to_is_present(monkeypatch) -> None:
    async def fake_exchange_code_for_access_token(provider: str, code: str) -> dict[str, str]:
        return {"access_token": f"{provider}-{code}"}

    async def fake_fetch_user_profile(provider: str, access_token: str) -> dict[str, str]:
        return {"id": "gitee-user", "login": "giteecat"}

    monkeypatch.setattr(auth_router_module.settings, "frontend_oauth_success_url", "")
    monkeypatch.setattr(auth_router_module.settings, "frontend_oauth_failure_url", "")
    monkeypatch.setattr(auth_router_module, "exchange_code_for_access_token", fake_exchange_code_for_access_token)
    monkeypatch.setattr(auth_router_module, "fetch_user_profile", fake_fetch_user_profile)
    monkeypatch.setattr(auth_router_module, "upsert_oauth_user", lambda *args, **kwargs: _token_pair_response())

    state = create_oauth_state("gitee", "http://localhost:1420/auth/callback")

    with build_test_client() as client:
        response = client.get(
            "/api/v1/auth/oauth/gitee/callback",
            params={"code": "code-123", "state": state},
            follow_redirects=False,
        )

    assert response.status_code == 302
    assert response.headers["location"].startswith("http://localhost:1420/auth/callback#")


def test_oauth_exchange_returns_token_pair_from_ticket(monkeypatch) -> None:
    monkeypatch.setattr(
        auth_router_module,
        "consume_oauth_exchange_ticket",
        lambda ticket: _token_pair_response() if ticket == "ticket-123" else None,
    )

    with build_test_client() as client:
        response = client.post("/api/v1/auth/oauth/exchange", json={"ticket": "ticket-123"})

    assert response.status_code == 200
    assert response.json()["access_token"] == "access-token"
    assert response.json()["user"]["username"] == "octocat"


def test_oauth_exchange_returns_error_for_invalid_ticket(monkeypatch) -> None:
    def fake_consume(_: str):
        raise auth_router_module.OAuthError("OAuth 交换票据无效或已过期")

    monkeypatch.setattr(auth_router_module, "consume_oauth_exchange_ticket", fake_consume)

    with build_test_client() as client:
        response = client.post("/api/v1/auth/oauth/exchange", json={"ticket": "missing-ticket"})

    assert response.status_code == 400
    assert response.json() == {"detail": "OAuth 交换票据无效或已过期"}
