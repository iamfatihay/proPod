"""add_rtc_recording_status

Revision ID: f8a9c1d2e3b4
Revises: 788d6da0a208
Create Date: 2026-05-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8a9c1d2e3b4'
down_revision: Union[str, Sequence[str], None] = '788d6da0a208'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'rtc_sessions',
        sa.Column('recording_status', sa.String(), nullable=False, server_default='waiting'),
    )
    op.execute(
        """
        UPDATE rtc_sessions
        SET recording_status = CASE
            WHEN recording_url IS NOT NULL OR podcast_id IS NOT NULL OR status = 'completed' THEN 'completed'
            WHEN is_live = true THEN 'live'
            WHEN ended_at IS NOT NULL AND last_webhook_payload IS NOT NULL THEN 'failed'
            WHEN ended_at IS NOT NULL THEN 'processing'
            ELSE 'waiting'
        END
        """
    )
    op.alter_column('rtc_sessions', 'recording_status', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('rtc_sessions', 'recording_status')