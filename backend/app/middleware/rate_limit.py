"""
DevLens AI — Redis Sliding Window Rate Limiter
Implements per-IP and per-API-key rate limiting using Redis sorted sets.

Algorithm: Sliding window (ZRANGEBYSCORE / ZADD / ZREMRANGEBYSCORE)
  - Each request adds a timestamped entry to a Redis sorted set.
  - Entries older than the window are pruned on each request.
  - If the count exceeds the limit → 429 Too Many Requests.

Limits (configurable via settings):
  - 60 requests/minute per IP
  - 300 requests/minute per API key
"""

import time
import uuid
import structlog
import redis.asyncio as aioredis

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

log = structlog.get_logger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Sliding window rate limiter backed by Redis sorted sets.

    Checks two limits in order:
    1. Per-IP:      60 req/min  (protects against anonymous floods)
    2. Per-API-Key: 300 req/min (more generous for authenticated clients)

    If either limit is exceeded, returns 429 with Retry-After header.
    """

    def __init__(
        self,
        app: ASGIApp,
        redis_client: aioredis.Redis,
        ip_limit: int = 60,
        key_limit: int = 300,
        window_seconds: int = 60,
    ) -> None:
        super().__init__(app)
        self.redis = redis_client
        self.ip_limit = ip_limit
        self.key_limit = key_limit
        self.window = window_seconds

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limiting on health checks
        if request.url.path in ("/api/v1/health", "/"):
            return await call_next(request)

        now = time.time()
        window_start = now - self.window

        # ── Per-IP check ─────────────────────────────────────────────────────
        ip = request.client.host if request.client else "unknown"
        ip_key = f"rl:ip:{ip}"
        ip_count = await self._sliding_window(ip_key, now, window_start)

        if ip_count > self.ip_limit:
            log.warning("rate_limit_exceeded", scope="ip", ip=ip, count=ip_count)
            return Response(
                content=f"Rate limit exceeded: {self.ip_limit} req/min per IP",
                status_code=429,
                headers={
                    "Retry-After": str(self.window),
                    "X-RateLimit-Limit": str(self.ip_limit),
                    "X-RateLimit-Remaining": "0",
                },
            )

        # ── Per-API-Key check ─────────────────────────────────────────────────
        api_key = request.headers.get("X-API-Key")
        if api_key:
            key_bucket = f"rl:key:{api_key[:16]}"  # prefix only, don't store full key
            key_count = await self._sliding_window(key_bucket, now, window_start)

            if key_count > self.key_limit:
                log.warning(
                    "rate_limit_exceeded",
                    scope="api_key",
                    key_prefix=api_key[:8],
                    count=key_count,
                )
                return Response(
                    content=f"Rate limit exceeded: {self.key_limit} req/min per API key",
                    status_code=429,
                    headers={
                        "Retry-After": str(self.window),
                        "X-RateLimit-Limit": str(self.key_limit),
                        "X-RateLimit-Remaining": "0",
                    },
                )

        response = await call_next(request)
        return response

    async def _sliding_window(
        self, key: str, now: float, window_start: float
    ) -> int:
        """
        Atomically update the sliding window and return the current count.

        Operations (pipelined for atomicity):
        1. Remove entries older than window_start
        2. Add current request with timestamp as score
        3. Count entries in the window
        4. Set TTL on the key (auto-cleanup)
        """
        member = str(uuid.uuid4())  # unique member per request
        pipe = self.redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {member: now})
        pipe.zcard(key)
        pipe.expire(key, int(self.window * 2))  # cleanup headroom
        results = await pipe.execute()
        return results[2]  # zcard result
