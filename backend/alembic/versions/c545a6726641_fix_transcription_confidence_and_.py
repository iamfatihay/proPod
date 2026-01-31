"""fix_transcription_confidence_and_quality_score_to_float

Revision ID: c545a6726641
Revises: e047a6af2eee
Create Date: 2026-01-31 10:57:32.720177

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c545a6726641'
down_revision: Union[str, Sequence[str], None] = 'e047a6af2eee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - SQLite compatible version."""
    # SQLite doesn't support ALTER COLUMN, so we need to recreate the table
    with op.batch_alter_table('podcast_ai_data', schema=None) as batch_op:
        batch_op.alter_column('transcription_confidence',
                   existing_type=sa.VARCHAR(),
                   type_=sa.Float(),
                   existing_nullable=True)
        batch_op.alter_column('quality_score',
                   existing_type=sa.VARCHAR(),
                   type_=sa.Float(),
                   existing_nullable=True)


def downgrade() -> None:
    """Downgrade schema - SQLite compatible version."""
    with op.batch_alter_table('podcast_ai_data', schema=None) as batch_op:
        batch_op.alter_column('quality_score',
                   existing_type=sa.Float(),
                   type_=sa.VARCHAR(),
                   existing_nullable=True)
        batch_op.alter_column('transcription_confidence',
                   existing_type=sa.Float(),
                   type_=sa.VARCHAR(),
                   existing_nullable=True)
