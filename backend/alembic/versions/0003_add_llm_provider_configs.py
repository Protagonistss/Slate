"""Add llm provider configs.

Revision ID: 0003_add_llm_provider_configs
Revises: 0002_add_user_avatar_url
Create Date: 2026-03-15 22:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0003_add_llm_provider_configs"
down_revision = "0002_add_user_avatar_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_provider_configs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=128), nullable=False),
        sa.Column("protocol", sa.String(length=32), nullable=False),
        sa.Column("base_url", sa.String(length=1024), nullable=False),
        sa.Column("api_key", sa.Text(), nullable=False),
        sa.Column("models", sa.JSON(), nullable=False),
        sa.Column("default_model", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_llm_provider_user_name"),
    )
    op.create_index("ix_llm_provider_configs_name", "llm_provider_configs", ["name"], unique=False)
    op.create_index("ix_llm_provider_configs_user_id", "llm_provider_configs", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_llm_provider_configs_user_id", table_name="llm_provider_configs")
    op.drop_index("ix_llm_provider_configs_name", table_name="llm_provider_configs")
    op.drop_table("llm_provider_configs")
