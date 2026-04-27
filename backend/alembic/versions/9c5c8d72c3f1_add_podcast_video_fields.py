"""Add podcast video fields

Revision ID: 9c5c8d72c3f1
Revises: 788d6da0a208
Create Date: 2026-04-26 22:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c5c8d72c3f1'
down_revision: Union[str, Sequence[str], None] = '788d6da0a208'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'podcasts',
        sa.Column('media_type', sa.String(), nullable=False, server_default='audio'),
    )
    op.add_column(
        'podcasts',
        sa.Column('video_url', sa.String(), nullable=True),
    )
    # Keep a temporary default so existing rows can be backfilled during migration.
    op.alter_column('podcasts', 'media_type', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('podcasts', 'video_url')
    op.drop_column('podcasts', 'media_type')