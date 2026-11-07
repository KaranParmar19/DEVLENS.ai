"""
DevLens AI - Purge legacy uniform random fallback embeddings and sync search_mode
"""

from alembic import op

revision = "0006_purge_legacy_embeddings"
down_revision = "0005_repo_embedding_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Clear fake random vectors (L2 norm ~2.2627 from pre-a8203ff uniform fallback)
    op.execute(
        """
        UPDATE code_chunks c
        SET embedding = NULL
        FROM repositories r
        WHERE c.repo_id = r.id
          AND r.embedding_model = 'legacy-fallback-uniform-1536';
        """
    )

    # 2. Clear embedding_model and embedding_dimensions on repos that had fake vectors
    op.execute(
        """
        UPDATE repositories
        SET embedding_model = NULL,
            embedding_dimensions = NULL
        WHERE embedding_model = 'legacy-fallback-uniform-1536';
        """
    )

    # 3. Ensure graph_cache->'meta'->>'search_mode' reflects real embedding presence
    op.execute(
        """
        UPDATE repositories
        SET graph_cache = jsonb_set(
            COALESCE(graph_cache, '{}'::jsonb),
            '{meta,search_mode}',
            CASE
                WHEN embedding_model IS NOT NULL THEN '"semantic"'::jsonb
                ELSE '"keyword"'::jsonb
            END,
            true
        )
        WHERE graph_cache IS NOT NULL AND jsonb_typeof(graph_cache) = 'object';
        """
    )


def downgrade() -> None:
    pass
