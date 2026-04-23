"""add push_tickets table

Revision ID: c1d2e3f4a5b6
Revises: b3c4d5e6f7a8
Create Date: 2026-04-23 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'c1d2e3f4a5b6'
down_revision = 'b3c4d5e6f7a8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'push_tickets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('expo_ticket_id', sa.String(length=64), nullable=False),
        sa.Column('token', sa.String(length=512), nullable=False),
        sa.Column('sent_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_push_tickets_id', 'push_tickets', ['id'], unique=False)
    op.create_index('ix_push_tickets_expo_ticket_id', 'push_tickets', ['expo_ticket_id'], unique=True)
    op.create_index('ix_push_tickets_sent_at', 'push_tickets', ['sent_at'], unique=False)


def downgrade():
    op.drop_index('ix_push_tickets_sent_at', table_name='push_tickets')
    op.drop_index('ix_push_tickets_expo_ticket_id', table_name='push_tickets')
    op.drop_index('ix_push_tickets_id', table_name='push_tickets')
    op.drop_table('push_tickets')
