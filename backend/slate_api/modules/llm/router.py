from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from slate_api.core.deps import get_current_user
from slate_api.infra.database import get_db
from slate_api.infra.models import User
from slate_api.modules.llm.schemas import LLMChatRequest, LLMModelRead, LLMProviderRead, LLMProviderUpsertRequest
from slate_api.modules.llm.service import (
    LLMGatewayError,
    get_model_catalog,
    get_provider_catalog,
    remove_custom_provider,
    resolve_provider_for_user,
    save_custom_provider,
    stream_chat_completion,
)

router = APIRouter(tags=["llm"])


@router.get("/llm/providers", response_model=list[LLMProviderRead])
def list_providers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LLMProviderRead]:
    return get_provider_catalog(db, current_user)


@router.get("/llm/models", response_model=list[LLMModelRead])
def list_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LLMModelRead]:
    return get_model_catalog(db, current_user)


@router.post("/llm/providers", response_model=LLMProviderRead, status_code=status.HTTP_201_CREATED)
def upsert_provider(
    payload: LLMProviderUpsertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LLMProviderRead:
    try:
        return save_custom_provider(
            db=db,
            user=current_user,
            display_name=payload.display_name,
            base_url=payload.base_url,
            api_key=payload.api_key,
            models=payload.models,
            default_model=payload.default_model,
        )
    except LLMGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/llm/providers/{provider_name}", response_model=LLMProviderRead)
def update_provider(
    provider_name: str,
    payload: LLMProviderUpsertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LLMProviderRead:
    try:
        return save_custom_provider(
            db=db,
            user=current_user,
            display_name=payload.display_name,
            base_url=payload.base_url,
            api_key=payload.api_key,
            models=payload.models,
            default_model=payload.default_model,
            existing_provider_name=provider_name,
        )
    except LLMGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/llm/providers/{provider_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_provider(
    provider_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        remove_custom_provider(db, current_user, provider_name)
    except LLMGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/llm/chat/stream")
async def chat_stream(
    payload: LLMChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        resolve_provider_for_user(db, current_user, payload.provider, payload.model)
    except LLMGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return StreamingResponse(
        stream_chat_completion(db, current_user, payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
