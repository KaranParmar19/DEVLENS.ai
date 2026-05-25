# DevLens AI

> **Intelligent codebase explorer for developers.** Paste any GitHub repo URL → get an interactive architecture map, smart Q&A, and auto-generated onboarding docs — powered by Claude Sonnet + pgvector RAG.

![DevLens AI](https://img.shields.io/badge/stack-FastAPI%20%7C%20LangChain%20%7C%20pgvector%20%7C%20React-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What It Does

| Feature | Description |
|---|---|
| **Architecture Map** | Interactive 2D SVG graph — files as nodes, imports as directed edges. Spring/hierarchical layout computed by NetworkX. |
| **Smart Q&A** | Ask anything about the codebase in natural language. Claude Sonnet answers using RAG over semantically chunked code. |
| **Blast Radius** | "What breaks if I change X?" — BFS on the reverse dependency graph shows impact depth. |
| **Onboarding Doc** | Auto-generated senior-engineer walkthrough: architecture, conventions, critical paths, and "first PR" suggestion. |
| **Export** | One-click Mermaid/PlantUML export of the dependency graph for docs. |

---

## Architecture

```
Frontend (React + Vite → Cloudflare Workers)
    ↕ REST + WebSocket
Backend (FastAPI + Celery → Railway)
    ↕
PostgreSQL + pgvector    Redis (broker + pub/sub)
```

**Key design decisions:**
- **pgvector** instead of ChromaDB — one database, ACID guarantees, SQL joins
- **GitHub Contents API** instead of `git clone` — 10× faster for public repos
- **AST-aware chunking** — Python `ast`, JS/TS regex, generic sliding window
- **Redis pub/sub** for real-time WebSocket progress streaming
- **LangChain ReAct agent** with 4 tools: `search_code`, `read_file`, `query_graph`, `blast_radius`

---

## Quick Start

### Prerequisites
- Docker + Docker Compose
- GitHub OAuth app ([create one](https://github.com/settings/developers))
- OpenAI API key (for embeddings)
- Anthropic API key (for Claude Sonnet)

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/devlens-ai.git
cd devlens-ai
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys
```

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

Services started:
| Service | URL |
|---|---|
| FastAPI backend | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| pgAdmin | http://localhost:5050 |
| Frontend dev server | http://localhost:5173 |

### 3. Run Migrations

```bash
docker-compose exec api alembic upgrade head
```

### 4. Start Frontend

```bash
npm install
npm run dev
```

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for full documentation. Required keys:

```env
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://localhost:6379/0
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
SECRET_KEY=<random 32-char string>
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/repos/analyze` | Submit GitHub repo URL for analysis |
| `GET` | `/api/v1/analysis/{job_id}/status` | Poll job status |
| `WS` | `/ws/jobs/{job_id}` | Real-time progress stream |
| `GET` | `/api/v1/sessions/{id}/graph` | Architecture graph nodes + edges |
| `GET` | `/api/v1/sessions/{id}/files` | File tree, modules, entry points |
| `GET` | `/api/v1/sessions/{id}/onboarding` | Generated onboarding doc (markdown) |
| `POST` | `/api/v1/chat` | REST Q&A |
| `WS` | `/ws/chat/{session_id}` | Streaming Claude responses |
| `GET` | `/api/v1/sessions/{id}/export` | Mermaid/PlantUML export |
| `GET` | `/api/v1/health` | Service health check |

---

## Project Structure

```
DevLensAI/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app + middleware
│   │   ├── config.py        # pydantic-settings env validation
│   │   ├── database.py      # async SQLAlchemy + pgvector
│   │   ├── models/          # User, Repository, AnalysisJob, Session, CodeChunk
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── api/routes/      # health, auth, repos, sessions, analysis, chat
│   │   ├── core/            # github_client, chunker, embedder, graph_builder, repo_ingester
│   │   ├── agent/           # LangChain ReAct agent + 4 tools + prompts
│   │   ├── rag/             # pgvector store + LangChain retriever
│   │   ├── tasks/           # Celery app + repo ingestion task
│   │   └── middleware/      # rate_limit, auth, logging
│   ├── alembic/             # DB migrations
│   └── tests/               # pytest suite
├── src/                     # React frontend
│   ├── components/portal-transform.tsx  # Main dashboard UI
│   ├── hooks/useAnalysis.ts # WebSocket analysis flow
│   ├── hooks/useChat.ts     # WebSocket chat streaming
│   └── lib/api.ts           # Typed API client
├── docker-compose.yml
└── .github/workflows/       # CI + deploy
```

---

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v --cov=app --cov-report=term-missing
```

---

## Deployment

- **Backend** → Railway (auto-deploys on `main` merge via GitHub Actions)
- **Frontend** → Cloudflare Workers (via `wrangler deploy`)

See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) for the full pipeline.

Required GitHub Secrets:
```
RAILWAY_TOKEN
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
PRODUCTION_DATABASE_URL
PRODUCTION_API_URL
PRODUCTION_WS_URL
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TanStack Router, TypeScript |
| Deployment | Cloudflare Workers |
| Backend | FastAPI 0.115, Python 3.11 |
| AI | Claude Sonnet (`claude-sonnet-4-5`) via LangChain |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) |
| Vector DB | pgvector (PostgreSQL extension) |
| ORM | SQLAlchemy 2.x async + Alembic |
| Queue | Celery + Redis |
| Auth | GitHub OAuth + API key |

---

## License

MIT
