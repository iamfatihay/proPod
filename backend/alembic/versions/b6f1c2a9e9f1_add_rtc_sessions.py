"""add_rtc_sessions

Revision ID: b6f1c2a9e9f1
Revises: e047a6af2eee
Create Date: 2026-02-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b6f1c2a9e9f1"
down_revision: Union[str, Sequence[str], None] = "e047a6af2eee"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "rtc_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("room_id", sa.String(), nullable=False),
        sa.Column("room_name", sa.String(), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("media_mode", sa.String(), nullable=False, server_default=sa.text("'video'")),
        sa.Column("status", sa.String(), nullable=False, server_default=sa.text("'created'")),
        sa.Column("recording_url", sa.String(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("podcast_id", sa.Integer(), nullable=True),
        sa.Column("last_webhook_payload", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["podcast_id"], ["podcasts.id"]),
    )

    op.create_index("ix_rtc_sessions_room_id", "rtc_sessions", ["room_id"], unique=True)
    op.create_index("ix_rtc_sessions_owner_id", "rtc_sessions", ["owner_id"])
    op.create_index("ix_rtc_sessions_podcast_id", "rtc_sessions", ["podcast_id"])
    op.create_index(
        "idx_rtc_sessions_owner_created",
        "rtc_sessions",
        ["owner_id", "created_at"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_rtc_sessions_owner_created", table_name="rtc_sessions")
    op.drop_index("ix_rtc_sessions_podcast_id", table_name="rtc_sessions")
    op.drop_index("ix_rtc_sessions_owner_id", table_name="rtc_sessions")
    op.drop_index("ix_rtc_sessions_room_id", table_name="rtc_sessions")
    op.drop_table("rtc_sessions")
