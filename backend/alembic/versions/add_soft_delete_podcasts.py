"""Add soft delete fields to podcasts table

Revision ID: add_soft_delete_podcasts
Revises: 
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_soft_delete_podcasts'
down_revision = None  # Update this with the latest migration ID
branch_labels = None
depends_on = None


def upgrade():
    """Add is_deleted and deleted_at columns to podcasts table."""
    # Add is_deleted column (boolean, default False, indexed)
    op.add_column('podcasts', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='0'))
    
    # Add deleted_at column (datetime, nullable)
    op.add_column('podcasts', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    
    # Create index on is_deleted for query performance
    op.create_index('ix_podcasts_is_deleted', 'podcasts', ['is_deleted'])


def downgrade():
    """Remove soft delete columns from podcasts table."""
    # Drop index
    op.drop_index('ix_podcasts_is_deleted', table_name='podcasts')
    
    # Drop columns
    op.drop_column('podcasts', 'deleted_at')
    op.drop_column('podcasts', 'is_deleted')
