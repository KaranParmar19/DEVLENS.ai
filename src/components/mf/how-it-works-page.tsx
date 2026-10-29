import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Pill, Reveal, SiteLayout } from "./site-layout";
import { MorphText } from "@/components/ui/morph-text";
import { StatsSection } from "@/components/ui/stats-section";

/* ═══════════════════════════════════════════════════════════════════════════
   PIPELINE TELEMETRY & INTERACTIVE STUDIO DATA
   ═══════════════════════════════════════════════════════════════════════════ */

interface StageSpec {
  num: string;
  id: string;
  name: string;
  short: string;
  phase: string;
  tStart: number;
  tEnd: number;
  delta: string;
  pct: number;
  summary: string;
  inputContract: string;
  engineSpec: string;
  outputContract: string;
  headlineMetric: string;
  metricSub: string;
  logs: string[];
  wsFrame: string;
  artifactTitle: string;
  artifactItems: { label: string; value: string; accent?: "green" | "amber" | "red" }[];
}

const TOTAL_SECONDS = 7.4;

const STAGES: StageSpec[] = [
  {
    num: "01",
    id: "clone",
    name: "Shallow Ephemeral Clone",
    short: "Clone & Sanitize",
    phase: "INGESTION",
    tStart: 0.0,
    tEnd: 0.62,
    delta: "0.62s",
    pct: 8.4,
    summary:
      "Mounts an isolated 512 MB tmpfs RAM-disk, negotiates Git wire protocol v2 with --depth=1 --filter=blob:limit=1m, and strips lockfiles, vendor trees, and binary blobs before a single byte touches the parser.",
    inputContract: "https://github.com/{owner}/{repo}.git + optional PAT",
    engineSpec: "libgit2 v2 wire · Linux tmpfs RAM sandbox",
    outputContract: "Sanitized UTF-8 file manifest + SHA-256 Merkle tree",
    headlineMetric: "97.4% bytes stripped",
    metricSub: "184 MB raw repository reduced to 4.8 MB of pure source AST targets",
    logs: [
      "[00.04s] mount -t tmpfs -o size=512m,mode=0700 tmpfs /mnt/ramdisk/job_9f41a",
      "[00.19s] git fetch --depth=1 --filter=blob:limit=1m origin HEAD (wire-v2)",
      "[00.41s] prune: skipped node_modules/ (4,820 files), pnpm-lock.yaml, dist/",
      "[00.62s] manifest sealed: 312 UTF-8 source files (4.82 MB) · sha256=8f3c…91a0",
    ],
    wsFrame:
      '{"stage":"01_CLONE","elapsed_ms":620,"files_kept":312,"files_pruned":4918,"ram_mb":4.82}',
    artifactTitle: "RAM-DISK SANITIZER MANIFEST",
    artifactItems: [
      { label: "Raw Repo Payload", value: "184.2 MB (5,230 files)" },
      { label: "Stripped Vendor / Locks", value: "-179.4 MB (4,918 pruned)", accent: "red" },
      { label: "Clean UTF-8 Source Tree", value: "4.82 MB (312 AST files)", accent: "green" },
      { label: "Disk Persistence", value: "0 MB (RAM-only tmpfs)", accent: "green" },
    ],
  },
  {
    num: "02",
    id: "parse",
    name: "Tree-sitter Grammar Parse",
    short: "AST Compilation",
    phase: "LEXICAL CST",
    tStart: 0.62,
    tEnd: 2.5,
    delta: "1.88s",
    pct: 25.4,
    summary:
      "An 8-thread Rust worker pool compiles every source file into a lossless Concrete Syntax Tree (CST) using native C/WASM Tree-sitter grammars—extracting functions, classes, call sites, and cyclomatic branches with exact byte spans.",
    inputContract: "312 UTF-8 source buffers across 14+ languages",
    engineSpec: "8× Rayon worker threads · Tree-sitter WASM/C grammars",
    outputContract: "12,480 CST symbol records + [start_byte..end_byte] spans",
    headlineMetric: "194,200 LOC / sec",
    metricSub: "Zero-copy arena allocation across TypeScript, Python, Rust, Go & Java",
    logs: [
      "[00.71s] rayon::ThreadPool initialized (8 workers, 14 grammar tables preloaded)",
      "[01.34s] parsed src/core/graph/builder.ts → 42 symbols, 18 imports, M=19",
      "[02.08s] parsed src/auth/verifyToken.ts → 11 symbols, 6 call expressions, M=14",
      "[02.50s] CST table complete: 12,480 symbols · 0 syntax errors · 1.88s elapsed",
    ],
    wsFrame:
      '{"stage":"02_AST_PARSE","elapsed_ms":1880,"symbols":12480,"call_sites":9840,"threads":8}',
    artifactTitle: "TREE-SITTER CST SYMBOL TABLE",
    artifactItems: [
      { label: "Parsed Source Files", value: "312 / 312 (100%)" },
      { label: "Extracted AST Symbols", value: "12,480 declarations", accent: "green" },
      { label: "Call-Site Expressions", value: "9,840 AST edges", accent: "green" },
      { label: "Peak Memory Arena", value: "38.4 MB zero-copy" },
    ],
  },
  {
    num: "03",
    id: "graph",
    name: "Dependency Multigraph",
    short: "Multigraph & Cycles",
    phase: "TOPOLOGY",
    tStart: 2.5,
    tEnd: 3.91,
    delta: "1.41s",
    pct: 19.1,
    summary:
      "Synthesizes a directed multigraph G = (V, E_import ∪ E_call ∪ E_inherit) by resolving tsconfig path aliases, barrel re-exports, and Python/Rust module trees—then runs Tarjan's O(V + E) algorithm to isolate circular dependencies.",
    inputContract: "Raw import specifiers + tsconfig.json / pyproject.toml",
    engineSpec: "Deterministic path resolver + Tarjan SCC cycle solver",
    outputContract: "Directed multigraph (312 nodes, 1,148 typed edges, 2 SCCs)",
    headlineMetric: "99.4% edges resolved",
    metricSub: "Full alias resolution across monorepo workspaces and barrel index files",
    logs: [
      "[02.64s] loaded tsconfig.json paths: {'@/*': ['src/*'], '@core/*': ['packages/core/*']}",
      "[03.12s] linked 1,148 directed edges (712 E_import, 389 E_call, 47 E_inherit)",
      "[03.58s] tarjan_scc(G): isolated cycle #1 (builder.ts ⇄ layout.ts, 2 nodes)",
      "[03.91s] centrality pass complete: top hub src/core/graph/builder.ts (fanIn=34)",
    ],
    wsFrame:
      '{"stage":"03_MULTIGRAPH","elapsed_ms":1410,"nodes":312,"edges":1148,"cycles_scc":2}',
    artifactTitle: "DIRECTED MULTIGRAPH TOPOLOGY",
    artifactItems: [
      { label: "Resolved Import Edges", value: "712 E_import (99.4%)", accent: "green" },
      { label: "Cross-File Call Edges", value: "389 E_call + 47 E_inherit", accent: "green" },
      { label: "Circular SCC Loops", value: "2 isolated cycles", accent: "amber" },
      { label: "Max Fan-In Hub", value: "builder.ts (34 dependents)" },
    ],
  },
  {
    num: "04",
    id: "layout",
    name: "Spatial Hull Clustering",
    short: "Force Layout & Risk",
    phase: "SPATIAL PHYSICS",
    tStart: 3.91,
    tEnd: 5.96,
    delta: "2.05s",
    pct: 27.7,
    summary:
      "Executes 300 ticks of Barnes-Hut O(V log V) quadtree force simulation in a headless worker, computes convex architectural domain hulls, and scores every node's blast-radius risk from fan-in, complexity, and 90-day git churn.",
    inputContract: "Directed multigraph G + 90-day git log churn histogram",
    engineSpec: "Barnes-Hut θ=0.8 quadtree solver + Louvain modularity",
    outputContract: "Pinned (x, y, r) coordinates + convex hull polygons + W(v) risk",
    headlineMetric: "60 FPS @ 5,000 nodes",
    metricSub: "Pre-converged server coordinates eliminate client-side layout jitter",
    logs: [
      "[04.09s] barnes_hut::Quadtree initialized (300 ticks, theta=0.80, k_repel=-420)",
      "[04.88s] louvain modularity converged: 6 domain clusters (Q=0.784)",
      "[05.42s] risk solver: builder.ts W(v)=0.89 [CRITICAL], verifyToken.ts W(v)=0.78",
      "[05.96s] baked 312 node coords + 6 SVG convex hulls (energy Δ < 0.0004)",
    ],
    wsFrame:
      '{"stage":"04_SPATIAL_LAYOUT","elapsed_ms":2050,"clusters":6,"hotspots":4,"fps_target":60}',
    artifactTitle: "SPATIAL & RISK SOLVER OUTPUT",
    artifactItems: [
      { label: "Quadtree Simulation", value: "300 ticks (O(V log V))", accent: "green" },
      { label: "Architectural Domains", value: "6 convex hull clusters" },
      { label: "Critical Risk Nodes", value: "4 files (W(v) > 0.70)", accent: "red" },
      { label: "Client Render Overhead", value: "0 ms (pre-baked coords)", accent: "green" },
    ],
  },
  {
    num: "05",
    id: "index",
    name: "AST-Bounded Vector Index",
    short: "AST RAG & Citations",
    phase: "VECTOR HNSW",
    tStart: 5.96,
    tEnd: 7.4,
    delta: "1.44s",
    pct: 19.4,
    summary:
      "Slices source code strictly along AST function and class boundaries—never mid-statement—injects caller/callee graph metadata into every chunk header, and indexes 1,536-dim embeddings into pgvector HNSW for 100% line-cited answers.",
    inputContract: "AST declaration envelopes + 1-hop multigraph context",
    engineSpec: "AST-boundary chunker + pgvector HNSW (m=16, ef=64)",
    outputContract: "840 graph-enriched vector chunks + [file:Lstart-Lend] index",
    headlineMetric: "100% line-cited",
    metricSub: "Every copilot claim is anchored to a verified AST byte span and line range",
    logs: [
      "[06.11s] ast_chunker: packed 840 complete function/class envelopes (0 mid-line cuts)",
      "[06.58s] injected [DEVLENS_AST_HEADER] caller/callee neighbourhood metadata",
      "[07.14s] pgvector COPY 840 vectors (1536-d) → HNSW index build (m=16, ef=64)",
      "[07.40s] PIPELINE COMPLETE · workspace ready in 7.40s · 100% citation lock",
    ],
    wsFrame:
      '{"stage":"05_VECTOR_INDEX","elapsed_ms":1440,"chunks":840,"dims":1536,"status":"READY"}',
    artifactTitle: "PGVECTOR HNSW CITATION INDEX",
    artifactItems: [
      { label: "AST-Bounded Chunks", value: "840 intact declarations", accent: "green" },
      { label: "Mid-Function Splits", value: "0 (strictly AST-bounded)", accent: "green" },
      { label: "HNSW Recall @ k=8", value: "99.2% (m=16, ef=64)", accent: "green" },
      { label: "Unverified Claims", value: "0% (hard citation gate)" },
    ],
  },
];

