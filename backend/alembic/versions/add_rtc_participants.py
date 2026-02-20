"""Alembic migration: Add participant tracking and live status to RTC sessions."""
# Migration generated manually - run: alembic revision --autogenerate -m "Add RTC participants and live status"

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # Add live status tracking
    op.add_column('rtc_sessions', sa.Column('is_live', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('rtc_sessions', sa.Column('started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('rtc_sessions', sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('rtc_sessions', sa.Column('participant_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('rtc_sessions', sa.Column('viewer_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('rtc_sessions', sa.Column('invite_code', sa.String(length=12), nullable=True, unique=True))
    
    # Create index for live session queries
    op.create_index('idx_rtc_sessions_live', 'rtc_sessions', ['is_live', 'is_public', 'created_at'])
    
    # Create participants table
    op.create_table(
        'rtc_participants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),  # Nullable for anonymous viewers
        sa.Column('peer_id', sa.String(), nullable=False),  # 100ms peer ID
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),  # host, guest, viewer
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('left_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('connection_quality', sa.String(), nullable=True),  # poor, fair, good, excellent
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['session_id'], ['rtc_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_rtc_participants_session', 'rtc_participants', ['session_id', 'is_active'])
    op.create_index('idx_rtc_participants_user', 'rtc_participants', ['user_id'])

def downgrade():
    op.drop_index('idx_rtc_participants_user', table_name='rtc_participants')
    op.drop_index('idx_rtc_participants_session', table_name='rtc_participants')
    op.drop_table('rtc_participants')
    op.drop_index('idx_rtc_sessions_live', table_name='rtc_sessions')
    op.drop_column('rtc_sessions', 'invite_code')
    op.drop_column('rtc_sessions', 'viewer_count')
    op.drop_column('rtc_sessions', 'participant_count')
    op.drop_column('rtc_sessions', 'ended_at')
    op.drop_column('rtc_sessions', 'started_at')
    op.drop_column('rtc_sessions', 'is_live')
