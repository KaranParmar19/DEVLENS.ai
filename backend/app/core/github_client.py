"""
DevLens AI — GitHub API Client
Async wrapper around the GitHub REST API v3.
Handles rate limiting, pagination, auth, and repo size validation.

Strategy: Use GitHub Git Trees API for the file tree (one call, recursive)
          then fetch individual files via Contents API (bounded concurrency).

BUG-01 FIX: iter_repo_files no longer internally re-fetches the file tree.
            Caller passes size_map so we avoid a duplicate API call.
"""

import asyncio
import base64
import re
import structlog
from dataclasses import dataclass, field
from typing import AsyncIterator

import httpx

from app.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

GITHUB_API_BASE = "https://api.github.com"

# Back-off delays for rate-limit retries (seconds)
_RATE_LIMIT_DELAYS = [30, 60, 120]


@dataclass
class RepoMeta:
    """Parsed GitHub repository metadata."""
    github_id: int
    owner: str
    name: str
    full_name: str
    description: str | None
    url: str
    is_private: bool
    stars: int
    forks: int
    default_branch: str
    size_kb: int
    languages: dict[str, int]   # {"TypeScript": 62, ...} as percentages
    latest_commit_sha: str


@dataclass
class RepoFile:
    """A single file fetched from the GitHub Contents API."""
    path: str
    size_bytes: int
    content: str           # Decoded UTF-8 content
    language: str = ""     # Populated by language_detector


