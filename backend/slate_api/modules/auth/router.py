from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from slate_api.core.config import settings
from slate_api.core.deps import get_current_user
from slate_api.infra.database import get_db
from slate_api.infra.models import User
from slate_api.modules.auth.oauth import (
    OAuthError,
    build_authorization_url,
    create_oauth_state,
    decode_oauth_state,
    exchange_code_for_access_token,
    fetch_user_profile,
    consume_oauth_exchange_ticket,
    store_oauth_exchange_ticket,
    upsert_oauth_user,
)
from slate_api.modules.auth.schemas import (
    DetailResponse,
    LoginRequest,
    LogoutRequest,
    OAuthExchangeRequest,
    OAuthStartResponse,
    RefreshRequest,
    RegisterRequest,
    TokenPairResponse,
    UserRead,
)
from slate_api.modules.auth.service import login_user, logout_user, refresh_tokens, register_user

router = APIRouter(tags=["auth"])


def _request_context(request: Request) -> tuple[str | None, str | None]:
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None
    return user_agent, ip_address


def _normalize_redirect_target(target: str | None) -> str | None:
    if target is None:
        return None

    normalized = target.strip()
    return normalized or None


def _is_app_deep_link(target: str | None) -> bool:
    normalized = _normalize_redirect_target(target)
    if normalized is None:
        return False

    return urlsplit(normalized).scheme == "slate"


def _append_query_params(url: str, params: dict[str, str]) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update(params)
    return urlunsplit(parts._replace(query=urlencode(query)))


@router.post("/auth/register", response_model=TokenPairResponse)
def register(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenPairResponse:
    user_agent, ip_address = _request_context(request)
    return register_user(db, payload, user_agent=user_agent, ip_address=ip_address)


@router.post("/auth/login", response_model=TokenPairResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenPairResponse:
    user_agent, ip_address = _request_context(request)
    return login_user(db, payload, user_agent=user_agent, ip_address=ip_address)


@router.post("/auth/refresh", response_model=TokenPairResponse)
def refresh_token(
    payload: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenPairResponse:
    user_agent, ip_address = _request_context(request)
    return refresh_tokens(db, payload, user_agent=user_agent, ip_address=ip_address)


@router.post("/auth/logout", response_model=DetailResponse)
def logout(payload: LogoutRequest, db: Session = Depends(get_db)) -> DetailResponse:
    logout_user(db, payload.refresh_token)
    return DetailResponse(detail="已退出登录")


@router.post("/auth/oauth/exchange", response_model=TokenPairResponse)
def oauth_exchange(payload: OAuthExchangeRequest) -> TokenPairResponse:
    try:
        return consume_oauth_exchange_ticket(payload.ticket)
    except OAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/auth/oauth/{provider}/start", response_model=OAuthStartResponse)
def oauth_start(
    provider: str,
    redirect_to: str | None = Query(default=None),
) -> OAuthStartResponse:
    try:
        state = create_oauth_state(provider, redirect_to)
        return OAuthStartResponse(
            provider=provider,
            authorization_url=build_authorization_url(provider, state),
            state=state,
        )
    except OAuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/auth/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str,
    state: str,
    request: Request,
    db: Session = Depends(get_db),
):
    state_payload: dict[str, object] | None = None

    try:
        state_payload = decode_oauth_state(state)
        if state_payload.get("provider") != provider:
            raise OAuthError("OAuth provider 与 state 不匹配")

        token_data = await exchange_code_for_access_token(provider, code)
        access_token = token_data.get("access_token")
        if not access_token:
            raise OAuthError("OAuth 未返回 access_token")

        profile = await fetch_user_profile(provider, access_token)
        user_agent, ip_address = _request_context(request)
        auth_payload = upsert_oauth_user(
            db,
            provider=provider,
            profile=profile,
            user_agent=user_agent,
            ip_address=ip_address,
        )
    except OAuthError as exc:
        redirect_target = None
        if state_payload is not None:
            redirect_target = _normalize_redirect_target(str(state_payload.get("redirect_to") or ""))
        if redirect_target is None:
            redirect_target = _normalize_redirect_target(settings.frontend_oauth_failure_url)

        if redirect_target:
            if _is_app_deep_link(redirect_target):
                target_url = _append_query_params(
                    redirect_target,
                    {
                        "error": str(exc),
                        "provider": provider,
                    },
                )
                return RedirectResponse(url=target_url, status_code=status.HTTP_302_FOUND)

            fragment = urlencode({"error": str(exc)})
            return RedirectResponse(
                url=f"{redirect_target}#{fragment}",
                status_code=status.HTTP_302_FOUND,
            )

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    redirect_target = _normalize_redirect_target(str(state_payload.get("redirect_to") or ""))
    if redirect_target is None:
        redirect_target = _normalize_redirect_target(settings.frontend_oauth_success_url)

    if redirect_target:
        if _is_app_deep_link(redirect_target):
            ticket = store_oauth_exchange_ticket(provider, auth_payload)
            target_url = _append_query_params(
                redirect_target,
                {
                    "ticket": ticket,
                    "provider": provider,
                },
            )
            return RedirectResponse(url=target_url, status_code=status.HTTP_302_FOUND)

        fragment = urlencode(
            {
                "access_token": auth_payload.access_token,
                "refresh_token": auth_payload.refresh_token,
                "token_type": auth_payload.token_type,
            }
        )
        return RedirectResponse(
            url=f"{redirect_target}#{fragment}",
            status_code=status.HTTP_302_FOUND,
        )

    return auth_payload


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
