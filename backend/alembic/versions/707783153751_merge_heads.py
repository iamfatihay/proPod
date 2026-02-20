"""merge heads

Revision ID: 707783153751
Revises: 8be1dbe47bbb, b6f1c2a9e9f1
Create Date: 2026-02-15 23:54:06.325611

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '707783153751'
down_revision: Union[str, Sequence[str], None] = ('8be1dbe47bbb', 'b6f1c2a9e9f1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
