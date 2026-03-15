from __future__ import annotations

from dataclasses import dataclass
import re

from sqlalchemy.orm import Session

from slate_api.core.config import settings
from slate_api.infra.models import LLMProviderConfig, User


class LLMGatewayError(Exception):
    pass


@dataclass(frozen=True)
class ProviderSpec:
    name: str
    display_name: str
    api_key: str
    base_url: str
    models: tuple[str, ...]
    source: str = "builtin"
    protocol: str = "openai"
    editable: bool = False
    deletable: bool = False

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.base_url and self.models)

    @property
    def default_model(self) -> str | None:
        return self.models[0] if self.models else None


def normalize_provider_name(display_name: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", display_name.strip().lower())
    normalized = normalized.strip("-")
    if not normalized:
        raise LLMGatewayError("Provider Name 不能为空")
    return normalized


def _normalize_models(raw_models: list[str]) -> tuple[str, ...]:
    return tuple(model.strip() for model in raw_models if model.strip())


def list_provider_specs() -> list[ProviderSpec]:
    return [
        ProviderSpec(
            name=name,
            display_name=str(raw["display_name"]),
            api_key=str(raw["api_key"] or ""),
            base_url=str(raw["base_url"] or ""),
            models=tuple(raw["models"]),
        )
        for name, raw in settings.llm_provider_specs.items()
        if raw["api_key"] and raw["base_url"] and raw["models"]
    ]


def list_custom_provider_specs(db: Session, user: User) -> list[ProviderSpec]:
    providers = (
        db.query(LLMProviderConfig)
        .filter(LLMProviderConfig.user_id == user.id)
        .order_by(LLMProviderConfig.display_name.asc())
        .all()
    )

    return [
        ProviderSpec(
            name=provider.name,
            display_name=provider.display_name,
            api_key=provider.api_key,
            base_url=provider.base_url,
            models=_normalize_models(provider.models or []),
            source="custom",
            protocol="openai",
            editable=True,
            deletable=True,
        )
        for provider in providers
    ]


def list_provider_specs_for_user(db: Session | None = None, user: User | None = None) -> list[ProviderSpec]:
    builtin_specs = list_provider_specs()
    if db is None or user is None:
        return builtin_specs

    return [*builtin_specs, *list_custom_provider_specs(db, user)]


def _resolve_from_specs(
    specs: dict[str, ProviderSpec],
    provider_name: str | None,
    model_name: str | None = None,
) -> tuple[ProviderSpec, str]:
    candidates = [provider_name, settings.llm_default_provider] if provider_name else [settings.llm_default_provider]

    for candidate in candidates:
        spec = specs.get(candidate or "")
        if spec and spec.configured:
            model = model_name or spec.default_model
            if not model:
                raise LLMGatewayError(f"provider {spec.name} 没有可用模型")
            return spec, model

    for spec in specs.values():
        if spec.configured:
            model = model_name or spec.default_model
            if model:
                return spec, model

    raise LLMGatewayError("当前没有已配置的模型 provider")


def resolve_provider(provider_name: str | None, model_name: str | None = None) -> tuple[ProviderSpec, str]:
    specs = {spec.name: spec for spec in list_provider_specs()}
    return _resolve_from_specs(specs, provider_name, model_name)


def resolve_provider_for_user(
    db: Session,
    user: User,
    provider_name: str | None,
    model_name: str | None = None,
) -> tuple[ProviderSpec, str]:
    specs = {spec.name: spec for spec in list_provider_specs_for_user(db, user)}
    return _resolve_from_specs(specs, provider_name, model_name)


def upsert_custom_provider(
    db: Session,
    user: User,
    display_name: str,
    base_url: str,
    api_key: str | None,
    models: list[str],
    default_model: str | None = None,
    existing_provider_name: str | None = None,
) -> LLMProviderConfig:
    normalized_name = normalize_provider_name(display_name)
    next_models = [model.strip() for model in models if model.strip()]
    builtin_provider_names = {spec.name for spec in list_provider_specs()}

    if not next_models:
        raise LLMGatewayError("至少需要一个模型名称")

    if normalized_name in builtin_provider_names and normalized_name != existing_provider_name:
        raise LLMGatewayError(f"provider {normalized_name} 与内置 provider 冲突")

    query = db.query(LLMProviderConfig).filter(LLMProviderConfig.user_id == user.id)
    provider = (
        query.filter(LLMProviderConfig.name == existing_provider_name).one_or_none()
        if existing_provider_name
        else query.filter(LLMProviderConfig.name == normalized_name).one_or_none()
    )

    if existing_provider_name and provider is None:
        raise LLMGatewayError("provider 不存在")

    if provider is None:
        if not api_key or not api_key.strip():
            raise LLMGatewayError("API Key 不能为空")

        provider = LLMProviderConfig(
            user_id=user.id,
            name=normalized_name,
            protocol="openai",
        )
        db.add(provider)
    elif normalized_name != provider.name:
        conflict = (
            query.filter(LLMProviderConfig.name == normalized_name, LLMProviderConfig.id != provider.id).one_or_none()
        )
        if conflict is not None:
            raise LLMGatewayError(f"provider {normalized_name} 已存在")
        provider.name = normalized_name

    provider.display_name = display_name.strip()
    provider.base_url = base_url.strip().rstrip("/")
    if api_key and api_key.strip():
        provider.api_key = api_key.strip()
    provider.models = next_models
    provider.default_model = default_model if default_model in next_models else next_models[0]
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


def delete_custom_provider(db: Session, user: User, provider_name: str) -> None:
    provider = (
        db.query(LLMProviderConfig)
        .filter(LLMProviderConfig.user_id == user.id, LLMProviderConfig.name == provider_name)
        .one_or_none()
    )
    if provider is None:
        raise LLMGatewayError("provider 不存在")

    db.delete(provider)
    db.commit()
