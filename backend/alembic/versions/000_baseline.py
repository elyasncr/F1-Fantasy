"""baseline (captures current users + predictions tables)

Revision ID: 000_baseline
Revises:
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = "000_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No-op: tabelas já existem (criadas via Base.metadata.create_all em main.py).
    # Este baseline serve apenas para alembic ter um ponto de partida; migrations
    # subsequentes (Fase 1) partem daqui.
    pass


def downgrade() -> None:
    pass
