"""
DevLens AI — Application Configuration
All settings are loaded from environment variables (via .env file).
Pydantic-settings validates types and raises descriptive errors on startup
if required variables are missing — no more runtime KeyError surprises.
"""

from functools import lru_cache
from typing import List
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central configuration object. All values come from environment variables.
    Missing required variables cause a clear startup error.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignore unknown env vars gracefully
    )

    # ── Application ────────────────────────────────────────────────────────
    app_name: str = "DevLens AI"
    app_version: str = "1.0.0"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # ── Security ───────────────────────────────────────────────────────────
    api_key: str                          # Required — X-API-Key header
    secret_key: str                       # Required — JWT signing secret

    # ── Database ───────────────────────────────────────────────────────────
    database_url: str                     # Required — postgresql+asyncpg://...

    # ── Redis ──────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── OpenAI (Embeddings + Chat) ─────────────────────────────────────────
    openai_api_key: str                   # Required — used for both embeddings and chat
    openai_embedding_model: str = "text-embedding-3-small"
    openai_embedding_dimensions: int = 1536
    openai_chat_model: str = "gpt-4o"     # Chat model (gpt-4o / gpt-4o-mini)

    # ── GitHub OAuth ───────────────────────────────────────────────────────
    github_client_id: str                 # Required
    github_client_secret: str            # Required
    github_redirect_uri: str             # Required
    github_api_token: str = ""           # Optional: raises rate limit to 5000/hr

    # ── Ingestion Limits ───────────────────────────────────────────────────
    max_repo_size_mb: int = 500
    max_file_count: int = 5000
    max_file_size_kb: int = 500          # Skip files larger than this
    ingestion_timeout_seconds: int = 300

    # ── CORS ───────────────────────────────────────────────────────────────
    frontend_url: str = "http://localhost:8081"
    cors_origins: List[str] | str = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:8081",
    ]

    # ── Rate Limiting ──────────────────────────────────────────────────────
    rate_limit_per_minute: int = 60
    rate_limit_analyze_per_hour: int = 10

    # ── Derived Properties ─────────────────────────────────────────────────
    @property
    def github_auth_headers(self) -> dict:
        """Returns headers for GitHub API calls, with token if available."""
        headers = {"Accept": "application/vnd.github.v3+json"}
        if self.github_api_token:
            headers["Authorization"] = f"Bearer {self.github_api_token}"
        return headers

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Allow CORS_ORIGINS to be a comma-separated string in .env."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


@lru_cache()
def get_settings() -> Settings:
    """
    Cached settings singleton. Using lru_cache means .env is parsed once.
    In tests, call get_settings.cache_clear() to reload.
    """
    return Settings()
