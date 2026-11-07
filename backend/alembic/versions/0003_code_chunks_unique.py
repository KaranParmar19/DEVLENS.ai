"""
DevLens AI — Add unique constraint on (repo_id, file_path, chunk_index)
Prevents duplicate chunks from repeated or concurrent ingestion runs.
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_code_chunks_unique"
down_revision = "0002_unique_full_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove existing duplicate chunks if any before applying unique constraint
    op.execute(
        """
        DELETE FROM code_chunks a USING code_chunks b
        WHERE a.ctid < b.ctid
          AND a.repo_id = b.repo_id
          AND a.file_path = b.file_path
          AND a.chunk_index = b.chunk_index;
        """
    )
    op.create_unique_constraint(
        "uq_code_chunks_repo_file_chunk",
        "code_chunks",
        ["repo_id", "file_path", "chunk_index"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_code_chunks_repo_file_chunk",
        "code_chunks",
        type_="unique",
    )
