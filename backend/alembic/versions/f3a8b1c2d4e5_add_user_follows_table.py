"""Add user_follows table for creator follow feature

Revision ID: f3a8b1c2d4e5
Revises: a1b2c3d4e5f6
Create Date: 2026-04-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a8b1c2d4e5'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create user_follows table."""
    op.create_table(
        'user_follows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('follower_id', sa.Integer(), nullable=False),
        sa.Column('followed_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['follower_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['followed_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('follower_id', 'followed_id', name='unique_user_follow'),
    )
    op.create_index('idx_user_follows_follower', 'user_follows', ['follower_id'])
    op.create_index('idx_user_follows_followed', 'user_follows', ['followed_id'])


def downgrade() -> None:
    """Drop user_follows table."""
    op.drop_index('idx_user_follows_followed', table_name='user_follows')
    op.drop_index('idx_user_follows_follower', table_name='user_follows')
    op.drop_table('user_follows')
