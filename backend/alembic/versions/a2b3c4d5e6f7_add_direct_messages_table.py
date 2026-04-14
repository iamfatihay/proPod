"""Add direct_messages table for 1-on-1 user DMs

Revision ID: a2b3c4d5e6f7
Revises: f3a8b1c2d4e5
Create Date: 2026-04-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, Sequence[str], None] = 'f3a8b1c2d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create direct_messages table."""
    op.create_table(
        'direct_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=False),
        sa.Column('recipient_id', sa.Integer(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_dm_sender_recipient', 'direct_messages', ['sender_id', 'recipient_id'])
    op.create_index('idx_dm_recipient_read', 'direct_messages', ['recipient_id', 'is_read'])
    op.create_index('idx_dm_created', 'direct_messages', ['created_at'])


def downgrade() -> None:
    """Drop direct_messages table."""
    op.drop_index('idx_dm_created', table_name='direct_messages')
    op.drop_index('idx_dm_recipient_read', table_name='direct_messages')
    op.drop_index('idx_dm_sender_recipient', table_name='direct_messages')
    op.drop_table('direct_messages')