/* ── Stage 01 Sanitizer File Tree Data ─────────────────────────────────── */
const SANITIZER_FILES = [
  { path: "node_modules/.pnpm/...", size: "148.2 MB", files: "4,820 files", keep: false, reason: "PRUNED: VENDOR TREE" },
  { path: "pnpm-lock.yaml", size: "19.4 MB", files: "1 file", keep: false, reason: "PRUNED: LOCKFILE" },
  { path: "public/assets/demo-video.mp4", size: "11.8 MB", files: "1 binary", keep: false, reason: "PRUNED: BLOB > 1MB" },
  { path: "src/core/graph/builder.ts", size: "18.4 KB", files: "412 LOC", keep: true, reason: "KEPT: AST TARGET" },
  { path: "src/auth/verifyToken.ts", size: "9.2 KB", files: "218 LOC", keep: true, reason: "KEPT: AST TARGET" },
  { path: "src/api/webhookHandler.ts", size: "14.1 KB", files: "329 LOC", keep: true, reason: "KEPT: AST TARGET" },
  { path: "src/db/pgvectorClient.ts", size: "11.6 KB", files: "264 LOC", keep: true, reason: "KEPT: AST TARGET" },
];

/* ── Stage 02 Multi-Language CST Compiler Data ─────────────────────────── */
type GrammarKey = "ts" | "py" | "rs";

const GRAMMAR_SAMPLES: Record<
  GrammarKey,
  {
    label: string;
    grammar: string;
    file: string;
    parseTime: string;
    lines: { lineNo: number; code: string; nodeType: string; span: string; symbol?: string }[];
    sexpr: string;
    symbols: { kind: string; name: string; span: string; calls: string; complexity: string }[];
  }
> = {
  ts: {
    label: "TypeScript (.tsx)",
    grammar: "tree-sitter-typescript@0.23.2",
    file: "src/auth/verifyToken.ts",
    parseTime: "0.41 ms",
    lines: [
      {
        lineNo: 14,
        code: "import { decodeJwt, jwtVerify } from 'jose';",
        nodeType: "import_statement",
        span: "[0..44]",
        symbol: "import → jose",
      },
      {
        lineNo: 15,
        code: "import { SessionStore } from '@/db/sessionStore';",
        nodeType: "import_statement",
        span: "[45..94]",
        symbol: "import → @/db/sessionStore",
      },
      {
        lineNo: 17,
        code: "export async function verifySessionToken(raw: string) {",
        nodeType: "export_statement > function_declaration",
        span: "[96..342]",
        symbol: "fn verifySessionToken(raw: string)",
      },
      {
        lineNo: 18,
        code: "  const { payload } = await jwtVerify(raw, JWT_KEY);",
        nodeType: "lexical_declaration > await_expression > call_expression",
        span: "[152..204]",
        symbol: "call → jwtVerify()",
      },
      {
        lineNo: 19,
        code: "  if (!payload.sub || payload.exp! < Date.now() / 1000) {",
        nodeType: "if_statement > binary_expression (||)",
        span: "[207..264]",
        symbol: "branch → cyclomatic +2",
      },
      {
        lineNo: 20,
        code: "    throw new AuthExpiredError('SESSION_EXPIRED');",
        nodeType: "throw_statement > new_expression",
        span: "[270..320]",
        symbol: "throws → AuthExpiredError",
      },
      {
        lineNo: 22,
        code: "  return SessionStore.hydrate(payload.sub);",
        nodeType: "return_statement > call_expression",
        span: "[326..369]",
        symbol: "call → SessionStore.hydrate()",
      },
    ],
    sexpr: `(program [0..372]
  (import_statement
    (import_clause (named_imports
      (import_specifier name: (identifier) @import.sym)))
    source: (string) @import.src)
  (export_statement [96..372]
    declaration: (function_declaration
      name: (identifier) @fn.def
      parameters: (formal_parameters (required_parameter))
      body: (statement_block
        (lexical_declaration
          (variable_declarator
            value: (await_expression
              (call_expression
                function: (identifier) @call.target))))
        (if_statement
          condition: (parenthesized_expression
            (binary_expression operator: "||")))
        (return_statement
          (call_expression
            function: (member_expression) @call.member))))))`,
    symbols: [
      { kind: "EXPORT FN", name: "verifySessionToken", span: "L17–L23 [96..372]", calls: "jwtVerify, SessionStore.hydrate", complexity: "M = 4" },
      { kind: "IMPORT", name: "jwtVerify, decodeJwt", span: "L14 [0..44]", calls: "pkg: jose@5.9.6", complexity: "—" },
      { kind: "ALIAS EDGE", name: "@/db/sessionStore", span: "L15 [45..94]", calls: "→ src/db/sessionStore.ts", complexity: "—" },
    ],
  },
  py: {
    label: "Python (.py)",
    grammar: "tree-sitter-python@0.23.5",
    file: "services/indexer/embed_worker.py",
    parseTime: "0.36 ms",
    lines: [
      {
        lineNo: 8,
        code: "from pgvector.psycopg import register_vector",
        nodeType: "import_from_statement",
        span: "[0..44]",
        symbol: "import → pgvector.psycopg",
      },
      {
        lineNo: 9,
        code: "from core.ast_chunker import slice_ast_envelopes",
        nodeType: "import_from_statement",
        span: "[45..93]",
        symbol: "import → core.ast_chunker",
      },
      {
        lineNo: 12,
        code: "async def index_repository_chunks(conn, repo_id: str):",
        nodeType: "function_definition (async)",
        span: "[96..358]",
        symbol: "async def index_repository_chunks",
      },
      {
        lineNo: 13,
        code: "    envelopes = slice_ast_envelopes(repo_id, max_tokens=768)",
        nodeType: "assignment > call",
        span: "[151..211]",
        symbol: "call → slice_ast_envelopes()",
      },
      {
        lineNo: 14,
        code: "    if not envelopes:",
        nodeType: "if_statement > not_operator",
        span: "[216..237]",
        symbol: "branch → cyclomatic +1",
      },
      {
        lineNo: 15,
        code: "        return IndexResult(count=0, status='EMPTY')",
        nodeType: "return_statement > call",
        span: "[246..297]",
        symbol: "call → IndexResult()",
      },
      {
        lineNo: 16,
        code: "    return await bulk_hnsw_upsert(conn, envelopes)",
        nodeType: "return_statement > await > call",
        span: "[302..352]",
        symbol: "call → bulk_hnsw_upsert()",
      },
    ],
    sexpr: `(module [0..358]
  (import_from_statement
    module_name: (dotted_name) @mod.src
    name: (dotted_name (identifier) @mod.sym))
  (function_definition [96..358]
    name: (identifier) @fn.def
    parameters: (parameters (identifier) (typed_parameter))
    body: (block
      (expression_statement
        (assignment
          right: (call function: (identifier) @call.fn)))
      (if_statement
        condition: (not_operator (identifier)))
      (return_statement
        (await (call function: (identifier) @call.async))))))`,
    symbols: [
      { kind: "ASYNC DEF", name: "index_repository_chunks", span: "L12–L16 [96..358]", calls: "slice_ast_envelopes, bulk_hnsw_upsert", complexity: "M = 2" },
      { kind: "INTERNAL", name: "core.ast_chunker", span: "L9 [45..93]", calls: "→ services/indexer/core/ast_chunker.py", complexity: "—" },
      { kind: "EXT PKG", name: "pgvector.psycopg", span: "L8 [0..44]", calls: "pypi: pgvector@0.3.6", complexity: "—" },
    ],
  },
  rs: {
    label: "Rust (.rs)",
    grammar: "tree-sitter-rust@0.23.1",
    file: "crates/graph-solver/src/tarjan.rs",
    parseTime: "0.29 ms",
    lines: [
      {
        lineNo: 21,
        code: "use crate::multigraph::{DirectedGraph, NodeId};",
        nodeType: "use_declaration",
        span: "[0..47]",
        symbol: "use → crate::multigraph",
      },
      {
        lineNo: 24,
        code: "pub fn find_strongly_connected(g: &DirectedGraph) -> Vec<Vec<NodeId>> {",
        nodeType: "function_item (pub)",
        span: "[50..364]",
        symbol: "pub fn find_strongly_connected",
      },
      {
        lineNo: 25,
        code: "    let mut solver = TarjanState::with_capacity(g.node_count());",
        nodeType: "let_declaration > call_expression",
        span: "[122..186]",
        symbol: "call → TarjanState::with_capacity()",
      },
      {
        lineNo: 26,
        code: "    for node in g.vertices() {",
        nodeType: "for_expression",
        span: "[191..221]",
        symbol: "loop → cyclomatic +1",
      },
      {
        lineNo: 27,
        code: "        if !solver.is_visited(node) { solver.strongconnect(g, node); }",
        nodeType: "if_expression > call_expression",
        span: "[230..300]",
        symbol: "call → solver.strongconnect()",
      },
      {
        lineNo: 29,
        code: "    solver.into_cycles()",
        nodeType: "call_expression (tail)",
        span: "[312..336]",
        symbol: "call → solver.into_cycles()",
      },
    ],
    sexpr: `(source_file [0..364]
  (use_declaration
    argument: (scoped_use_list
      path: (scoped_identifier) @crate.path))
  (function_item [50..364]
    (visibility_modifier)
    name: (identifier) @fn.pub
    parameters: (parameters (parameter type: (reference_type)))
    return_type: (generic_type)
    body: (block
      (let_declaration
        value: (call_expression
          function: (scoped_identifier) @call.assoc))
      (for_expression
        body: (block (if_expression)))
      (call_expression
        function: (field_expression) @call.tail))))`,
    symbols: [
      { kind: "PUB FN", name: "find_strongly_connected", span: "L24–L30 [50..364]", calls: "TarjanState::with_capacity, strongconnect", complexity: "M = 3" },
      { kind: "CRATE MOD", name: "crate::multigraph", span: "L21 [0..47]", calls: "→ crates/graph-solver/src/multigraph.rs", complexity: "—" },
      { kind: "TAIL CALL", name: "solver.into_cycles", span: "L29 [312..336]", calls: "returns Vec<Vec<NodeId>>", complexity: "—" },
    ],
  },
};

