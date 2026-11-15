"""Tests for reverse-proxy client IP extraction and fail-open rate limiting."""

import pytest
from starlette.requests import Request
from starlette.responses import Response

from app.middleware.rate_limit import RateLimitMiddleware


def _make_request(headers: list[tuple[bytes, bytes]] | None = None) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/repos/analyze",
        "headers": headers or [],
        "client": ("10.0.0.5", 12345),
    }
    return Request(scope)


def test_get_client_ip_prefers_cf_then_forwarded_then_socket():
    cf_req = _make_request([
        (b"cf-connecting-ip", b"203.0.113.9"),
        (b"x-forwarded-for", b"198.51.100.1, 10.0.0.1"),
    ])
    assert RateLimitMiddleware._get_client_ip(cf_req) == "203.0.113.9"

    xff_req = _make_request([
        (b"x-forwarded-for", b"198.51.100.7, 10.0.0.1"),
    ])
    assert RateLimitMiddleware._get_client_ip(xff_req) == "198.51.100.7"

    direct_req = _make_request()
    assert RateLimitMiddleware._get_client_ip(direct_req) == "10.0.0.5"


@pytest.mark.asyncio
async def test_rate_limiter_fails_open_when_redis_errors():
    class FailingRedis:
        def pipeline(self):
            raise ConnectionError("redis unreachable")

    middleware = RateLimitMiddleware(app=lambda s, r, se: None, redis_client=FailingRedis())
    req = _make_request()

    async def ok_call_next(_request):
        return Response("ok", status_code=200)

    resp = await middleware.dispatch(req, ok_call_next)
    assert resp.status_code == 200
