"""Tests for provider database URL normalization."""

from app.utils.db_url import normalize_async_database_url


def test_rewrites_postgres_and_postgresql_schemes():
    assert (
        normalize_async_database_url("postgres://user:pass@db.example.com:5432/devlens")
        == "postgresql+asyncpg://user:pass@db.example.com:5432/devlens"
    )
    assert (
        normalize_async_database_url("postgresql://user:pass@db.example.com:5432/devlens")
        == "postgresql+asyncpg://user:pass@db.example.com:5432/devlens"
    )


def test_maps_sslmode_and_strips_channel_binding():
    url = "postgresql://user:pass@ep-cool.neon.tech/neondb?sslmode=require&channel_binding=require"
    assert (
        normalize_async_database_url(url)
        == "postgresql+asyncpg://user:pass@ep-cool.neon.tech/neondb?ssl=require"
    )


def test_preserves_existing_ssl_and_non_postgres_urls():
    sqlite_url = "sqlite+aiosqlite:///:memory:"
    assert normalize_async_database_url(sqlite_url) == sqlite_url

    already_async = "postgresql+asyncpg://user:pass@localhost:5432/devlens?ssl=disable"
    assert normalize_async_database_url(already_async) == already_async
