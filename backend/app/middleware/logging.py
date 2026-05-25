"""
DevLens AI — Structlog Request/Response Logging Middleware
Attaches a unique X-Request-ID to every request and logs
method, path, status code, and duration as structured JSON.
"""

import time
import uuid
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = structlog.get_logger(__name__)


def configure_structlog(debug: bool = False) -> None:
    """
    Call once at startup to configure structlog's global processor chain.
    In debug mode: colourful console output.
    In production: JSON lines for log aggregators (Datadog, Loki, etc.).
    """
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if debug:
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(colors=True)
        ]
    else:
        processors = shared_processors + [
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(0),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


class StructlogMiddleware(BaseHTTPMiddleware):
    """Adds request ID and logs each HTTP request with timing."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())

        # Bind request context so all downstream logs include these fields
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )

        start = time.perf_counter()
        try:
            response = await call_next(request)
            elapsed_ms = (time.perf_counter() - start) * 1000

            logger.info(
                "request_completed",
                status_code=response.status_code,
                duration_ms=round(elapsed_ms, 2),
            )

            # Surface the request ID in the response headers for debugging
            response.headers["X-Request-ID"] = request_id
            return response

        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.exception("request_failed", duration_ms=round(elapsed_ms, 2))
            raise