class GitHubClient:
    """
    Async GitHub API client.
    Uses httpx.AsyncClient for connection pooling.
    Caller is responsible for using this as an async context manager.
    """

    def __init__(self, user_token: str | None = None):
        """
        user_token: GitHub OAuth token from an authenticated user (for private repos).
        Falls back to the global GITHUB_API_TOKEN setting, then unauthenticated.
        """
        token = user_token or settings.github_api_token or None
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"

        self._client = httpx.AsyncClient(
            base_url=GITHUB_API_BASE,
            headers=headers,
            timeout=httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=5.0),
            follow_redirects=True,
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self._client.aclose()

    # ── Core Request ───────────────────────────────────────────────────────

    async def _get(self, path: str, **params) -> dict | list:
        """
        Make a GET request.
        Handles rate limiting (403/429) with exponential back-off.
        Raises httpx.HTTPStatusError for non-transient errors.
        """
        delays = iter(_RATE_LIMIT_DELAYS)
        while True:
            resp = await self._client.get(path, params=params or None)

            # Primary rate limit (unauthenticated: 60/hr; authenticated: 5000/hr)
            if resp.status_code in (403, 429):
                body_lower = resp.text.lower()
                if "rate limit" in body_lower or resp.status_code == 429:
                    # Check GitHub's Retry-After or x-ratelimit-reset headers
                    retry_after = resp.headers.get("Retry-After")
                    reset_ts = resp.headers.get("x-ratelimit-reset")
                    if retry_after:
                        wait = int(retry_after)
                    elif reset_ts:
                        import time
                        wait = max(0, int(reset_ts) - int(time.time())) + 2
                    else:
                        try:
                            wait = next(delays)
                        except StopIteration:
                            raise RuntimeError(
                                f"GitHub rate limit exceeded after all retries for {path}"
                            )
                    logger.warning("github_rate_limited", path=path, wait_seconds=wait)
                    await asyncio.sleep(wait)
                    continue

            resp.raise_for_status()
            return resp.json()

    # ── Repo Metadata ──────────────────────────────────────────────────────

    async def get_repo_meta(self, owner: str, name: str) -> RepoMeta:
        """Fetch repository metadata and language breakdown."""
        data = await self._get(f"/repos/{owner}/{name}")

        # Get language percentages (bytes per language → percent)
        lang_raw: dict = await self._get(f"/repos/{owner}/{name}/languages")
        total_bytes = sum(lang_raw.values()) or 1
        languages = {
            lang: round(bytes_ / total_bytes * 100)
            for lang, bytes_ in sorted(lang_raw.items(), key=lambda x: -x[1])
        }

        # Get latest commit SHA on the repo's real default branch
        branch = data.get("default_branch", "main")
        try:
            branch_data = await self._get(f"/repos/{owner}/{name}/branches/{branch}")
            commit_sha = branch_data["commit"]["sha"]
        except Exception:
            commit_sha = "unknown"

        return RepoMeta(
            github_id=data["id"],
            owner=data["owner"]["login"],
            name=data["name"],
            full_name=data["full_name"],
            description=data.get("description"),
            url=data["html_url"],
            is_private=data["private"],
            stars=data.get("stargazers_count", 0),
            forks=data.get("forks_count", 0),
            default_branch=branch,
            size_kb=data.get("size", 0),
            languages=languages,
            latest_commit_sha=commit_sha,
        )

    # ── File Tree (recursive, via Git Trees API) ───────────────────────────

    async def get_file_tree(
        self, owner: str, name: str, branch: str
    ) -> list[dict]:
        """
        Fetch the full recursive file tree using the Git Trees API.
        This single API call returns ALL paths — no pagination needed.
        Returns only blob (file) entries, not trees/dirs.

        Also returns a size_map {path: size_bytes} for the caller to use
        so they don't need to re-fetch the tree.
        """
        data = await self._get(
            f"/repos/{owner}/{name}/git/trees/{branch}",
            recursive=1,
        )

        if data.get("truncated"):
            logger.warning(
                "git_tree_truncated",
                repo=f"{owner}/{name}",
                message="Repo has >100k files; tree is incomplete.",
            )

        # Return only file entries (not trees/dirs)
        return [item for item in data.get("tree", []) if item["type"] == "blob"]

    # ── File Content ───────────────────────────────────────────────────────

    async def get_file_content(
        self, owner: str, name: str, path: str, branch: str
    ) -> str | None:
        """
        Fetch a single file's content via Contents API.
        Returns decoded UTF-8 string, or None if binary/too large/not found.
        """
        try:
            data = await self._get(
                f"/repos/{owner}/{name}/contents/{path}",
                ref=branch,
            )
            if isinstance(data, list):
                return None  # It's a directory
            if data.get("encoding") != "base64":
                return None
            raw = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            return raw
        except (httpx.HTTPStatusError, UnicodeDecodeError, Exception) as exc:
            logger.debug("file_fetch_skipped", path=path, reason=str(exc))
            return None

    # ── Batch File Fetcher (BUG-01 FIXED) ─────────────────────────────────

    async def iter_repo_files(
        self,
        owner: str,
        name: str,
        branch: str,
        allowed_paths: list[str],
        size_map: dict[str, int],          # ← NEW: pre-built from get_file_tree
        concurrency: int = 10,
    ) -> AsyncIterator[RepoFile]:
        """
        Fetch multiple files concurrently (bounded by semaphore).
        Yields RepoFile objects as they complete.

        BUG-01 FIX: size_map is now passed in by the caller.
        We no longer call get_file_tree() internally, avoiding
        a duplicate API call that could exhaust rate limits.
        """
        semaphore = asyncio.Semaphore(concurrency)

        async def fetch_one(path: str, size_bytes: int) -> RepoFile | None:
            async with semaphore:
                content = await self.get_file_content(owner, name, path, branch)
                if content is None:
                    return None
                return RepoFile(path=path, size_bytes=size_bytes, content=content)

        tasks = [
            fetch_one(path, size_map.get(path, 0))
            for path in allowed_paths
        ]

        for coro in asyncio.as_completed(tasks):
            result = await coro
            if result:
                yield result


def parse_github_url(url: str) -> tuple[str, str]:
    """
    Extract (owner, repo_name) from a GitHub URL.
    Handles:
      https://github.com/org/repo
      https://github.com/org/repo.git
      github.com/org/repo
      org/repo
    """
    url = url.strip().rstrip("/")
    # Match: optional protocol + optional github.com/ + owner/name
    match = re.match(r"(?:https?://)?(?:www\.)?github\.com/([^/]+)/([^/]+)", url)
    if match:
        return match.group(1), match.group(2).removesuffix(".git")
    # Bare "owner/repo" format
    parts = url.split("/")
    if len(parts) == 2:
        return parts[0], parts[1]
    raise ValueError(f"Cannot parse GitHub URL: {url!r}")