/* ── Stage 03 Multigraph Edges Data ────────────────────────────────────── */
const GRAPH_EDGES = [
  {
    id: "E-01",
    kind: "E_import + E_call",
    raw: "import { GraphBuilder } from '@/core/graph/builder'",
    resolved: "src/api/ingestController.ts:18 → src/core/graph/builder.ts:44",
    status: "LOAD-BEARING HUB",
    accent: "green" as const,
    fanIn: 34,
    fanOut: 7,
    detail:
      "Resolved via tsconfig.json paths['@/*']. GraphBuilder.compile() is invoked by 34 upstream modules—making it the #1 structural hub in the repository.",
  },
  {
    id: "E-02",
    kind: "E_call (Security Gate)",
    raw: "await verifySessionToken(req.headers.authorization)",
    resolved: "src/api/ingestController.ts:42 → src/auth/verifyToken.ts:17",
    status: "AUTH BOUNDARY",
    accent: "green" as const,
    fanIn: 19,
    fanOut: 3,
    detail:
      "Cross-file async call edge. Modifying verifySessionToken() propagates across 19 protected API route handlers.",
  },
  {
    id: "E-03",
    kind: "E_import + E_call (SCC Cycle)",
    raw: "import { computeHull } from './spatialLayout'",
    resolved: "src/core/graph/builder.ts:89 ⇄ src/core/graph/spatialLayout.ts:31",
    status: "TARJAN CYCLE (SCC #1)",
    accent: "red" as const,
    fanIn: 12,
    fanOut: 9,
    detail:
      "Tarjan's strongly connected component solver isolated a bi-directional dependency loop between builder.ts and spatialLayout.ts.",
  },
  {
    id: "E-04",
    kind: "E_call (Vector Store)",
    raw: "await pgvectorClient.upsertChunks(astEnvelopes)",
    resolved: "src/core/graph/builder.ts:142 → src/db/pgvectorClient.ts:61",
    status: "HNSW SINK",
    accent: "green" as const,
    fanIn: 8,
    fanOut: 2,
    detail:
      "Terminal data-sink edge writing 1,536-d embeddings and line-range metadata into PostgreSQL pgvector.",
  },
];

/* ── Stage 04 Risk Formula & Blast Radius Data ─────────────────────────── */
const HOTSPOT_FILES = [
  {
    file: "src/core/graph/builder.ts",
    domain: "Core Graph Engine",
    fanInNorm: 0.94,
    cycloNorm: 0.86,
    churnNorm: 0.83,
    score: 0.89,
    tier: "CRITICAL HUB",
    hop1: 11,
    hop2: 34,
    note: "34 transitive dependents · 19 cyclomatic branches · 47 commits in 90d",
  },
  {
    file: "src/auth/verifyToken.ts",
    domain: "Auth & Session Boundary",
    fanInNorm: 0.82,
    cycloNorm: 0.74,
    churnNorm: 0.76,
    score: 0.78,
    tier: "HIGH RISK",
    hop1: 8,
    hop2: 19,
    note: "Guards 19 API endpoints · JWT signature & expiry enforcement",
  },
  {
    file: "src/api/webhookHandler.ts",
    domain: "Ingestion API",
    fanInNorm: 0.64,
    cycloNorm: 0.81,
    churnNorm: 0.79,
    score: 0.73,
    tier: "HIGH CHURN",
    hop1: 5,
    hop2: 14,
    note: "Idempotency state machine · 38 commits in last 90 days",
  },
  {
    file: "src/db/pgvectorClient.ts",
    domain: "Vector Storage",
    fanInNorm: 0.58,
    cycloNorm: 0.49,
    churnNorm: 0.42,
    score: 0.52,
    tier: "MODERATE",
    hop1: 4,
    hop2: 9,
    note: "HNSW index writer · stable connection pool interface",
  },
];

/* ── Stage 05 Grounded Copilot Query Trace Data ────────────────────────── */
const COPILOT_TRACES = [
  {
    question: "Where is JWT session expiry enforced and what breaks if the payload schema changes?",
    topChunk: "src/auth/verifyToken.ts:L17–L23",
    similarity: "0.948",
    neighborHop: "src/api/ingestController.ts:L40–L52 (1-hop caller)",
    answer:
      "JWT expiry is enforced inside `verifySessionToken()` at [src/auth/verifyToken.ts:17-23], which checks `payload.exp < Date.now() / 1000` and throws `AuthExpiredError`. Changing `payload.sub` impacts `SessionStore.hydrate()` at [src/db/sessionStore.ts:48-64] and 19 upstream route handlers including [src/api/ingestController.ts:42].",
  },
  {
    question: "Why did the architecture map flag a circular dependency in the graph subsystem?",
    topChunk: "src/core/graph/builder.ts:L84–L108",
    similarity: "0.931",
    neighborHop: "src/core/graph/spatialLayout.ts:L28–L49 (Tarjan SCC #1)",
    answer:
      "`GraphBuilder.compile()` imports `computeHull()` from [src/core/graph/spatialLayout.ts:31], while `spatialLayout.ts` imports `NodeWeightTable` back from [src/core/graph/builder.ts:89]. Extracting `NodeWeightTable` into `src/core/graph/types.ts` breaks the cycle cleanly.",
  },
  {
    question: "How are AST chunks enriched before pgvector HNSW indexing?",
    topChunk: "services/indexer/core/ast_chunker.py:L62–L98",
    similarity: "0.962",
    neighborHop: "src/db/pgvectorClient.ts:L61–L88 (1-hop callee)",
    answer:
      "`slice_ast_envelopes()` at [services/indexer/core/ast_chunker.py:62-98] walks Tree-sitter `function_declaration` nodes so functions are never split mid-block, prepending `[DEVLENS_AST_HEADER]` with 1-hop callers, callees, and `W(v)` risk score before `upsertChunks()` at [src/db/pgvectorClient.ts:61].",
  },
];

