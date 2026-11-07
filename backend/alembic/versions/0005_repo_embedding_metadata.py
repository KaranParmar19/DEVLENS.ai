"""
DevLens AI - Add embedding_model and embedding_dimensions to repositories
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_repo_embedding_metadata"
down_revision = "0004_drop_orphan_repostatus"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("repositories", sa.Column("embedding_model", sa.String(length=100), nullable=True))
    op.add_column("repositories", sa.Column("embedding_dimensions", sa.Integer(), nullable=True))

    # Backfill existing repositories based on stored chunk vectors
    op.execute(
        """
        UPDATE repositories r
        SET embedding_dimensions = sub.dim,
            embedding_model = CASE
                WHEN sub.avg_norm < 1.5 THEN 'gemini-embedding-001'
                ELSE 'legacy-fallback-uniform-1536'
            END
        FROM (
            SELECT repo_id,
                   MAX(vector_dims(embedding)) AS dim,
                   AVG(vector_norm(embedding)) AS avg_norm
            FROM code_chunks
            WHERE embedding IS NOT NULL
            GROUP BY repo_id
        ) sub
        WHERE r.id = sub.repo_id;
        """
    )


def downgrade() -> None:
    op.drop_column("repositories", "embedding_dimensions")
    op.drop_column("repositories", "embedding_model")
