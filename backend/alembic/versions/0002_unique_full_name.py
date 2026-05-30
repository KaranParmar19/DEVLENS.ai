"""
DevLens AI — Add unique constraint to full_name
Adds a unique constraint to the repositories.full_name column to allow ON CONFLICT (full_name) DO NOTHING.
"""

from alembic import op
import sqlalchemy as sa

# Alembic migration metadata
revision = "0002_unique_full_name"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add unique constraint to full_name column on repositories table
    op.create_unique_constraint(
        "uq_repositories_full_name",
        "repositories",
        ["full_name"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_repositories_full_name",
        "repositories",
        type_="unique",
    )
