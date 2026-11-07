"""
DevLens AI - Drop orphan repostatus enum type and reconcile stuck indexing rows
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_drop_orphan_repostatus"
down_revision = "0003_code_chunks_unique"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE repositories
        SET status = 'failed'
        WHERE status = 'indexing'
          AND indexed_at IS NULL
          AND file_count = 0;
        """
    )
    op.execute("DROP TYPE IF EXISTS repostatus;")


def downgrade() -> None:
    op.execute(
        "CREATE TYPE repostatus AS ENUM ('PENDING', 'INDEXING', 'READY', 'FAILED', 'STALE');"
    )
