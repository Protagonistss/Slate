from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str | None
    username: str
    avatar_url: str | None = None
    is_active: bool
    created_at: datetime


class RegisterRequest(BaseModel):
    email: str
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    identifier: str
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserRead


class OAuthStartResponse(BaseModel):
    provider: str
    authorization_url: str
    state: str


class OAuthExchangeRequest(BaseModel):
    ticket: str = Field(min_length=1, max_length=512)


class DetailResponse(BaseModel):
    detail: str
