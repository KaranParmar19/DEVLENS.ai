"""
DevLens AI — Async Database URL Normalization
Translates provider-style Postgres URLs (postgres://, postgresql://, ?sslmode=...)
into asyncpg-compatible SQLAlchemy URLs before engines are initialized.
"""

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_SSLMODE_TO_ASYNCPG = {
    "disable": "disable",
    "allow": "prefer",
    "prefer": "prefer",
    "require": "require",
    "verify-ca": "verify-ca",
    "verify-full": "verify-full",
}


def normalize_async_database_url(url: str) -> str:
    """
    Normalize Postgres connection strings for SQLAlchemy + asyncpg.

    - Rewrites `postgres://` and `postgresql://` schemes to `postgresql+asyncpg://`.
    - Maps libpq `sslmode` query parameters to asyncpg's `ssl` parameter and strips
      unsupported libpq parameters (such as `channel_binding`) so asyncpg.connect()
      does not fail with TypeError.
    - Leaves non-Postgres URLs (e.g. `sqlite+aiosqlite:///...`) untouched.
    """
    stripped = url.strip()
    if not stripped:
        return stripped

    if stripped.startswith("postgres://"):
        stripped = "postgresql+asyncpg://" + stripped[len("postgres://"):]
    elif stripped.startswith("postgresql://"):
        stripped = "postgresql+asyncpg://" + stripped[len("postgresql://"):]
    elif not stripped.startswith("postgresql+asyncpg://"):
        return stripped

    parts = urlsplit(stripped)
    if not parts.query:
        return stripped

    raw_params = parse_qsl(parts.query, keep_blank_values=True)
    has_ssl = any(k == "ssl" for k, _ in raw_params)
    normalized_params: list[tuple[str, str]] = []

    for key, value in raw_params:
        if key == "sslmode":
            if not has_ssl:
                mapped = _SSLMODE_TO_ASYNCPG.get(value.lower())
                if mapped:
                    normalized_params.append(("ssl", mapped))
                    has_ssl = True
            continue
        if key == "channel_binding":
            continue
        normalized_params.append((key, value))

    new_query = urlencode(normalized_params)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))
