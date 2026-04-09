"""Add playlists, playlist_items, and notifications tables

Revision ID: a1b2c3d4e5f6
Revises: 788d6da0a208
Create Date: 2026-04-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '788d6da0a208'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create playlists, playlist_items, and notifications tables."""

    # --- playlists ---
    op.create_table(
        'playlists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=True),
        sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_playlist_owner', 'playlists', ['owner_id'])
    op.create_index('idx_playlist_public', 'playlists', ['is_public'])
    op.create_index(op.f('ix_playlists_id'), 'playlists', ['id'])

    # --- playlist_items ---
    op.create_table(
        'playlist_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('playlist_id', sa.Integer(), sa.ForeignKey('playlists.id', ondelete='CASCADE'), nullable=False),
        sa.Column('podcast_id', sa.Integer(), sa.ForeignKey('podcasts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('added_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('playlist_id', 'podcast_id', name='unique_playlist_podcast'),
    )
    op.create_index('idx_playlist_item_playlist', 'playlist_items', ['playlist_id'])
    op.create_index('idx_playlist_item_podcast', 'playlist_items', ['podcast_id'])
    op.create_index(op.f('ix_playlist_items_id'), 'playlist_items', ['id'])

    # --- notifications ---
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('podcast_id', sa.Integer(), sa.ForeignKey('podcasts.id', ondelete='CASCADE'), nullable=True),
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('type', sa.String(32), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('read', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notifications_id'), 'notifications', ['id'])
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'])
    op.create_index('idx_notifications_user_read', 'notifications', ['user_id', 'read'])
    op.create_index('idx_notifications_created', 'notifications', ['created_at'])


def downgrade() -> None:
    """Drop playlists, playlist_items, and notifications tables."""

    # Drop notifications
    op.drop_index('idx_notifications_created', table_name='notifications')
    op.drop_index('idx_notifications_user_read', table_name='notifications')
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_id'), table_name='notifications')
    op.drop_table('notifications')

    # Drop playlist_items first (FK to playlists)
    op.drop_index('idx_playlist_item_podcast', table_name='playlist_items')
    op.drop_index('idx_playlist_item_playlist', table_name='playlist_items')
    op.drop_index(op.f('ix_playlist_items_id'), table_name='playlist_items')
    op.drop_table('playlist_items')

    # Drop playlists
    op.drop_index(op.f('ix_playlists_id'), table_name='playlists')
    op.drop_index('idx_playlist_public', table_name='playlists')
    op.drop_index('idx_playlist_owner', table_name='playlists')
    op.drop_table('playlists')
