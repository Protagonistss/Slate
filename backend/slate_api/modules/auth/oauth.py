from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import secrets
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from slate_api.core.config import settings
from slate_api.infra.database import redis_client
from slate_api.infra.models import AuthIdentity, User
from slate_api.modules.auth.schemas import TokenPairResponse
from slate_api.modules.auth.service import issue_token_pair

OAUTH_EXCHANGE_TICKET_PREFIX = "oauth:exchange:"
OAUTH_EXCHANGE_TICKET_TTL_SECONDS = 120


class OAuthError(Exception):
    pass


@dataclass(frozen=True)
class OAuthProviderConfig:
    name: str
    authorize_url: str
    token_url: str
    userinfo_url: str
    scopes: tuple[str, ...]
    client_id: str
    client_secret: str
    redirect_uri: str


PROVIDERS: dict[str, OAuthProviderConfig] = {
    "github": OAuthProviderConfig(
        name="github",
        authorize_url="https://github.com/login/oauth/authorize",
        token_url="https://github.com/login/oauth/access_token",
        userinfo_url="https://api.github.com/user",
        scopes=("read:user", "user:email"),
        client_id=settings.github_client_id,
        client_secret=settings.github_client_secret,
        redirect_uri=settings.github_redirect_uri,
    ),
    "gitee": OAuthProviderConfig(
        name="gitee",
        authorize_url="https://gitee.com/oauth/authorize",
        token_url="https://gitee.com/oauth/token",
        userinfo_url="https://gitee.com/api/v5/user",
        scopes=("user_info",),
        client_id=settings.gitee_client_id,
        client_secret=settings.gitee_client_secret,
        redirect_uri=settings.gitee_redirect_uri,
    ),
    "google": OAuthProviderConfig(
        name="google",
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        userinfo_url="https://openidconnect.googleapis.com/v1/userinfo",
        scopes=("openid", "email", "profile"),
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        redirect_uri=settings.google_redirect_uri,
    ),
}


def get_provider(provider: str) -> OAuthProviderConfig:
    config = PROVIDERS.get(provider)
    if config is None:
        raise OAuthError(f"不支持的 OAuth provider: {provider}")
    if not config.client_id or not config.client_secret:
        raise OAuthError(f"{provider} OAuth 尚未配置 client_id/client_secret")
    return config


def create_oauth_state(provider: str, redirect_to: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "provider": provider,
        "redirect_to": redirect_to,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=10)).timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_oauth_state(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise OAuthError("OAuth state 无效") from exc


def build_authorization_url(provider: str, state: str) -> str:
    config = get_provider(provider)
    params = {
        "client_id": config.client_id,
        "redirect_uri": config.redirect_uri,
        "response_type": "code",
        "scope": " ".join(config.scopes),
        "state": state,
    }
    if provider == "google":
        params["access_type"] = "offline"
        params["prompt"] = "consent"
    return f"{config.authorize_url}?{urlencode(params)}"


async def exchange_code_for_access_token(provider: str, code: str) -> dict[str, Any]:
    config = get_provider(provider)
    payload = {
        "client_id": config.client_id,
        "client_secret": config.client_secret,
        "code": code,
        "redirect_uri": config.redirect_uri,
    }
    if provider in {"gitee", "google"}:
        payload["grant_type"] = "authorization_code"

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            config.token_url,
            data=payload,
            headers={"Accept": "application/json"},
        )

    if response.status_code >= 400:
        raise OAuthError(f"{provider} token 交换失败: {response.text}")
    return response.json()


async def fetch_user_profile(provider: str, access_token: str) -> dict[str, Any]:
    config = get_provider(provider)
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(config.userinfo_url, headers=headers)
        if response.status_code >= 400:
            raise OAuthError(f"{provider} 用户信息获取失败: {response.text}")
        profile = response.json()

        if provider == "github" and not profile.get("email"):
            email_response = await client.get("https://api.github.com/user/emails", headers=headers)
            if email_response.status_code < 400:
                emails = email_response.json()
                primary = next((item["email"] for item in emails if item.get("primary")), None)
                profile["email"] = primary or (emails[0]["email"] if emails else None)

    return profile


def _derive_username(db: Session, preferred: str) -> str:
    base = "".join(char for char in preferred if char.isalnum() or char in {"-", "_"}).lower()[:32]
    candidate = base or "slate-user"
    suffix = 1
    while db.execute(select(User).where(User.username == candidate)).scalar_one_or_none():
        suffix += 1
        candidate = f"{base or 'slate-user'}-{suffix}"
    return candidate


def _extract_avatar_url(provider: str, profile: dict[str, Any]) -> str | None:
    if provider in {"github", "gitee"}:
        avatar_url = profile.get("avatar_url")
    elif provider == "google":
        avatar_url = profile.get("picture")
    else:
        avatar_url = None

    return avatar_url if isinstance(avatar_url, str) and avatar_url.strip() else None


def upsert_oauth_user(
    db: Session,
    *,
    provider: str,
    profile: dict[str, Any],
    user_agent: str | None,
    ip_address: str | None,
):
    subject = str(profile.get("sub") or profile.get("id") or "")
    if not subject:
        raise OAuthError(f"{provider} 返回的用户标识为空")

    email = profile.get("email")
    avatar_url = _extract_avatar_url(provider, profile)

    identity = db.execute(
        select(AuthIdentity).where(
            AuthIdentity.provider == provider,
            AuthIdentity.provider_subject == subject,
        )
    ).scalar_one_or_none()

    if identity is not None:
        user = db.get(User, identity.user_id)
        if user is None:
            raise OAuthError("OAuth identity 关联用户不存在")
        if email and user.email != email:
            user.email = email
        if avatar_url and user.avatar_url != avatar_url:
            user.avatar_url = avatar_url
        if email and identity.email != email:
            identity.email = email
        db.commit()
        db.refresh(user)
        return issue_token_pair(db, user, user_agent=user_agent, ip_address=ip_address)

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none() if email else None

    if user is None:
        preferred_name = (
            profile.get("login")
            or profile.get("name")
            or (email.split("@", 1)[0] if email else None)
            or f"{provider}-user"
        )
        user = User(
            email=email,
            username=_derive_username(db, preferred_name),
            avatar_url=avatar_url,
            password_hash=None,
            is_active=True,
        )
        db.add(user)
        db.flush()
    else:
        if avatar_url and user.avatar_url != avatar_url:
            user.avatar_url = avatar_url

    identity = AuthIdentity(
        user_id=user.id,
        provider=provider,
        provider_subject=subject,
        email=email,
    )
    db.add(identity)
    db.commit()
    db.refresh(user)
    return issue_token_pair(db, user, user_agent=user_agent, ip_address=ip_address)


def store_oauth_exchange_ticket(provider: str, payload: TokenPairResponse) -> str:
    ticket = f"{provider}_{secrets.token_urlsafe(24)}"
    redis_client.setex(
        f"{OAUTH_EXCHANGE_TICKET_PREFIX}{ticket}",
        OAUTH_EXCHANGE_TICKET_TTL_SECONDS,
        payload.model_dump_json(),
    )
    return ticket


def consume_oauth_exchange_ticket(ticket: str) -> TokenPairResponse:
    raw_payload = redis_client.getdel(f"{OAUTH_EXCHANGE_TICKET_PREFIX}{ticket}")
    if not raw_payload:
        raise OAuthError("OAuth 交换票据无效或已过期")
    return TokenPairResponse.model_validate_json(raw_payload)
