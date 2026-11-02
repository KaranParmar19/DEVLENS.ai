# DevLens AI

> An intelligent cognitive layer for software codebases. Ingest any GitHub repository to generate interactive dependency graphs, blast-radius impact analysis, and AST-grounded code intelligence.

**Live Deployment:** [devlens-ai.kp5336464.workers.dev](https://devlens-ai.kp5336464.workers.dev/)

[![Live Deployment](https://img.shields.io/badge/Live_Deployment-Cloudflare_Workers-F38020.svg?style=flat-square&logo=cloudflare&logoColor=white)](https://devlens-ai.kp5336464.workers.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg?style=flat-square)](LICENSE)
[![Python: 3.11](https://img.shields.io/badge/Python-3.11-3776AB.svg?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI: 0.115](https://img.shields.io/badge/FastAPI-0.115-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React: 19](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript: 5.x](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Database: PostgreSQL + pgvector](https://img.shields.io/badge/Database-PostgreSQL_%2B_pgvector-4169E1.svg?style=flat-square&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Task Queue: Celery + Redis](https://img.shields.io/badge/Queue-Celery_%2B_Redis-DC382D.svg?style=flat-square&logo=redis&logoColor=white)](https://redis.io)

---

## Overview

Reading an unfamiliar codebase usually means manually chasing imports across files, reading stale wikis, and guessing downstream consequences before refactoring.

DevLens provides an automated cognitive layer over any public or private GitHub repository. By parsing source files with Abstract Syntax Tree (AST) analyzers, constructing directed dependency graphs with NetworkX, and vectorizing semantically chunked code into `pgvector`, DevLens answers architectural questions with verified line-level code citations.

---

## Core Capabilities

### 1. Interactive 2D Architecture Map
- Renders modules as nodes and import relationships as directed edges on an interactive canvas.
- Applies the Fruchterman-Reingold spring algorithm to compute clean topological layouts.
- Computes coupling scores, complexity metrics, and automatically identifies entry point candidates.
- Supports instant export to Mermaid and PlantUML formats.

### 2. Blast Radius Impact Analysis
- Answers: *"What breaks if I modify this file?"*
- Executes a Breadth-First Search (BFS) traversal across the reverse dependency graph to identify all transitive downstream dependents.
- Highlights affected files and downstream execution paths before you touch a line of code.

### 3. AST-Grounded Code Q&A
- Multi-step LangChain ReAct agent combined with GPT-4o.
- Equipped with four dedicated tools: `search_code`, `read_file`, `query_graph`, and `blast_radius`.
- Every answer cites the exact file path and line numbers used to synthesize the response.

### 4. Automated Architecture Dossiers
- Generates structured engineering walkthroughs for onboarding.
- Details entry points, configuration layers, data access patterns, and architectural boundaries.
- Replaces outdated documentation with real-time analysis generated directly from the current commit hash.

### 5. Multi-Language AST Support
- Deep syntax tree parsing across 8 major languages: TypeScript, JavaScript, Python, Go, Java, Rust, Ruby, and PHP.
- Python chunking via the native `ast` module; TypeScript and JavaScript parsed with scope and bracket depth resolution.

### 6. Ephemeral Indexing Security
- Repositories clone into isolated temporary environments for parsing and are completely deleted when indexing completes.
- No repository source code is retained on disk.

---

## Architecture

DevLens uses a decoupled architecture with a high-performance Python backend and a typed full-stack React frontend:

```mermaid
flowchart TD
    subgraph Client["Client Tier"]
        UI["React 19 + TanStack Start UI"]
    end

    subgraph Gateway["API Gateway"]
        API["FastAPI Application Server"]
        WS["WebSocket Event Hub"]
    end

    subgraph WorkerTier["Async Ingestion Tier"]
        Redis["Redis (Broker & Pub/Sub)"]
        Celery["Celery Worker Pool"]
        Chunker["AST Chunker (Python AST / TS Parser)"]
        GraphEngine["NetworkX Graph Engine"]
    end

    subgraph StorageTier["Data & Vector Tier"]
        PG[("PostgreSQL 16")]
        Vector[("pgvector Extension (1536-dim)")]
    end

    subgraph External["External Services"]
        GitHub["GitHub Contents & Trees API"]
        LLM["OpenAI API (GPT-4o & text-embedding-3-small)"]
    end

    UI <-->|"REST & Real-time WebSockets"| API
    API <--> WS
    API -->|"Push Ingestion Tasks"| Redis
    Redis --> Celery
    Celery -->|"Fetch Trees & Blobs"| GitHub
    Celery --> Chunker
    Chunker -->|"Batch Embeddings"| LLM
    Celery -->|"Upsert Chunks & Vectors"| Vector
    Celery --> GraphEngine
    GraphEngine -->|"Store Graph JSON"| PG
    Celery -->|"Stream Progress Events"| Redis
    Redis -->|"Pub/Sub Relay"| WS
    API <-->|"Query Chunks & Sessions"| PG
```

### Agent Tool Execution Flow

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant WS as WebSocket Hub
    participant Agent as LangChain ReAct Agent
    participant Graph as NetworkX Graph Tool
    participant Blast as Blast Radius Tool
    participant RAG as pgvector Search Tool

    Dev->>WS: "What files depend on auth.ts and what breaks if I change it?"
    WS->>Agent: Dispatch query to ReAct runner
    Agent->>Blast: blast_radius("src/auth.ts")
    Blast-->>Agent: Downstream dependent file list
    Agent->>Graph: query_graph("src/auth.ts")
    Graph-->>Agent: Direct imports and coupling metrics
    Agent->>RAG: similarity_search("authentication session verification")
    RAG-->>Agent: Matching source code chunks with line ranges
    Agent->>WS: Stream synthesized response with file citations
    WS->>Dev: Render markdown response and highlight graph nodes
```

---

## Technology Stack

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, TypeScript, TanStack Start | Fast, type-safe full-stack interface with client routing |
| **Styling** | Tailwind CSS v4, Custom Monoform Design System | Minimalist typography, dark mode tokens, and fluid layout |
| **Backend API** | FastAPI 0.115, Python 3.11, Uvicorn | Asynchronous REST endpoints and streaming WebSocket hubs |
| **Task Queue** | Celery 5.x, Redis 7 (Alpine) | Distributed background workers for repository ingestion |
| **Relational DB** | PostgreSQL 16, SQLAlchemy 2 (Async), Alembic | Transactional storage for repositories, jobs, and chat sessions |
| **Vector Index** | `pgvector` extension | 1536-dimensional cosine vector indexing for semantic search |
| **AI & LLM** | LangChain ReAct, OpenAI GPT-4o | Autonomous multi-tool code reasoning and citation generation |
| **Embeddings** | OpenAI `text-embedding-3-small` | Token-efficient code chunk vectorization (1536 dimensions) |
| **Graph Analysis**| NetworkX (Python) | Directed import graphs and Fruchterman-Reingold layout generation |

---

## Live Demo & Deployment

- **Production URL:** [https://devlens-ai.kp5336464.workers.dev/](https://devlens-ai.kp5336464.workers.dev/)
- **Infrastructure:** Deployed on Cloudflare Workers (SSR) and Pages (Global Edge CDN)
- **Status:** Live

---

## Quickstart

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) (v20+ recommended)
- OpenAI API Key (powers embeddings and code reasoning)

### Option 1: Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/KaranParmar19/DEVLENS.ai.git
   cd DEVLENS.ai
   ```

2. **Configure environment variables:**
   ```bash
   cp backend/.env.example backend/.env
   ```
   Open `backend/.env` and supply your `OPENAI_API_KEY`.

3. **Start the backend stack:**
   ```bash
   docker-compose up --build
   ```
   This spins up:
   - PostgreSQL with `pgvector` on port `5432`
   - Redis on port `6379`
   - FastAPI backend on port `8000`
   - Celery background worker

4. **Run database migrations:**
   ```bash
   docker-compose exec api alembic upgrade head
   ```

5. **Start the frontend:**
   In a separate terminal:
   ```bash
   npm install
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### Option 2: Local Manual Setup

#### Backend Setup

1. **Navigate to backend and create a virtual environment:**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL, Redis, and OpenAI credentials
   ```

4. **Apply database migrations:**
   ```bash
   alembic upgrade head
   ```

5. **Start Redis and Celery worker:**
   ```bash
   # Terminal 1: Celery worker
   celery -A app.tasks.celery_app worker --loglevel=info -Q ingestion
   ```

6. **Start the FastAPI server:**
   ```bash
   # Terminal 2: FastAPI application
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   Interactive Swagger documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

#### Frontend Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Vite development server:**
   ```bash
   npm run dev
   ```

---

## Environment Configuration

Key configuration parameters inside `backend/.env`:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | Async connection string for PostgreSQL | `postgresql+asyncpg://devlens:devlens_password@localhost:5432/devlens` |
| `REDIS_URL` | Redis instance for broker and pub/sub | `redis://localhost:6379/0` |
| `OPENAI_API_KEY` | OpenAI API authentication key | `sk-...` |
| `OPENAI_CHAT_MODEL` | LLM model for conversational agent | `gpt-4o` (or `gpt-4o-mini`) |
| `OPENAI_EMBEDDING_MODEL` | Vector embedding model | `text-embedding-3-small` |
| `OPENAI_MAX_CHUNKS_PER_INGESTION`| Maximum chunk budget per repo | `10000` |
| `MAX_REPO_SIZE_MB` | Maximum repository size allowed for indexing | `500` |
| `GITHUB_API_TOKEN` | Optional GitHub PAT for higher API rate limits | Unauthenticated (60 req/hr) or PAT (5000 req/hr) |
| `FRONTEND_URL` | Client application origin | `http://localhost:5173` |

---

## Database Schema

```mermaid
erDiagram
    repositories ||--o{ code_chunks : contains
    repositories ||--o{ sessions : tracks

    repositories {
        uuid id PK
        string owner
        string name
        int stars
        string default_branch
        string commit_sha
        jsonb languages
        boolean is_monorepo
        jsonb graph_data
        enum status
        timestamp created_at
    }

    code_chunks {
        uuid id PK
        uuid repo_id FK
        string file_path
        string language
        text content
        int token_count
        string chunk_type
        string symbol_name
        int start_line
        int end_line
        vector embedding
    }

    sessions {
        uuid id PK
        uuid repo_id FK
        jsonb chat_history
        timestamp created_at
    }
```

---

## API Specifications

### REST Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/repos/analyze` | Initiates background repository ingestion; returns `job_id` |
| `GET` | `/api/v1/repos/{owner}/{name}` | Retrieves indexed metadata, file tree, and graph data |
| `GET` | `/api/v1/repos/{owner}/{name}/graph` | Returns nodes, directed edges, and spring layout coordinates |
| `POST` | `/api/v1/repos/{owner}/{name}/blast-radius`| Computes downstream impact paths for a given file path |
| `GET` | `/api/v1/health` | System health check (database, redis connectivity) |

### WebSocket Endpoints

| Protocol | Endpoint | Role |
| :--- | :--- | :--- |
| `WSS` | `/ws/jobs/{job_id}` | Streams real-time ingestion progress (file parsing, chunking, graph generation) |
| `WSS` | `/ws/chat/{session_id}` | Bidirectional streaming for conversational agent Q&A with line citations |

---

## Development & Verification

### Run Frontend Quality Checks
```bash
# Typecheck
npx tsc --noEmit

# Unit & component tests
npm test

# Production build test
npm run build

# Code style
npm run lint
```

### Run Backend Tests
```bash
cd backend
pytest tests/ -v
```

---

## Project Structure

```
DevLensAI/
├── backend/
│   ├── alembic/                # Database migrations
│   ├── app/
│   │   ├── agent/              # LangChain ReAct agent & 4 custom tools
│   │   ├── core/               # AST chunker, graph builder, file utils
│   │   ├── models/             # SQLAlchemy ORM models (pgvector)
│   │   ├── routes/             # FastAPI REST & WebSocket routers
│   │   ├── tasks/              # Celery task definitions
│   │   └── main.py             # FastAPI entry point
│   ├── tests/                  # Pytest test suite
│   ├── Dockerfile              # Multi-stage Python build
│   └── requirements.txt        # Backend dependencies
├── src/
│   ├── components/             # Reusable UI components & canvas views
│   ├── hooks/                  # WebSocket & state synchronization hooks
│   ├── pages/                  # Route views (Home, Dashboard, Features)
│   ├── monoform.css            # Custom design tokens & animations
│   └── styles.css              # Base styles
├── docker-compose.yml          # Containerized local development stack
├── package.json                # Frontend dependencies & scripts
└── README.md                   # Project documentation
```

---

## License

This project is licensed under the [MIT License](LICENSE).
