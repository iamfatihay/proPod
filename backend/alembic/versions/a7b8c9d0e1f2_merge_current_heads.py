"""merge current heads

Revision ID: a7b8c9d0e1f2
Revises: 9c5c8d72c3f1, c1d2e3f4a5b6, f8a9c1d2e3b4
Create Date: 2026-05-11 15:10:00.000000

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = ('9c5c8d72c3f1', 'c1d2e3f4a5b6', 'f8a9c1d2e3b4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass