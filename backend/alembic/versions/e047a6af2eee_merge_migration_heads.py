"""merge_migration_heads

Revision ID: e047a6af2eee
Revises: 3dd09391d55b, add_soft_delete_podcasts
Create Date: 2026-01-30 00:02:58.801783

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e047a6af2eee'
down_revision: Union[str, Sequence[str], None] = ('3dd09391d55b', 'add_soft_delete_podcasts')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
