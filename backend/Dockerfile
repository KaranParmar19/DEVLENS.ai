# ============================================================
# DevLens AI — Multi-stage Dockerfile
# Stage 1 (builder): installs all deps
# Stage 2 (development): includes dev tools + hot reload
# Stage 3 (production): minimal, non-root runtime image
# ============================================================

# ── Base: Python 3.11 slim ──────────────────────────────────
FROM python:3.11-slim AS base

WORKDIR /app

# System dependencies needed by psycopg2, cryptography, gitpython
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Builder: install Python dependencies ───────────────────
FROM base AS builder

COPY requirements.txt .

RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Development: hot reload, full deps ─────────────────────
FROM base AS development

COPY --from=builder /install /usr/local
COPY . .

# Create non-root user (still dev-friendly)
RUN useradd -m -u 1001 devlens && chown -R devlens:devlens /app
USER devlens

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ── Production: minimal, hardened ──────────────────────────
FROM python:3.11-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY . .

# Non-root user for security
RUN useradd -m -u 1001 devlens \
    && chown -R devlens:devlens /app \
    && mkdir -p /tmp/repos && chown devlens:devlens /tmp/repos

USER devlens

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "2", "--no-access-log"]
