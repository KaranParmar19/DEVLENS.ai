# DevLens AI — Senior Engineering Review

**Date:** 2026-10-20 · **Scope:** whole repo (React/TanStack Start frontend, FastAPI/Celery backend) and every feature added in the recent sessions.
**Method:** I read the code and grepped for mock, hardcoded and fallback data. I did not take earlier summaries at face value. Everything below is backed by a file and line reference.

---

## 1. Verdict

**The foundation is solid. The Studio presents more than it can prove.**

The backend pipeline is real and works: GitHub fetch, import-graph construction, file tree, Celery ingestion, WebSocket progress, RAG chat, Mermaid and PlantUML export. The tests pass (21 backend, 7 frontend), and `tsc` and `vite build` are clean.

Several headline Studio features render **fabricated data that looks real**: hardcoded symbols and source in the drawer, invented drift scores, a hardcoded "0 circular cycles [STABLE]", and silent mock copilot answers. For a tool whose whole value is *trusting what it tells you about a codebase*, this is the most serious problem in the project. A code-understanding tool that confidently shows wrong facts is worse than one that shows less.

> Several of these were introduced in the recent sessions, and my earlier summaries described them as more complete than they are. They are corrected here.

---

## 2. Feature-by-feature: does it solve a real problem?

Legend: ✅ real and useful · ⚠️ real but weak · ❌ fabricated or misleading

| Feature | Status | Evidence | Real-world value |
|---|---|---|---|
| Import dependency graph | ✅ | `graph_builder.py` parses Python, JS/TS and Go imports into a networkx graph | **High.** The core product. Answers "what depends on what". |
| File tree / modules / entry points | ✅ | `sessions.py /files` | Medium. Orientation. |
| Blast radius | ✅ | `test_blast_radius_*` pass | **High.** "What breaks if I change X" is the best differentiator. |
| Copilot (RAG chat) | ✅ backend / ❌ UI fallback | `devlens_agent.py` uses real tools. `useChat.ts:178-198` silently streams canned answers whenever the backend or WS fails. | High when real. See §3.4. |
| Mermaid / PlantUML / JSON export | ✅ | `/export` endpoint plus tested `export-utils.ts` | Medium. Useful for docs and PRs. |
| Node drawer: Topology (fan-in/out) | ✅ | Computed from real edges | High. |
| Node drawer: **AST Symbols** | ❌ | `code-viewer-drawer.tsx:27-330` is a hardcoded `CODE_SAMPLES` map. Any other file gets a generated template (`:340-440`). | **Negative.** Shows invented function names and signatures. |
| Node drawer: **Source Code** | ❌ | Same as above. The backend has **no endpoint that returns file contents**. | **Negative.** |
| **Drift Timeline** | ❌ mostly | Commit list is real (`/commits`). Everything else is fake: `files_changed: 3 + (i%5)*2`, `insertions`, `risk_level` by index (`drift-timeline-view.tsx:128-145`). Only the newest commit is ever "HIGH". | **Negative.** Risk labels bear no relation to the code. |
| Footer "N CIRCULAR CYCLES [STABLE]" | ❌ | `studio-workspace.tsx:278` has `cycles: 0` hardcoded. | **Negative.** Claims a clean bill of health it never checked. |
| Footer "MAX FAN-OUT / AVG COMPLEXITY" | ⚠️ | Falls back to invented `7` and `"14.2"` when data is absent (`:271,:276`). | Misleading. |
| "Complexity" score | ⚠️ | Backend computes `line_count / max_lines` (normalised size), **not** cyclomatic complexity (`graph_builder.py:198`). The drawer then compares it to `>20` / `>10` thresholds, so every node reads "low". | A mislabelled metric that behaves as a bug. |
| Offline "fallback" graph / files / modules | ❌ | `architecture-canvas.tsx:29-34`, `studio-workspace.tsx:210-252` | Fine as a labelled demo. Dangerous when it substitutes for a failed analysis with no indication. |
| Code-flow stepper | ⚠️ | Not audited in depth. The file contains static copy such as `failureRisk` text (`code-flow-stepper.tsx:64`). Verify it is derived from the graph. | Unknown. |
| Onboarding doc | ⚠️ | Endpoint exists. I did not verify whether it is LLM-generated from the graph or templated. | Unknown. |

---

## 3. Findings (ranked)

### 3.1 CRITICAL — Fabricated analysis shown as fact
Drift risk, symbols, source, cycle count and several metrics are invented, with no "demo data" marker. Users will make decisions from them.
**Fix:** delete the fabrication. Show real data or an explicit empty or "unavailable" state (§5).