const SAMPLE_REPOS = [
  "vercel/next.js",
  "facebook/react",
  "fastapi/fastapi",
  "tailwindlabs/tailwindcss",
];

/* ═══════════════════════════════════════════════════════════════════════════
   HOW IT WORKS PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function HowItWorksPage() {
  const navigate = useNavigate();

  // Hero Flight Deck state
  const [activeStageIdx, setActiveStageIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [selectedRepo, setSelectedRepo] = useState<string>("vercel/next.js");

  // Stage 01 Sanitizer state
  const [pruneEnabled, setPruneEnabled] = useState<boolean>(true);

  // Stage 02 CST Compiler state
  const [grammarKey, setGrammarKey] = useState<GrammarKey>("ts");
  const [selectedLineIdx, setSelectedLineIdx] = useState<number>(2);

  // Stage 03 Multigraph state
  const [selectedEdgeIdx, setSelectedEdgeIdx] = useState<number>(0);

  // Stage 04 Risk Simulator state
  const [selectedHotspotIdx, setSelectedHotspotIdx] = useState<number>(0);

  // Stage 05 Copilot Trace state
  const [chunkMode, setChunkMode] = useState<"ast" | "naive">("ast");
  const [selectedTraceIdx, setSelectedTraceIdx] = useState<number>(0);

  // Footer CTA Repo Input
  const [repoInput, setRepoInput] = useState<string>("https://github.com/vercel/next.js");

  // Auto-advance the Hero Flight Deck when playing
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setActiveStageIdx((prev) => (prev + 1) % STAGES.length);
    }, 3800);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const activeStage = STAGES[activeStageIdx];
  const currentGrammar = GRAMMAR_SAMPLES[grammarKey];
  const activeLine = currentGrammar.lines[selectedLineIdx] ?? currentGrammar.lines[0];
  const activeEdge = GRAPH_EDGES[selectedEdgeIdx];
  const activeHotspot = HOTSPOT_FILES[selectedHotspotIdx];
  const activeTrace = COPILOT_TRACES[selectedTraceIdx];

  const handleLaunchRepo = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/dashboard" });
  };

  return (
    <SiteLayout>
      {/* ═══════════════════════════════════════════════════════════════════
          00 · EDITORIAL LIGHT HERO + INTERACTIVE PIPELINE FLIGHT DECK
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-hero hiw2-hero" data-theme="light">
        <div className="mf-hero-grid-bg" />
        <div className="mf-wrap" style={{ position: "relative", zIndex: 1 }}>
          {/* Meta Eyebrow Bar */}
          <div className="hiw2-eyebrow-row">
            <Pill live>Deterministic 5-Stage Pipeline · 7.40s Cold Run</Pill>
            <div className="hiw2-eyebrow-meta mf-mono">
              <span>SPEC // PIPELINE-V2.4</span>
              <span>·</span>
              <span>ZERO-PERSISTENCE RAM SANDBOX</span>
              <span>·</span>
              <span>100% AST-GROUNDED</span>
            </div>
          </div>

          {/* Editorial Split Header */}
          <div className="hiw2-hero-head">
            <div>
              <h1 className="mf-mega hiw2-mega">
                From raw Git URL to{" "}
                <span className="mf-serif-i" style={{ fontWeight: 400 }}>
                  <MorphText
                    words={[
                      "AST multigraph.",
                      "call hierarchy.",
                      "blast-radius map.",
                      "cited copilot.",
                    ]}
                  />
                </span>
              </h1>
            </div>

            <div className="hiw2-hero-aside">
              <p className="mf-lead" style={{ margin: 0 }}>
                DevLens never guesses architecture from filenames or naive text chunks. Every repository passes through a five-stage compiler, graph-theory, and vector-indexing pipeline in{" "}
                <strong style={{ color: "var(--mf-ink)", fontWeight: 500 }}>7.40 seconds</strong>.
              </p>
              <div className="hiw2-hero-QuickBar">
                <button
                  type="button"
                  className="mf-btn"
                  onClick={() => {
                    setActiveStageIdx(0);
                    setIsPlaying(true);
                  }}
                >
                  <span className="hiw2-live-dot" />
                  <span>{isPlaying ? "Auto-Cycling Pipeline" : "Replay 7.40s Pipeline"}</span>
                </button>
                <button
                  type="button"
                  className="mf-btn ghost"
                  onClick={() => navigate({ to: "/dashboard" })}
                >
                  <span>Open Live Workspace</span>
                  <span className="mf-arrow">↗</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Interactive Pipeline Flight Deck (Dark Studio Frame) ── */}
          <div className="hiw2-deck">
            {/* Top Window Chrome */}
            <div className="hiw2-deck-bar">
              <div className="hiw2-deck-dots">
                <span style={{ background: "#ff5f57" }} />
                <span style={{ background: "#febc2e" }} />
                <span style={{ background: "#28c840" }} />
                <div className="hiw2-deck-title mf-mono">
                  devlens-pipeline-runner — target:{" "}
                  <strong style={{ color: "#fff" }}>github.com/{selectedRepo}</strong>
                </div>
              </div>

              <div className="hiw2-deck-controls">
                <div className="hiw2-repo-pills">
                  {SAMPLE_REPOS.slice(0, 3).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="hiw2-repo-pill"
                      data-active={selectedRepo === r}
                      onClick={() => {
                        setSelectedRepo(r);
                        setActiveStageIdx(0);
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="hiw2-play-toggle mf-mono"
                  onClick={() => setIsPlaying((p) => !p)}
                >
                  {isPlaying ? "❚❚ PAUSE TRACE" : "▶ AUTO-PLAY"}
                </button>
              </div>
            </div>

            {/* 5-Stage Proportional Interactive Circuit Track */}
            <div className="hiw2-circuit">
              {STAGES.map((st, idx) => {
                const isSelected = idx === activeStageIdx;
                const isCompleted = idx < activeStageIdx;
                return (
                  <button
                    key={st.id}
                    type="button"
                    className="hiw2-circuit-node"
                    data-active={isSelected}
                    data-done={isCompleted}
                    onClick={() => {
                      setIsPlaying(false);
                      setActiveStageIdx(idx);
                    }}
                  >
                    <div className="hiw2-circuit-top mf-mono">
                      <span className="hiw2-circuit-num">STAGE {st.num}</span>
                      <span className="hiw2-circuit-delta">{st.delta}</span>
                    </div>
                    <div className="hiw2-circuit-name">{st.short}</div>
                    <div className="hiw2-circuit-window mf-mono">
                      T+{st.tStart.toFixed(2)}s → {st.tEnd.toFixed(2)}s ({st.pct}%)
                    </div>
                    <div className="hiw2-circuit-bar">
                      <span
                        className="hiw2-circuit-fill"
                        style={{
                          width: isSelected ? "100%" : isCompleted ? "100%" : "0%",
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 3-Column Live Stage Telemetry Workbench */}
            <div className="hiw2-deck-body">
              {/* Column 1: Stage Architecture & I/O Contract */}
              <div className="hiw2-deck-col">
                <div className="hiw2-pane-label mf-mono">
                  <span>
                    STAGE {activeStage.num} // {activeStage.phase}
                  </span>
                  <span style={{ color: "#10b981" }}>
                    Δ {activeStage.delta} ({activeStage.pct}% OF RUN)
                  </span>
                </div>
                <h2 className="hiw2-deck-stage-title">{activeStage.name}</h2>
                <p className="hiw2-deck-stage-desc">{activeStage.summary}</p>

                <div className="hiw2-io-stack">
                  <div className="hiw2-io-item">
                    <span className="mf-mono">INPUT</span>
                    <code>{activeStage.inputContract}</code>
                  </div>
                  <div className="hiw2-io-item">
                    <span className="mf-mono">ENGINE</span>
                    <code>{activeStage.engineSpec}</code>
                  </div>
                  <div className="hiw2-io-item">
                    <span className="mf-mono">OUTPUT</span>
                    <code style={{ color: "#10b981" }}>{activeStage.outputContract}</code>
                  </div>
                </div>
              </div>

              {/* Column 2: Streaming Worker Terminal + WebSocket Frame */}
              <div className="hiw2-deck-col hiw2-deck-col--terminal">
                <div className="hiw2-pane-label mf-mono">
                  <span>WORKER STDOUT STREAM</span>
                  <span>
                    T+{activeStage.tEnd.toFixed(2)}s / {TOTAL_SECONDS.toFixed(2)}s
                  </span>
                </div>
                <div className="hiw2-terminal-lines mf-mono">
                  {activeStage.logs.map((line, i) => (
                    <div key={i} className="hiw2-terminal-line">
                      <span className="hiw2-term-prompt">›</span>
                      <span>{line}</span>
                    </div>
                  ))}
                  <div className="hiw2-terminal-line" style={{ color: "#10b981" }}>
                    <span className="hiw2-term-prompt">✓</span>
                    <span>
                      stage_{activeStage.num}_{activeStage.id} committed in {activeStage.delta}
                    </span>
                    <span className="hiw2-cursor" />
                  </div>
                </div>
                <div className="hiw2-ws-box mf-mono">
                  <div className="hiw2-ws-head">
                    <span>WSS://API.DEVLENS.AI/V2/STREAM</span>
                    <span style={{ color: "#10b981" }}>● 200 OK</span>
                  </div>
                  <code>{activeStage.wsFrame}</code>
                </div>
              </div>

              {/* Column 3: Stage Output Telemetry Card */}
              <div className="hiw2-deck-col">
                <div className="hiw2-pane-label mf-mono">
                  <span>{activeStage.artifactTitle}</span>
                  <span>VERIFIED</span>
                </div>

                <div className="hiw2-metric-hero">
                  <div className="hiw2-metric-big">{activeStage.headlineMetric}</div>
                  <p>{activeStage.metricSub}</p>
                </div>

                <div className="hiw2-artifact-list">
                  {activeStage.artifactItems.map((item) => (
                    <div key={item.label} className="hiw2-artifact-row">
                      <span className="hiw2-artifact-label">{item.label}</span>
                      <span
                        className="hiw2-artifact-val mf-mono"
                        data-accent={item.accent || "default"}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          01 · QUANTITATIVE PIPELINE BENCHMARKS (LIGHT)
          ═══════════════════════════════════════════════════════════════════ */}
      <StatsSection
        stats={[
          {
            value: 7.4,
            decimals: 1,
            suffix: "s",
            label: "End-to-End Cold Run",
            description:
              "Complete execution from shallow clone through Tree-sitter CST parsing, Tarjan cycle detection, Barnes-Hut layout, and pgvector indexing.",
          },
          {
            value: 8,
            suffix: "×",
            label: "Parallel Rust Workers",
            description:
              "Concurrent worker threads parse source files into Concrete Syntax Trees at 194,200 LOC/sec without blocking the main event loop.",
          },
          {
            value: 14,
            suffix: "+",
            label: "Native AST Grammars",
            description:
              "Compiled C/WASM Tree-sitter grammars extract exact byte offsets, call hierarchies, and cyclomatic branches across polyglot repos.",
          },
          {
            value: 0,
            suffix: " MB",
            label: "Persistent Source Storage",
            description:
              "Raw source files exist only inside an isolated RAM-disk mount during parsing and are unlinked immediately after vector indexing.",
          },
        ]}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          02 · DARK COMPILER & SANDBOX STUDIO (STAGES 01 & 02)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section mf-dark" data-theme="dark">
        <div className="mf-wrap">
          <div className="mf-sec-bar">
            <span className="idx">[01 — 02 / INGESTION & LEXICAL COMPILATION]</span>
            <Pill>Phase I · T+0.00s → T+2.50s</Pill>
            <span className="tag">EPHEMERAL TMPFS + TREE-SITTER CST</span>
          </div>

          <div className="hiw2-phase-intro">
            <Reveal>
              <h2 className="mf-h1" style={{ maxWidth: "16em" }}>
                Strip the noise in RAM.{" "}
                <span className="mf-serif-i" style={{ fontWeight: 400, color: "#a3a3a3" }}>
                  Compile every token into a Concrete Syntax Tree.
                </span>
              </h2>
            </Reveal>
            <p className="mf-lead">
              Before any graph math or AI indexing occurs, DevLens isolates pure source files in memory and runs a real compiler front-end across every file in parallel.
            </p>
          </div>

          {/* Bento Grid for Stage 01 + Stage 02 */}
          <div className="hiw2-bento-dark">
            {/* ── Stage 01 Card: Ephemeral RAM-Disk & Sanitizer ── */}
            <div className="hiw2-card-dark hiw2-card-dark--stage1">
              <div className="hiw2-card-top">
                <div>
                  <div className="hiw2-stage-badge mf-mono">
                    <span>STAGE 01</span>
                    <span className="sep">·</span>
                    <span>T+0.00s → 0.62s (0.62s)</span>
                  </div>
                  <h3 className="hiw2-card-h3">
                    Ephemeral <code>tmpfs</code> Clone &amp; Blob Sanitizer
                  </h3>
                </div>
                <button
                  type="button"
                  className="hiw2-pill-btn mf-mono"
                  onClick={() => setPruneEnabled((v) => !v)}
                >
                  {pruneEnabled ? "✓ SANITIZER ACTIVE (4.8 MB)" : "RAW CLONE (184.2 MB)"}
                </button>
              </div>

              <p className="hiw2-card-copy">
                Git protocol v2 negotiates <code>--depth=1 --filter=blob:limit=1m</code> directly into a 512 MB RAM mount. Vendor directories, lockfiles, and binary assets are stripped before parsing.
              </p>

              {/* Interactive File Tree Filter */}
              <div className="hiw2-tree-box">
                <div className="hiw2-tree-header mf-mono">
                  <span>/mnt/ramdisk/job_9f41a/manifest</span>
                  <span>{pruneEnabled ? "312 KEPT · 4,918 PRUNED" : "5,230 RAW FILES"}</span>
                </div>
                <ul className="hiw2-tree-list">
                  {SANITIZER_FILES.map((item) => {
                    const stripped = pruneEnabled && !item.keep;
                    return (
                      <li
                        key={item.path}
                        className="hiw2-tree-item mf-mono"
                        data-stripped={stripped}
                      >
                        <span className="hiw2-tree-path">{item.path}</span>
                        <span className="hiw2-tree-size">{item.size}</span>
                        <span
                          className="hiw2-tree-status"
                          data-keep={item.keep}
                        >
                          {pruneEnabled ? item.reason : "RAW BLOB"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="hiw2-tree-footer">
                  <div className="hiw2-meter-track">
                    <span
                      className="hiw2-meter-fill"
                      style={{ width: pruneEnabled ? "6%" : "100%" }}
                    />
                  </div>
                  <div className="hiw2-meter-meta mf-mono">
                    <span>
                      PAYLOAD: {pruneEnabled ? "4.82 MB UTF-8 SOURCE" : "184.2 MB UNFILTERED"}
                    </span>
                    <span style={{ color: "#10b981" }}>
                      {pruneEnabled ? "97.4% NOISE REMOVED" : "0% REMOVED"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3 Security & Sandbox Guarantees */}
              <div className="hiw2-mini-guarantees">
                <div>
                  <span className="mf-mono">01 / RAM-ONLY TMPFS</span>
                  <p>Mounted with <code>noexec,nosuid</code>; zero source code touches persistent SSDs.</p>
                </div>
                <div>
                  <span className="mf-mono">02 / SYMLINK GUARD</span>
                  <p><code>O_NOFOLLOW</code> traversal prevents path escape outside the workspace root.</p>
                </div>
                <div>
                  <span className="mf-mono">03 / INSTANT UNLINK</span>
                  <p><code>umount -l</code> obliterates the RAM inode table the millisecond Stage 05 finishes.</p>
                </div>
              </div>
            </div>

            {/* ── Stage 02 Wide Card: Interactive Tree-sitter CST Workbench ── */}
            <div className="hiw2-card-dark hiw2-card-dark--stage2">
              <div className="hiw2-card-top">
                <div>
                  <div className="hiw2-stage-badge mf-mono">
                    <span>STAGE 02</span>
                    <span className="sep">·</span>
                    <span>T+0.62s → 2.50s (1.88s)</span>
                  </div>
                  <h3 className="hiw2-card-h3">
                    Parallel Tree-sitter CST Compiler Workbench
                  </h3>
                </div>

                {/* Language Switcher */}
                <div className="hiw2-lang-tabs">
                  {(["ts", "py", "rs"] as GrammarKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="hiw2-lang-tab mf-mono"
                      data-active={grammarKey === key}
                      onClick={() => {
                        setGrammarKey(key);
                        setSelectedLineIdx(2);
                      }}
                    >
                      {GRAMMAR_SAMPLES[key].label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="hiw2-card-copy">
                Click any source line below to inspect how the Rust worker pool translates raw UTF-8 code into a typed Concrete Syntax Tree (CST) and extracts symbol declarations, call expressions, and cyclomatic complexity.
              </p>

              {/* 3-Pane Compiler Triptych */}
              <div className="hiw2-compiler-grid">
                {/* Pane 1: Interactive Source Lines */}
                <div className="hiw2-compiler-pane">
                  <div className="hiw2-compiler-head mf-mono">
                    <span>01 // UTF-8 SOURCE ({currentGrammar.file})</span>
                    <span>CLICK LINE TO INSPECT</span>
                  </div>
                  <div className="hiw2-code-lines mf-mono">
                    {currentGrammar.lines.map((ln, idx) => (
                      <button
                        key={ln.lineNo}
                        type="button"
                        className="hiw2-code-line"
                        data-active={idx === selectedLineIdx}
                        onClick={() => setSelectedLineIdx(idx)}
                      >
                        <span className="hiw2-line-no">{ln.lineNo}</span>
                        <span className="hiw2-line-code">{ln.code}</span>
                      </button>
                    ))}
                  </div>
                  <div className="hiw2-inspector-strip mf-mono">
                    <div>
                      <span className="lbl">ACTIVE AST NODE:</span>{" "}
                      <strong style={{ color: "#10b981" }}>{activeLine.nodeType}</strong>
                    </div>
                    <div>
                      <span className="lbl">BYTE SPAN:</span>{" "}
                      <strong style={{ color: "#fff" }}>{activeLine.span}</strong>
                    </div>
                  </div>
                </div>

                {/* Pane 2: Concrete Syntax Tree S-Expression */}
                <div className="hiw2-compiler-pane">
                  <div className="hiw2-compiler-head mf-mono">
                    <span>02 // TREE-SITTER CST ({currentGrammar.grammar})</span>
                    <span style={{ color: "#10b981" }}>{currentGrammar.parseTime}</span>
                  </div>
                  <pre className="hiw2-sexpr mf-mono">{currentGrammar.sexpr}</pre>
                </div>

                {/* Pane 3: Extracted Symbol & Call Records */}
                <div className="hiw2-compiler-pane">
                  <div className="hiw2-compiler-head mf-mono">
                    <span>03 // EXTRACTED SYMBOL TABLE</span>
                    <span>{currentGrammar.symbols.length} RECORDS</span>
                  </div>
                  <div className="hiw2-sym-list">
                    {currentGrammar.symbols.map((sym) => (
                      <div key={sym.name} className="hiw2-sym-card mf-mono">
                        <div className="hiw2-sym-top">
                          <span className="hiw2-sym-kind">{sym.kind}</span>
                          <span className="hiw2-sym-comp">{sym.complexity}</span>
                        </div>
                        <div className="hiw2-sym-name">{sym.name}</div>
                        <div className="hiw2-sym-meta">SPAN: {sym.span}</div>
                        <div className="hiw2-sym-calls">EDGES: {sym.calls}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          03 · LIGHT ARCHITECTURAL BLUEPRINT LAB (STAGES 03 & 04)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section" data-theme="light">
        <div className="mf-wrap">
          <div className="mf-sec-bar">
            <span className="idx">[03 — 04 / MULTIGRAPH TOPOLOGY & SPATIAL PHYSICS]</span>
            <Pill>Phase II · T+2.50s → T+5.96s</Pill>
            <span className="tag">TARJAN SCC + BARNES-HUT QUADTREE</span>
          </div>

          <div className="hiw2-phase-intro">
            <Reveal>
              <h2 className="mf-h1" style={{ maxWidth: "16.5em" }}>
                Resolve every import edge.{" "}
                <span className="mf-serif-i" style={{ fontWeight: 400, color: "var(--mf-ink-3)" }}>
                  Score blast-radius risk with graph physics.
                </span>
              </h2>
            </Reveal>
            <p className="mf-lead">
              Disconnected AST tables are stitched into a directed multigraph, checked for circular dependencies via Tarjan’s algorithm, and laid out in 2D space using Barnes-Hut quadtrees.
            </p>
          </div>

          {/* 2-Column Asymmetric Architectural Lab */}
          <div className="hiw2-blueprint-grid">
            {/* ── Left Column: Stage 03 Dependency Multigraph & Cycle Solver ── */}
            <div className="hiw2-blueprint-card">
              <div className="hiw2-bp-head">
                <div>
                  <div className="hiw2-bp-tag mf-mono">
                    STAGE 03 · T+2.50s → 3.91s (1.41s)
                  </div>
                  <h3 className="hiw2-bp-title">
                    Directed Multigraph &amp; Tarjan Cycle Solver
                  </h3>
                </div>
                <span className="hiw2-bp-pill mf-mono">O(V + E) LINEAR</span>
              </div>

              <p className="hiw2-bp-desc">
                Resolves <code>tsconfig.json</code> aliases, workspace barrels, and cross-file call sites into typed directed edges (<code>E_import ∪ E_call ∪ E_inherit</code>). Select any edge below to inspect its path resolution and cycle status.
              </p>

              {/* Interactive SVG Topology Schematic */}
              <div className="hiw2-svg-frame">
                <div className="hiw2-svg-bar mf-mono">
                  <span>MULTIGRAPH SUBGRAPH // 5 NODES · 4 DIRECTED EDGES</span>
                  <span style={{ color: "#ef4444" }}>● 1 TARJAN SCC CYCLE</span>
                </div>
                <svg
                  viewBox="0 0 620 250"
                  className="hiw2-svg"
                  role="img"
                  aria-label="Interactive dependency multigraph diagram"
                >
                  <defs>
                    <marker
                      id="hiw2-arrow-ok"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                    </marker>
                    <marker
                      id="hiw2-arrow-err"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                    </marker>
                    <marker
                      id="hiw2-arrow-dim"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#666" />
                    </marker>
                  </defs>

                  {/* E-01: ingestController -> builder */}
                  <path
                    d="M 155 72 C 215 72, 225 112, 275 112"
                    fill="none"
                    stroke={selectedEdgeIdx === 0 ? "#10b981" : "#525252"}
                    strokeWidth={selectedEdgeIdx === 0 ? 2.6 : 1.4}
                    strokeDasharray={selectedEdgeIdx === 0 ? "6 4" : undefined}
                    markerEnd={
                      selectedEdgeIdx === 0 ? "url(#hiw2-arrow-ok)" : "url(#hiw2-arrow-dim)"
                    }
                  />
                  {/* E-02: ingestController -> verifyToken */}
                  <path
                    d="M 155 56 C 230 22, 370 22, 455 56"
                    fill="none"
                    stroke={selectedEdgeIdx === 1 ? "#10b981" : "#525252"}
                    strokeWidth={selectedEdgeIdx === 1 ? 2.6 : 1.4}
                    strokeDasharray={selectedEdgeIdx === 1 ? "6 4" : undefined}
                    markerEnd={
                      selectedEdgeIdx === 1 ? "url(#hiw2-arrow-ok)" : "url(#hiw2-arrow-dim)"
                    }
                  />
                  {/* E-03: builder <-> spatialLayout (Tarjan Cycle) */}
                  <path
                    d="M 325 142 C 325 182, 240 198, 175 192"
                    fill="none"
                    stroke={selectedEdgeIdx === 2 ? "#ef4444" : "#991b1b"}
                    strokeWidth={selectedEdgeIdx === 2 ? 2.8 : 1.6}
                    strokeDasharray="5 4"
                    markerEnd="url(#hiw2-arrow-err)"
                  />
                  <path
                    d="M 175 174 C 235 162, 275 152, 295 142"
                    fill="none"
                    stroke={selectedEdgeIdx === 2 ? "#ef4444" : "#991b1b"}
                    strokeWidth={selectedEdgeIdx === 2 ? 2.8 : 1.6}
                    strokeDasharray="5 4"
                    markerEnd="url(#hiw2-arrow-err)"
                  />
                  {/* E-04: builder -> pgvectorClient */}
                  <path
                    d="M 385 125 C 425 125, 440 175, 465 182"
                    fill="none"
                    stroke={selectedEdgeIdx === 3 ? "#10b981" : "#525252"}
                    strokeWidth={selectedEdgeIdx === 3 ? 2.6 : 1.4}
                    strokeDasharray={selectedEdgeIdx === 3 ? "6 4" : undefined}
                    markerEnd={
                      selectedEdgeIdx === 3 ? "url(#hiw2-arrow-ok)" : "url(#hiw2-arrow-dim)"
                    }
                  />

                  {/* Nodes */}
                  <g
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedEdgeIdx(0)}
                  >
                    <rect
                      x="22"
                      y="44"
                      width="134"
                      height="46"
                      rx="8"
                      fill="#141414"
                      stroke={selectedEdgeIdx <= 1 ? "#10b981" : "#404040"}
                      strokeWidth="1.5"
                    />
                    <text x="34" y="65" fill="#fff" fontSize="10.5" fontFamily="monospace">
                      ingestController.ts
                    </text>
                    <text x="34" y="80" fill="#8a8a8a" fontSize="9" fontFamily="monospace">
                      API ENTRY · fanOut=6
                    </text>
                  </g>

                  <g
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedEdgeIdx(0)}
                  >
                    <rect
                      x="275"
                      y="94"
                      width="112"
                      height="50"
                      rx="8"
                      fill="#141414"
                      stroke="#10b981"
                      strokeWidth="2"
                    />
                    <text x="288" y="116" fill="#fff" fontSize="11" fontWeight="600" fontFamily="monospace">
                      builder.ts
                    </text>
                    <text x="288" y="132" fill="#10b981" fontSize="9" fontFamily="monospace">
                      HUB · fanIn=34
                    </text>
                  </g>

                  <g
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedEdgeIdx(1)}
                  >
                    <rect
                      x="456"
                      y="42"
                      width="140"
                      height="46"
                      rx="8"
                      fill="#141414"
                      stroke={selectedEdgeIdx === 1 ? "#10b981" : "#404040"}
                      strokeWidth="1.5"
                    />
                    <text x="468" y="63" fill="#fff" fontSize="10.5" fontFamily="monospace">
                      verifyToken.ts
                    </text>
                    <text x="468" y="78" fill="#8a8a8a" fontSize="9" fontFamily="monospace">
                      AUTH GATE · fanIn=19
                    </text>
                  </g>

                  <g
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedEdgeIdx(2)}
                  >
                    <rect
                      x="38"
                      y="164"
                      width="138"
                      height="48"
                      rx="8"
                      fill="#1f0d0d"
                      stroke="#ef4444"
                      strokeWidth="1.8"
                    />
                    <text x="50" y="185" fill="#fecaca" fontSize="10.5" fontFamily="monospace">
                      spatialLayout.ts
                    </text>
                    <text x="50" y="201" fill="#ef4444" fontSize="9" fontFamily="monospace">
                      SCC CYCLE #1 ⇄
                    </text>
                  </g>

                  <g
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedEdgeIdx(3)}
                  >
                    <rect
                      x="464"
                      y="164"
                      width="134"
                      height="46"
                      rx="8"
                      fill="#141414"
                      stroke={selectedEdgeIdx === 3 ? "#10b981" : "#404040"}
                      strokeWidth="1.5"
                    />
                    <text x="476" y="185" fill="#fff" fontSize="10.5" fontFamily="monospace">
                      pgvectorClient.ts
                    </text>
                    <text x="476" y="200" fill="#8a8a8a" fontSize="9" fontFamily="monospace">
                      HNSW SINK · fanIn=8
                    </text>
                  </g>
                </svg>
              </div>

              {/* Edge Selector Buttons */}
              <div className="hiw2-edge-selector">
                {GRAPH_EDGES.map((edge, idx) => (
                  <button
                    key={edge.id}
                    type="button"
                    className="hiw2-edge-item"
                    data-active={idx === selectedEdgeIdx}
                    onClick={() => setSelectedEdgeIdx(idx)}
                  >
                    <div className="hiw2-edge-top mf-mono">
                      <span>
                        {edge.id} // {edge.kind}
                      </span>
                      <span
                        className="hiw2-edge-badge"
                        data-accent={edge.accent}
                      >
                        {edge.status}
                      </span>
                    </div>
                    <div className="hiw2-edge-raw mf-mono">{edge.raw}</div>
                  </button>
                ))}
              </div>

              {/* Active Edge Resolution Readout */}
              <div className="hiw2-edge-readout">
                <div className="mf-mono" style={{ fontSize: "0.72rem", color: "#10b981" }}>
                  RESOLVED AST EDGE: {activeEdge.resolved}
                </div>
                <p>{activeEdge.detail}</p>
              </div>
            </div>

            {/* ── Right Column: Stage 04 Barnes-Hut Force & Risk Formula Lab ── */}
            <div className="hiw2-blueprint-card">
              <div className="hiw2-bp-head">
                <div>
                  <div className="hiw2-bp-tag mf-mono">
                    STAGE 04 · T+3.91s → 5.96s (2.05s)
                  </div>
                  <h3 className="hiw2-bp-title">
                    Barnes-Hut Spatial Layout &amp; Blast-Radius Scorer
                  </h3>
                </div>
                <span className="hiw2-bp-pill mf-mono">O(V LOG V) QUADTREE</span>
              </div>

              <p className="hiw2-bp-desc">
                300 headless quadtree ticks compute deterministic <code>(x, y)</code> coordinates and domain hulls, while every file’s structural risk weight <code>W(v)</code> is scored from three normalized signals:
              </p>

              {/* Mathematical Risk Equation Box */}
              <div className="hiw2-formula-card">
                <div className="hiw2-formula-label mf-mono">
                  COMPOSITE NODE RISK &amp; GRAVITY EQUATION
                </div>
                <div className="hiw2-formula-math">
                  W(v) = <span className="c-fan">0.45·FanIn(v)</span> +{" "}
                  <span className="c-cyc">0.35·Cyclomatic(v)</span> +{" "}
                  <span className="c-chu">0.20·GitChurn₉₀d(v)</span>
                </div>
                <div className="hiw2-formula-legend mf-mono">
                  <span>
                    <i style={{ background: "#0a0a0a" }} /> 45% INBOUND DEPENDENTS
                  </span>
                  <span>
                    <i style={{ background: "#10b981" }} /> 35% AST BRANCH COMPLEXITY
                  </span>
                  <span>
                    <i style={{ background: "#f59e0b" }} /> 20% 90-DAY COMMIT CHURN
                  </span>
                </div>
              </div>

              {/* Interactive Hotspot Simulator */}
              <div className="hiw2-hotspot-list">
                {HOTSPOT_FILES.map((hs, idx) => {
                  const fanPct = Math.round(hs.fanInNorm * 45);
                  const cycPct = Math.round(hs.cycloNorm * 35);
                  const chuPct = Math.round(hs.churnNorm * 20);
                  return (
                    <button
                      key={hs.file}
                      type="button"
                      className="hiw2-hotspot-row"
                      data-active={idx === selectedHotspotIdx}
                      onClick={() => setSelectedHotspotIdx(idx)}
                    >
                      <div className="hiw2-hotspot-top">
                        <span className="hiw2-hotspot-file mf-mono">{hs.file}</span>
                        <span className="hiw2-hotspot-score mf-mono">
                          W(v) = {hs.score.toFixed(2)}
                        </span>
                      </div>
                      <div className="hiw2-hotspot-bar">
                        <span
                          style={{ width: `${fanPct}%`, background: "#0a0a0a" }}
                          title={`FanIn contribution: ${fanPct}%`}
                        />
                        <span
                          style={{ width: `${cycPct}%`, background: "#10b981" }}
                          title={`Cyclomatic contribution: ${cycPct}%`}
                        />
                        <span
                          style={{ width: `${chuPct}%`, background: "#f59e0b" }}
                          title={`GitChurn contribution: ${chuPct}%`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Hotspot Blast Radius Breakdown */}
              <div className="hiw2-blast-readout">
                <div className="hiw2-blast-header mf-mono">
                  <span>SELECTED: {activeHotspot.file}</span>
                  <span style={{ color: "#10b981" }}>{activeHotspot.tier}</span>
                </div>
                <div className="hiw2-blast-metrics">
                  <div>
                    <strong className="mf-mono">
                      {(0.45 * activeHotspot.fanInNorm).toFixed(2)} +{" "}
                      {(0.35 * activeHotspot.cycloNorm).toFixed(2)} +{" "}
                      {(0.2 * activeHotspot.churnNorm).toFixed(2)} ={" "}
                      {activeHotspot.score.toFixed(2)}
                    </strong>
                    <span className="mf-mono">EXACT W(V) DECOMPOSITION</span>
                  </div>
                  <div>
                    <strong className="mf-mono">
                      {activeHotspot.hop1} direct / {activeHotspot.hop2} transitive
                    </strong>
                    <span className="mf-mono">1-HOP &amp; 2-HOP BLAST RADIUS</span>
                  </div>
                </div>
                <p className="hiw2-blast-note">{activeHotspot.note}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          04 · DARK SPOTLIGHT: STAGE 05 AST-BOUNDED VECTOR INDEXING
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section mf-dark" data-theme="dark">
        <div className="mf-wrap">
          <div className="mf-sec-bar">
            <span className="idx">[05 / AST-ENVELOPE VECTOR INDEX & CITATION LOCK]</span>
            <Pill>Phase III · T+5.96s → T+7.40s</Pill>
            <span className="tag">PGVECTOR HNSW + GRAPH NEIGHBORHOOD HEADER</span>
          </div>

          <div className="hiw2-phase-intro">
            <Reveal>
              <h2 className="mf-h1" style={{ maxWidth: "16em" }}>
                Never slice a function in half.{" "}
                <span className="mf-serif-i" style={{ fontWeight: 400, color: "#a3a3a3" }}>
                  Anchor every answer to a line range.
                </span>
              </h2>
            </Reveal>
            <p className="mf-lead">
              Standard RAG tools chop source code every 500 tokens—severing signatures from return statements and hallucinating imports. DevLens chunks strictly along Tree-sitter AST declaration envelopes and injects 1-hop graph context before embedding.
            </p>
          </div>

          <div className="hiw2-stage5-grid">
            {/* Left: Interactive AST Chunker vs Naive Token Splitter */}
            <div className="hiw2-card-dark">
              <div className="hiw2-card-top">
                <div>
                  <div className="hiw2-stage-badge mf-mono">
                    <span>STAGE 05 CHUNKING ENGINE</span>
                    <span className="sep">·</span>
                    <span>T+5.96s → 7.40s (1.44s)</span>
                  </div>
                  <h3 className="hiw2-card-h3">
                    AST-Envelope Chunker vs. Naive 500-Token Splitter
                  </h3>
                </div>

                <div className="hiw2-chunk-toggle mf-mono">
                  <button
                    type="button"
                    data-active={chunkMode === "ast"}
                    onClick={() => setChunkMode("ast")}
                  >
                    ✓ DEVLENS AST-ENVELOPE
                  </button>
                  <button
                    type="button"
                    data-active={chunkMode === "naive"}
                    onClick={() => setChunkMode("naive")}
                  >
                    ✕ NAIVE 500-TOKEN RAG
                  </button>
                </div>
              </div>

              {chunkMode === "ast" ? (
                <div className="hiw2-chunk-view hiw2-chunk-view--good">
                  <div className="hiw2-chunk-banner mf-mono">
                    <span>✓ COMPLETE AST FUNCTION ENVELOPE + INJECTED GRAPH HEADER</span>
                    <span>100% CITATION ACCURACY</span>
                  </div>
                  <pre className="mf-mono">{`# [DEVLENS_AST_HEADER]
# file: src/auth/verifyToken.ts | lines: 17-23 | bytes: [96..372]
# symbol: export async function verifySessionToken(raw: string)
# callers (1-hop): src/api/ingestController.ts:42 (+18 routes)
# callees (1-hop): jose.jwtVerify, src/db/sessionStore.ts:48
# risk_score: W(v)=0.78 [HIGH_RISK] | cyclomatic: M=4

17 │ export async function verifySessionToken(raw: string) {
18 │   const { payload } = await jwtVerify(raw, JWT_KEY);
19 │   if (!payload.sub || payload.exp! < Date.now() / 1000) {
20 │     throw new AuthExpiredError('SESSION_EXPIRED');
21 │   }
22 │   return SessionStore.hydrate(payload.sub);
23 │ }`}</pre>
                </div>
              ) : (
                <div className="hiw2-chunk-view hiw2-chunk-view--bad">
                  <div className="hiw2-chunk-banner mf-mono">
                    <span>✕ BROKEN FIXED-WINDOW SPLIT (SEVERED AT TOKEN #500)</span>
                    <span>ORPHANED CONTEXT · 38% HALLUCINATION RISK</span>
                  </div>
                  <pre className="mf-mono">{`// --- CHUNK #41 (tokens 0..500) ---
export async function verifySessionToken(raw: string) {
  const { payload } = await jwtVerify(raw, JWT_KEY);
  if (!payload.sub || payload.ex
// ✂ [SEVERED MID-EXPRESSION AT 500 TOKENS — NO CALLER METADATA]

// --- CHUNK #42 (tokens 501..1000 — ORPHANED SIGNATURE) ---
p! < Date.now() / 1000) {
    throw new AuthExpiredError('SESSION_EXPIRED');
  }
  return SessionStore.hydrate(payload.sub);
}`}</pre>
                </div>
              )}

              <div className="hiw2-chunk-metrics mf-mono">
                <div>
                  <strong>{chunkMode === "ast" ? "840" : "2,190"}</strong>
                  <span>VECTOR CHUNKS</span>
                </div>
                <div>
                  <strong>{chunkMode === "ast" ? "0" : "412"}</strong>
                  <span>MID-FUNCTION CUTS</span>
                </div>
                <div>
                  <strong>{chunkMode === "ast" ? "100%" : "62%"}</strong>
                  <span>VERIFIED LINE CITATIONS</span>
                </div>
              </div>
            </div>

            {/* Right: Live HNSW Retrieval & Grounded Answer Tracer */}
            <div className="hiw2-card-dark">
              <div className="hiw2-card-top">
                <div>
                  <div className="hiw2-stage-badge mf-mono">
                    <span>PGVECTOR HNSW + GRAPH EXPANSION</span>
                    <span className="sep">·</span>
                    <span>1,536-DIM COSINE</span>
                  </div>
                  <h3 className="hiw2-card-h3">
                    Interactive Query-to-Citation Trace
                  </h3>
                </div>
              </div>

              <p className="hiw2-card-copy">
                Select an engineering query below to trace how DevLens combines `pgvector` HNSW cosine similarity with 1-hop multigraph neighbors to guarantee verifiable `[file:line]` citations.
              </p>

              <div className="hiw2-query-list">
                {COPILOT_TRACES.map((tr, idx) => (
                  <button
                    key={tr.question}
                    type="button"
                    className="hiw2-query-btn"
                    data-active={idx === selectedTraceIdx}
                    onClick={() => setSelectedTraceIdx(idx)}
                  >
                    <span className="hiw2-query-q">“{tr.question}”</span>
                  </button>
                ))}
              </div>

              <div className="hiw2-trace-box">
                <div className="hiw2-trace-steps mf-mono">
                  <div className="hiw2-trace-step">
                    <span className="k">01 // HNSW TOP HIT</span>
                    <span className="v" style={{ color: "#10b981" }}>
                      {activeTrace.topChunk} (cosine={activeTrace.similarity})
                    </span>
                  </div>
                  <div className="hiw2-trace-step">
                    <span className="k">02 // 1-HOP GRAPH EXPANSION</span>
                    <span className="v">{activeTrace.neighborHop}</span>
                  </div>
                </div>

                <div className="hiw2-trace-answer">
                  <div className="hiw2-trace-answer-head mf-mono">
                    <span>GROUNDED RESPONSE</span>
                    <span style={{ color: "#10b981" }}>✓ CITATIONS VERIFIED</span>
                  </div>
                  <p>{activeTrace.answer}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          05 · LIGHT FINALE: LIVE PIPELINE LAUNCHER CTA
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section" data-theme="light">
        <div className="mf-wrap">
          <div className="hiw2-finale-box">
            <div className="hiw2-finale-left">
              <Pill live>Ready to Run · 7.40s Cold Pipeline</Pill>
              <h2 className="mf-h1" style={{ marginTop: 20, marginBottom: 16 }}>
                Point the pipeline at{" "}
                <span className="mf-serif-i" style={{ fontWeight: 400 }}>
                  your own repository.
                </span>
              </h2>
              <p className="mf-lead" style={{ marginBottom: 28 }}>
                Paste any public or private GitHub repository URL to watch all five stages execute live and explore your interactive architecture map, blast-radius radar, and cited copilot.
              </p>

              <form onSubmit={handleLaunchRepo} className="mf-ingest" style={{ maxWidth: 620 }}>
                <span
                  className="mf-mono mf-muted"
                  style={{ paddingLeft: 18, fontSize: "0.75rem" }}
                >
                  git://
                </span>
                <input
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="https://github.com/owner/repository"
                  aria-label="GitHub repository URL"
                />
                <button type="submit" className="mf-btn">
                  <span>Run 5-Stage Pipeline</span>
                  <span className="mf-arrow">↗</span>
                </button>
              </form>

              <div className="hiw2-finale-chips">
                <span className="mf-mono mf-muted" style={{ fontSize: "0.68rem" }}>
                  INSTANT PRESETS:
                </span>
                {SAMPLE_REPOS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="mf-pill mf-chip"
                    onClick={() => {
                      setRepoInput(`https://github.com/${r}`);
                      navigate({ to: "/dashboard" });
                    }}
                  >
                    {r} ↗
                  </button>
                ))}
              </div>
            </div>

            <div className="hiw2-finale-right mf-mono">
              <div className="hiw2-finale-summary-head">
                <span>PIPELINE EXECUTION SUMMARY</span>
                <span style={{ color: "#10b981" }}>7.40s TOTAL</span>
              </div>
              <ul className="hiw2-finale-timeline">
                {STAGES.map((st) => (
                  <li key={st.id}>
                    <span className="num">{st.num}</span>
                    <span className="nm">{st.name}</span>
                    <span className="tm">{st.delta}</span>
                  </li>
                ))}
              </ul>
              <div className="hiw2-finale-foot">
                <span>RAM FOOTPRINT: 0 MB PERSISTED</span>
                <span>CITATIONS: 100% LOCKED</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
export default HowItWorksPage;