### 3.2 CRITICAL — GitHub ingestion stalls on rate limits
`GITHUB_API_TOKEN` is empty in `backend/.env`. My live test of `pallets/click` hit `403 rate limit exceeded` on dozens of files, with `wait_seconds=3593` in the worker log. Unauthenticated access allows 60 requests per hour.
Ingestion fetches **one API call per file** (Contents API), so even a token only moves the ceiling. A 2,000-file repo consumes ~40% of an authenticated hourly budget in a single analysis.
**Fix:** download the repo **tarball** (one request: `GET /repos/{o}/{r}/tarball/{ref}`) and parse it locally. Also fail fast with a clear UI error instead of sleeping a worker for an hour.

### 3.3 HIGH — Security
- **A hardcoded default API key is now in client code.** I added `'dev-api-key-change-in-production'` as a fallback in `src/lib/api.ts`. Any production build without the env var ships a known key. Remove it and fail loudly.
- `VITE_API_KEY` is bundled into the browser JS, so it is a public value, not a secret. Real auth should be the per-user session token. The shared key is only a weak gate.
- **The GitHub OAuth client secret and a placeholder OpenAI key were read from `backend/.env` and displayed in this working session's logs.** Rotate the GitHub client secret. The file is gitignored (verified), but treat the secret as exposed.
- `/commits` and other routes depend on a shared key plus session UUID. Confirm sessions are authorised per user before anything multi-tenant ships.

### 3.4 HIGH — Silent mock copilot
`useChat.ts` falls back to `getSimulatedCopilotResponse` on **any** failure. `mock-ai-copilot.ts:54` literally replies *"Static Architectural Audit: 0 Circular Cycles Detected."* for arbitrary repos. The user cannot tell a real answer from a canned one.
The backend's own agent also returns a polite "API key invalid" message when `OPENAI_API_KEY` is the placeholder, which is the current `.env` value. So **today, with this config, real answers are not possible.**
**Fix:** on failure, show an error banner and a Retry control. Keep mocks only behind an explicit `?demo=1` flag, with a visible "DEMO DATA" badge.

### 3.5 MEDIUM — Maintainability
I set a ~400-line-per-file rule. These files break it:
`code-viewer-drawer.tsx` 1148, `architecture-canvas.tsx` 773, `drift-timeline-view.tsx` 686, `studio-workspace.tsx` 480. Much of the bulk is the hardcoded sample data above, so deleting §3.1 shrinks them substantially.

### 3.6 MEDIUM — Test quality
The 7 frontend tests check that functions exist and that string formats match. They would pass if every feature were broken. There are no tests on graph math, no component tests, and no e2e. Backend tests do not cover `/commits`, `/export`, auth, or the ingestion task.

### 3.7 LOW
- Footer text "FASTAPI + PGVECTOR" is decorative stack branding and is useless to users.
- The "Share" link only works for the same browser or session (`/dashboard?repo=`) and does not share a result.
- `npm audit` reports 38 vulnerabilities (6 critical); triage before release.

---

## 4. What is genuinely valuable (keep and invest)

1. **Blast radius** — "what breaks if I change this file". This is the most useful thing here.
2. **Real dependency graph** with coupling and entry points.
3. **Grounded Q&A with source citations**, once it runs on a real key.
4. **Diagram export** to put architecture into PRs and docs.
5. **Ingest progress over WebSocket** with Redis backlog replay, which is well engineered.

---

## 5. Recommended roadmap

**P0 — Honesty (about a day). Do this first.**
1. Remove `CODE_SAMPLES` and the generated sample source. Add `GET /sessions/{id}/files/{path}` returning real content from the ingest, and render it.
2. Compute cycles with `networkx.simple_cycles` or SCCs on the backend. Return them in graph meta and show real cycle files.
3. Rename "complexity" to "size", or compute real cyclomatic complexity (Python `ast` / `radon`).
4. Drift: drop fake numbers. Use the GitHub commit-detail API for real files changed, additions and deletions. Only then add risk heuristics, such as touched high-coupling nodes, newly added edges, or new cycles, and label them as heuristics.
5. Replace the silent mock fallbacks with real error states. Gate demo data behind a visible flag.
6. Remove the hardcoded API key fallback. Rotate the OAuth secret.

**P1 — Make it actually usable.**
7. Switch ingestion to tarball download. Add fail-fast rate-limit errors.
8. Real symbol extraction. Python `ast` already exists in `chunker.py`, so expose function and class names, parameters and line ranges through the API.
9. Add a real OpenAI key (or a configurable provider) and verify the full chat path end to end.

**P2 — Quality.**
10. Split the oversized components. Add tests for graph metrics, `/commits`, `/export` and a Playwright smoke flow (paste repo → graph → open node → ask).
11. Dependency audit; CI lint; remove dead copy.

---

## 6. Definition of "done" for the Studio

A feature ships only if **every number and string it displays is derived from the analysed repository, or is clearly labelled as unavailable or demo.** Today that is true for the graph, blast radius, topology, tree and export, and false for the symbols, source, drift and health strip.
