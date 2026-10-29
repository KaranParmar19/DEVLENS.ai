import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence, useInView, useScroll, useSpring } from "motion/react";
import { Pill, Reveal, SiteLayout } from "./site-layout";
import { MorphText } from "@/components/ui/morph-text";
import { normalizeRepoUrl } from "@/lib/utils";

/* ═══ HOW IT WORKS — DATA ═══════════════════════════════════════════════ */

const TOTAL_SECONDS = 7.4;
const REPLAY_SPEED = 2;

interface Stage {
  n: string;
  short: string;
  code: string;
  title: string;
  worker: string;
  start: number;
  dur: number;
  wsEvent: string;
  logs: string[];
  metricLabel: string;
  metricVal: string;
  metricSub: string;
}

const STAGES: Stage[] = [
  {
    n: "01",
    short: "Clone",
    code: "STAGE_CLONE",
    title: "Shallow Ephemeral Clone",
    worker: "CLONE_SANDBOX",
    start: 0,
    dur: 0.62,
    wsEvent: "ws://stream.devlens.ai/job/9f8a -> { stage: 'CLONE', status: 'MOUNTED_TMPFS' }",
    logs: [
      "$ git clone --depth 1 --no-tags --single-branch https://github.com/vercel/next.js /tmpfs/job_9f8a",
      "[sandbox] mounted 512MB RAM disk (no-exec, read-only net after fetch)",
      "[filter] stripped 1,412 binary assets, lockfiles, and vendored blobs",
      "[ready] 4,820 source files queued for grammar dispatch (620ms)",
    ],
    metricLabel: "DISK FOOTPRINT",
    metricVal: "0 MB Persisted",
    metricSub: "100% in-memory tmpfs sandbox; wiped on socket close",
  },
  {
    n: "02",
    short: "Parse",
    code: "STAGE_AST",
    title: "Tree-sitter Grammar Parse",
    worker: "RUST_TREESITTER_8X",
    start: 0.62,
    dur: 1.88,
    wsEvent: "ws://stream.devlens.ai/job/9f8a -> { stage: 'AST_PARSE', symbols: 38410 }",
    logs: [
      "[parser] spawned 8 parallel Rust Tree-sitter worker threads",
      "[grammar] detected TypeScript (74%), Rust (18%), Python (5%), CSS (3%)",
      "[ast] extracted 38,410 function/class declarations & 14,920 import specifiers",
      "[entry] identified 19 HTTP route entrypoints and 4 worker consumers (1,880ms)",
    ],
    metricLabel: "PARSE THROUGHPUT",
    metricVal: "38,410 Symbols",
    metricSub: "Zero regex heuristics — full concrete syntax trees",
  },
  {
    n: "03",
    short: "Graph",
    code: "STAGE_GRAPH",
    title: "Dependency Multigraph",
    worker: "TARJAN_SCC + PAGERANK",
    start: 2.5,
    dur: 1.41,
    wsEvent: "ws://stream.devlens.ai/job/9f8a -> { stage: 'GRAPH_SOLVE', edges: 14920, cycles: 3 }",
    logs: [
      "[resolver] mapped tsconfig paths (@/*) and Cargo workspace members",
      "[graph] constructed directed multigraph: 4,820 nodes · 14,920 edges",
      "[tarjan] ran Strongly Connected Components -> flagged 3 circular import loops",
      "[pagerank] scored fan-in centrality & cyclomatic complexity per module (1,410ms)",
    ],
    metricLabel: "GRAPH TOPOLOGY",
    metricVal: "14,920 Edges",
    metricSub: "Tarjan SCC cycle detection + PageRank hub scoring",
  },
  {
    n: "04",
    short: "Layout",
    code: "STAGE_LAYOUT",
    title: "Spatial Hull Clustering",
    worker: "BARNES_HUT_QUADTREE",
    start: 3.91,
    dur: 2.05,
    wsEvent: "ws://stream.devlens.ai/job/9f8a -> { stage: 'FORCE_LAYOUT', clusters: 16 }",
    logs: [
      "[layout] running Barnes-Hut N-body force simulation (theta = 0.8)",
      "[hulls] grouped 4,820 nodes into 16 convex package boundaries",
      "[blast] pre-computed 1-hop and 2-hop impact radii for all high-coupling hubs",
      "[export] serialized interactive WebGL / SVG viewport coordinates (2,050ms)",
    ],
    metricLabel: "SPATIAL CLUSTERS",
    metricVal: "16 Module Hulls",
    metricSub: "Pre-computed 2-hop blast radius for instant hover inspect",
  },
  {
    n: "05",
    short: "Index",
    code: "STAGE_VECTOR",
    title: "AST-Bounded Vector Index",
    worker: "PGVECTOR_HNSW",
    start: 5.96,
    dur: 1.44,
    wsEvent: "ws://stream.devlens.ai/job/9f8a -> { stage: 'COMPLETE', ready: true, totalMs: 7400 }",
    logs: [
      "[chunker] sliced source along AST function/class boundaries (never mid-block)",
      "[context] prepended caller/callee graph headers to 9,640 semantic chunks",
      "[pgvector] batch-inserted HNSW embeddings + symbol cross-reference table",
      "[done] workspace live! Streaming onboarding dossier & opening studio (7.40s total)",
    ],
    metricLabel: "CITATION PRECISION",
    metricVal: "100% Line-Bound",
    metricSub: "AST-bounded chunks linked to exact file:line ranges",
  },
];

const AST_GRAMMAR_SAMPLES = [
  {
    lang: "TypeScript",
    badge: "tree-sitter-typescript",
    source: `export async function verifySession(token: string): Promise<UserClaim> {
  const payload = await jwt.verify(token, ENV.PUBLIC_KEY);
  return db.users.findUnique({ where: { id: payload.sub } });
}`,
    sexpr: `(export_statement
  (function_declaration
    name: (identifier) @fn.def ["verifySession" · L1:22]
    parameters: (formal_parameters (required_parameter (identifier)))
    return_type: (type_annotation (generic_type (type_identifier) ["UserClaim"]))
    body: (statement_block
      (lexical_declaration (variable_declarator
        value: (await_expression (call_expression
          function: (member_expression object: (identifier) ["jwt"] property: (property_identifier) ["verify"])))))
      (return_statement (call_expression
        function: (member_expression ["db.users.findUnique"]))))))`,
    extracted: ["fn: verifySession (L1–L4)", "call: jwt.verify (L2)", "call: db.users.findUnique (L3)", "type: Promise<UserClaim>"],
  },
  {
    lang: "Python",
    badge: "tree-sitter-python",
    source: `async def check_db_health(session: AsyncSession) -> bool:
    result = await session.execute(text("SELECT 1"))
    return result.scalar() == 1`,
    sexpr: `(function_definition
  name: (identifier) @fn.def ["check_db_health" · L1:10]
  parameters: (parameters (typed_parameter (identifier) type: (type (identifier) ["AsyncSession"])))
  return_type: (type (identifier) ["bool"])
  body: (block
    (expression_statement (assignment
      right: (await (call function: (attribute object: (identifier) ["session"] attribute: (identifier) ["execute"])))))
    (return_statement (comparison_operator (call ["result.scalar"]) ["== 1"]))))`,
    extracted: ["fn: check_db_health (L1–L3)", "param: session: AsyncSession", "call: session.execute (L2)", "call: text('SELECT 1')"],
  },
  {
    lang: "Rust",
    badge: "tree-sitter-rust",
    source: `pub fn compute_blast_radius(graph: &DiGraph, root: NodeIndex) -> Vec<NodeIndex> {
    Bfs::new(graph, root).iter(graph).collect()
}`,
    sexpr: `(function_item
  (visibility_modifier) ["pub"]
  name: (identifier) @fn.def ["compute_blast_radius" · L1:7]
  parameters: (parameters
    (parameter pattern: (identifier) type: (reference_type (type_identifier) ["DiGraph"]))
    (parameter pattern: (identifier) type: (type_identifier) ["NodeIndex"]))
  return_type: (generic_type (type_identifier) ["Vec"] (type_arguments (type_identifier) ["NodeIndex"]))
  body: (block (call_expression function: (field_expression field: (field_identifier) ["collect"]))))`,
    extracted: ["fn: pub compute_blast_radius (L1–L3)", "ref: &DiGraph", "call: Bfs::new (L2)", "return: Vec<NodeIndex>"],
  },
];

const RESOLVED_EDGES = [
  {
    raw: `import { check_db_health } from "@/app/database"`,
    from: "src/api/routes/health.py:13",
    to: "src/app/database.py:61",
    status: "LOAD-BEARING HUB",
    statusColor: "#10b981",
    fanIn: "19 importers",
    detail: "Alias '@/' resolved via project root config; target function verified at line 61 with 0 circular loops.",
  },
  {
    raw: `import { SessionGuard } from "../auth/guard"`,
    from: "src/ws/stream_handler.ts:8",
    to: "src/auth/guard.ts:42",
    status: "SECURITY BOUNDARY",
    statusColor: "#3b82f6",
    fanIn: "14 importers",
    detail: "Relative POSIX path normalized; guards all authenticated WebSocket & REST analysis endpoints.",
  },
  {
    raw: `import { dispatchTask } from "./worker_pool"`,
    from: "src/scheduler/queue.ts:104",
    to: "src/scheduler/worker_pool.ts:19",
    status: "CYCLE DETECTED (SCC)",
    statusColor: "#ef4444",
    fanIn: "2-node mutual loop",
    detail: "Tarjan SCC flagged a bidirectional import loop between queue.ts and worker_pool.ts (drift penalty +18%).",
  },
];

/* Mini dependency graph (drawn in stage 03) */
const GRAPH_NODES = [
  { id: "gateway", label: "api/gateway.ts", x: 70, y: 56 },
  { id: "health", label: "routes/health.py", x: 250, y: 36 },
  { id: "database", label: "app/database.py", x: 450, y: 70 },
  { id: "stream", label: "ws/stream_handler.ts", x: 80, y: 168 },
  { id: "guard", label: "auth/guard.ts", x: 300, y: 168 },
  { id: "queue", label: "scheduler/queue.ts", x: 120, y: 272 },
  { id: "pool", label: "scheduler/worker_pool.ts", x: 380, y: 272 },
];

const GRAPH_EDGES: { id: string; from: string; to: string; edge: number | null; cycle?: boolean }[] = [
  { id: "g-1", from: "gateway", to: "health", edge: null },
  { id: "g-2", from: "gateway", to: "stream", edge: null },
  { id: "e-0", from: "health", to: "database", edge: 0 },
  { id: "e-1", from: "stream", to: "guard", edge: 1 },
  { id: "g-3", from: "gateway", to: "guard", edge: null },
  { id: "e-2", from: "queue", to: "pool", edge: 2, cycle: true },
  { id: "e-2b", from: "pool", to: "queue", edge: 2, cycle: true },
  { id: "g-4", from: "guard", to: "database", edge: null },
];

/* Sample hotspot snapshot for the weight lab (stage 04) */
const WEIGHT_SAMPLES = [
  { file: "src/ast/tree_sitter_runner.py", fanIn: 0.6, cyclomatic: 0.78, churn: 0.82, note: "12 dependents · cyclomatic 31" },
  { file: "src/api/gateway.ts", fanIn: 0.95, cyclomatic: 0.45, churn: 0.55, note: "19 dependents · cyclomatic 18" },
  { file: "src/graph/blast-radius.ts", fanIn: 0.45, cyclomatic: 0.6, churn: 0.64, note: "9 dependents · cyclomatic 24" },
  { file: "src/ui/footer.tsx", fanIn: 0.1, cyclomatic: 0.12, churn: 0.2, note: "2 dependents · cyclomatic 5" },
];

const SANITIZE_ROWS = [
  { path: "src/", keep: true, meta: "4,820 files" },
  { path: "packages/core/", keep: true, meta: "kept" },
  { path: "node_modules/", keep: false, meta: "vendored" },
  { path: "dist/ build/ .next/", keep: false, meta: "build output" },
  { path: ".venv/ __pycache__/", keep: false, meta: "env cache" },
  { path: "*.min.js  *.map", keep: false, meta: "minified" },
  { path: "pnpm-lock.yaml  *.lock", keep: false, meta: "lockfiles" },
  { path: "assets/*.png  *.woff2", keep: false, meta: "binary blobs" },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const stageAt = (t: number) => {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (t >= STAGES[i].start) return i;
  }
  return 0;
};
const fmtEnd = (s: Stage) => (s.start + s.dur).toFixed(2);

/* ═══ STAGE INSTRUMENTS ═════════════════════════════════════════════════ */

function SanitizeInstrument() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  const [swept, setSwept] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const t = window.setTimeout(() => setSwept(true), 650);
    return () => window.clearTimeout(t);
  }, [inView]);

  return (
    <div className="hw-instrument" ref={ref}>
      <div className="hw-instrument-head">
        <span>/tmpfs/job_9f8a · 512 MB · noexec</span>
        <button type="button" className="hw-mini-btn" onClick={() => setSwept((s) => !s)}>
          {swept ? "↺ Show raw clone" : "▶ Sanitize"}
        </button>
      </div>
      <ul className="hw-tree">
        {SANITIZE_ROWS.map((row, i) => (
          <li
            key={row.path}
            className="hw-tree-row"
            data-strip={swept && !row.keep}
            style={{ transitionDelay: swept ? `${i * 70}ms` : "0ms" }}
          >
            <span className="hw-tree-path">{row.path}</span>
            <span className="hw-tree-meta">{row.meta}</span>
            <span className="hw-tree-tag" data-keep={row.keep}>
              {row.keep ? "KEEP" : swept ? "STRIPPED" : "PENDING"}
            </span>
          </li>
        ))}
      </ul>
      <div className="hw-gauge">
        <div className="hw-gauge-bar">
          <span className="hw-gauge-kept" style={{ width: swept ? "77%" : "100%" }} />
        </div>
        <div className="hw-gauge-legend">
          <span>{swept ? "4,820 source files kept" : "6,232 raw files fetched"}</span>
          <span>{swept ? "1,412 blobs stripped" : "sanitizer queued"}</span>
        </div>
      </div>
    </div>
  );
}

function GraphInstrument({ edgeIdx, onSelect }: { edgeIdx: number; onSelect: (i: number) => void }) {
  const pos = useMemo(() => Object.fromEntries(GRAPH_NODES.map((n) => [n.id, n])), []);
  const activeEdge = RESOLVED_EDGES[edgeIdx] ?? RESOLVED_EDGES[0];

  return (
    <div className="hw-graph-layout">
      <div className="hw-instrument hw-graph-card">
        <div className="hw-instrument-head">
          <span>DIRECTED MULTIGRAPH · SAMPLE SUBGRAPH</span>
          <span className="hw-legend">
            <i style={{ background: "#10b981" }} /> hub
            <i style={{ background: "#3b82f6" }} /> boundary
            <i style={{ background: "#ef4444" }} /> cycle
          </span>
        </div>
        <svg viewBox="0 0 580 320" className="hw-graph-svg" role="img" aria-label="Sample dependency graph">
          <defs>
            {["#6b6b6b", "#10b981", "#3b82f6", "#ef4444"].map((c) => (
              <marker key={c} id={`hw-arrow-${c.slice(1)}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill={c} />
              </marker>
            ))}
          </defs>
          {GRAPH_EDGES.map((e) => {
            const a = pos[e.from];
            const b = pos[e.to];
            const selected = e.edge !== null && e.edge === edgeIdx;
            const base = e.edge !== null ? RESOLVED_EDGES[e.edge].statusColor : "#6b6b6b";
            const color = selected || e.cycle ? base : "#6b6b6b";
            const offset = e.cycle ? (e.id === "e-2" ? -9 : 9) : 0;
            const x1 = a.x + 38;
            const y1 = a.y + 12 + offset;
            const x2 = b.x + 38;
            const y2 = b.y + 12 + offset;
            return (
              <line
                key={e.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={selected ? 2.4 : e.cycle ? 1.6 : 1}
                strokeDasharray={selected ? "6 5" : undefined}
                opacity={selected || e.cycle ? 1 : 0.45}
                markerEnd={`url(#hw-arrow-${color.slice(1)})`}
                className={selected ? "hw-edge-live" : undefined}
                onClick={e.edge !== null ? () => onSelect(e.edge as number) : undefined}
                style={{ cursor: e.edge !== null ? "pointer" : "default" }}
              />
            );
          })}
          {GRAPH_NODES.map((n) => {
            const touched = GRAPH_EDGES.some((e) => e.edge === edgeIdx && (e.from === n.id || e.to === n.id));
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                <rect
                  width={Math.max(92, n.label.length * 6.6 + 18)}
                  height={24}
                  rx={12}
                  fill={touched ? activeEdge.statusColor : "transparent"}
                  fillOpacity={touched ? 0.16 : 0}
                  stroke={touched ? activeEdge.statusColor : "currentColor"}
                  strokeOpacity={touched ? 1 : 0.35}
                />
                <text x={12} y={16} fontSize="10.5" fill="currentColor" fontFamily="var(--mf-mono)">
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="hw-edge-list">
        {RESOLVED_EDGES.map((edge, idx) => (
          <button
            key={edge.raw}
            type="button"
            className="hw-edge-btn"
            data-active={idx === edgeIdx}
            onClick={() => onSelect(idx)}
          >
            <span className="hw-edge-id">E_0{idx + 1}</span>
            <span className="hw-edge-raw">{edge.raw}</span>
            <span className="hw-edge-status" style={{ color: edge.statusColor }}>
              ● {edge.status}
            </span>
          </button>
        ))}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeEdge.raw}
            className="hw-edge-detail"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <div className="mf-mono">
              <span className="mf-muted">CALLER</span> {activeEdge.from}
            </div>
            <div className="mf-mono">
              <span className="mf-muted">TARGET</span> {activeEdge.to}
            </div>
            <div className="mf-mono">
              <span className="mf-muted">CENTRALITY</span> {activeEdge.fanIn}
            </div>
            <p>{activeEdge.detail}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function WeightLab() {
  const [sel, setSel] = useState(0);
  const rows = useMemo(
    () =>
      WEIGHT_SAMPLES.map((s) => {
        const a = 0.45 * s.fanIn;
        const b = 0.35 * s.cyclomatic;
        const c = 0.2 * s.churn;
        return { ...s, a, b, c, w: a + b + c };
      }).sort((x, y) => y.w - x.w),
    [],
  );
  const cur = rows[sel] ?? rows[0];

  return (
    <div className="hw-instrument">
      <div className="hw-instrument-head">
        <span>RISK RANKING · SAMPLE REPO SNAPSHOT</span>
        <span className="hw-legend">
          <i style={{ background: "var(--mf-ink)" }} /> fan-in
          <i style={{ background: "#10b981" }} /> cyclomatic
          <i style={{ background: "#f59e0b" }} /> churn
        </span>
      </div>
      <div className="hw-weight-rows">
        {rows.map((r, i) => (
          <button key={r.file} type="button" className="hw-weight-row" data-active={i === sel} onClick={() => setSel(i)}>
            <span className="hw-weight-file">{r.file}</span>
            <span className="hw-weight-bar">
              <motion.span
                className="hw-seg-a"
                animate={{ width: `${r.a * 100}%` }}
                transition={{ type: "spring", stiffness: 140, damping: 22 }}
              />
              <motion.span
                className="hw-seg-b"
                animate={{ width: `${r.b * 100}%` }}
                transition={{ type: "spring", stiffness: 140, damping: 22 }}
              />
              <motion.span
                className="hw-seg-c"
                animate={{ width: `${r.c * 100}%` }}
                transition={{ type: "spring", stiffness: 140, damping: 22 }}
              />
            </span>
            <span className="hw-weight-val">{r.w.toFixed(2)}</span>
          </button>
        ))}
      </div>
      <div className="hw-weight-calc mf-mono">
        W = 0.45×{cur.fanIn.toFixed(2)} + 0.35×{cur.cyclomatic.toFixed(2)} + 0.20×{cur.churn.toFixed(2)} ={" "}
        <strong>{cur.w.toFixed(3)}</strong>
        <span className="mf-muted"> · {cur.note}</span>
      </div>
    </div>
  );
}

function ChunkingInstrument() {
  const [mode, setMode] = useState<"naive" | "ast">("ast");

  return (
    <div className="hw-instrument">
      <div className="hw-instrument-head">
        <span>CHUNKING STRATEGY</span>
        <div className="hw-toggle" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "naive"} data-on={mode === "naive"} onClick={() => setMode("naive")}>
            ✕ Naive splitter
          </button>
          <button type="button" role="tab" aria-selected={mode === "ast"} data-on={mode === "ast"} onClick={() => setMode("ast")}>
            ✓ AST envelope
          </button>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {mode === "naive" ? (
          <motion.div key="naive" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <p className="hw-chunk-note" style={{ color: "#ef4444" }}>
              Fixed 500-token windows cut across syntax boundaries — signatures are separated from return statements and caller context is lost.
            </p>
            <pre className="hw-chunk hw-chunk-bad">
              <code>{`// --- CHUNK #41 (BROKEN MID-EXPRESSION) ---
  const token = req.headers.get("Authorization");
  if (!token) throw new AuthError(
// --- CHUNK #42 (SIGNATURE & IMPORTS LOST) ---
  "Missing bearer token", 401);
  return verifyJwt(token, SECRET_KEY);
}`}</code>
            </pre>
          </motion.div>
        ) : (
          <motion.div key="ast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <p className="hw-chunk-note" style={{ color: "#10b981" }}>
              Complete syntactic units, with resolved upstream callers and exact line numbers injected before embedding.
            </p>
            <pre className="hw-chunk hw-chunk-good">
              <code>{`# [AST_SYMBOL] src/auth/guard.ts:42-49 · fn authenticateRequest()
# [CALLERS]    src/api/gateway.ts:88, src/ws/stream.ts:19
# [CALLEES]    src/crypto/jwt.ts:12 -> verifyJwt()
export async function authenticateRequest(req: Request) {
  const token = req.headers.get("Authorization");
  if (!token) throw new AuthError("Missing bearer token", 401);
  return verifyJwt(token, SECRET_KEY);
}`}</code>
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="hw-chunk-stats">
        <div>
          <strong>9,640</strong>
          <span>semantic chunks</span>
        </div>
        <div>
          <strong>HNSW</strong>
          <span>pgvector index</span>
        </div>
        <div>
          <strong>file:line</strong>
          <span>citation anchors</span>
        </div>
      </div>
    </div>
  );
}

/* ═══ PAGE ══════════════════════════════════════════════════════════════ */

export function HowItWorksPage() {
  const navigate = useNavigate();

  /* Hero replay state */
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState(0);
  const [repoInput, setRepoInput] = useState("vercel/next.js");

  /* Stage theater state */
  const [grammarIdx, setGrammarIdx] = useState(0);
  const [edgeIdx, setEdgeIdx] = useState(2);
  const [activeStage, setActiveStage] = useState(0);
  const theaterRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<(HTMLElement | null)[]>([]);

  const activeGrammar = AST_GRAMMAR_SAMPLES[grammarIdx] ?? AST_GRAMMAR_SAMPLES[0];

  const activeIdx = running ? stageAt(elapsed) : selected;
  const activeSim = STAGES[activeIdx];
  const activeFill = running ? clamp01((elapsed - activeSim.start) / activeSim.dur) : 1;
  const visibleLogs = Math.max(1, Math.ceil(activeFill * activeSim.logs.length));

  const play = () => {
    setSelected(0);
    setElapsed(0);
    setRunning(true);
  };

  /* Replay clock */
  useEffect(() => {
    if (!running) return;
    let t = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      t = Math.min(TOTAL_SECONDS, t + ((now - last) / 1000) * REPLAY_SPEED);
      last = now;
      setElapsed(t);
      if (t >= TOTAL_SECONDS) {
        setRunning(false);
        setSelected(STAGES.length - 1);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  /* Auto-run once so the page opens already moving */
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setElapsed(TOTAL_SECONDS);
      setSelected(STAGES.length - 1);
      return;
    }
    const t = window.setTimeout(play, 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Track which stage is centered while scrolling the theater */
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveStage(Number((e.target as HTMLElement).dataset.stage));
        });
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    stageRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({ target: theaterRef, offset: ["start 35%", "end 65%"] });
  const railFill = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });

  const jumpTo = (i: number) => {
    stageRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleLaunchRepo = (raw: string) => {
    const normalized = normalizeRepoUrl(raw);
    if (!normalized) return;
    navigate({ to: "/dashboard", search: { repo: normalized } });
  };

  const shown = STAGES[activeStage];

  return (
    <SiteLayout>
      {/* ── HERO · THE RUN (dark) ───────────────────────────────────── */}
      <section className="hw-hero" data-theme="dark">
        <div className="hw-hero-grid" aria-hidden="true" />
        <div className="mf-wrap">
          <motion.div
            className="mf-hero-top"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Pill live>Live pipeline replay</Pill>
            <span className="mf-mono mf-muted">illustrative replay of a 4,820-file reference run · {REPLAY_SPEED}× speed</span>
          </motion.div>

          <div className="hw-clock-row">
            <motion.div
              className="hw-clock"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              aria-label={`Elapsed pipeline time ${elapsed.toFixed(2)} seconds`}
            >
              <span className="hw-clock-t">T+</span>
              <span className="hw-clock-n">{elapsed.toFixed(2)}</span>
              <span className="hw-clock-s">s</span>
            </motion.div>

            <div className="hw-clock-side">
              <h1 className="hw-hero-title">
                A git URL goes in.
                <br />
                <span className="mf-serif-i">
                  A live{" "}
                  <MorphText
                    words={["AST multigraph", "call hierarchy", "blast radar", "cited copilot"]}
                    morphTime={1.0}
                    holdTime={2.0}
                    strength={7}
                  />
                </span>{" "}
                comes out.
              </h1>
              <div className="hw-hero-actions">
                <button type="button" className="hw-run-btn" onClick={play} disabled={running}>
                  {running ? (
                    <>
                      <span className="hw-run-dot" /> Streaming…
                    </>
                  ) : (
                    <>▶ Run the pipeline</>
                  )}
                </button>
                <span className="mf-mono mf-muted">{Math.round((elapsed / TOTAL_SECONDS) * 100)}% · {activeSim.code}</span>
              </div>
            </div>
          </div>

          {/* Proportional pipeline strip */}
          <div className="hw-strip-wrap">
            <div className="hw-strip">
              {STAGES.map((s, i) => {
                const fill = clamp01((elapsed - s.start) / s.dur);
                const state = fill >= 1 ? "done" : fill > 0 ? "live" : "idle";
                return (
                  <button
                    key={s.n}
                    type="button"
                    className="hw-seg"
                    data-state={state}
                    data-selected={i === activeIdx}
                    style={{ flexGrow: s.dur, flexBasis: 0 }}
                    onClick={() => {
                      setRunning(false);
                      setSelected(i);
                      setElapsed(s.start + s.dur);
                    }}
                  >
                    <span className="hw-seg-fill" style={{ transform: `scaleX(${fill})` }} />
                    <span className="hw-seg-top">
                      <span>/{s.n}</span>
                      <span>{s.dur.toFixed(2)}s</span>
                    </span>
                    <span className="hw-seg-name">{s.short}</span>
                  </button>
                );
              })}
              <span className="hw-strip-cursor" style={{ left: `${(elapsed / TOTAL_SECONDS) * 100}%` }} />
            </div>
            <div className="hw-strip-ticks mf-mono mf-muted">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((s) => (
                <span key={s} style={{ left: `${(s / TOTAL_SECONDS) * 100}%` }}>
                  {s}s
                </span>
              ))}
              <span style={{ right: 0 }}>7.4s</span>
            </div>
          </div>

          {/* Console */}
          <div className="hw-console">
            <div className="hw-console-main">
              <div className="hw-console-head mf-mono">
                <span>
                  <i className="hw-console-dot" data-live={running} /> worker stdout · {activeSim.code}
                </span>
                <span>{activeSim.worker}</span>
              </div>
              <div className="hw-console-body">
                {activeSim.logs.slice(0, visibleLogs).map((line, i) => (
                  <motion.div key={`${activeSim.code}-${i}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                    <span className="hw-log-idx">[{activeSim.n}.{i + 1}]</span>
                    {line}
                  </motion.div>
                ))}
                {running && <span className="hw-caret" />}
              </div>
              <div className="hw-console-ws mf-mono">{activeSim.wsEvent}</div>
            </div>
            <div className="hw-console-metric">
              <div className="mf-mono mf-muted">{activeSim.metricLabel}</div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSim.code}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="hw-metric-val">{activeSim.metricVal}</div>
                  <div className="hw-metric-sub">{activeSim.metricSub}</div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="hw-io">
            <div>
              <span className="mf-mono mf-muted">INPUT //</span>
              <p>Any public GitHub URL, <code>owner/repo</code> shorthand, or a private repo via ephemeral OAuth / PAT.</p>
            </div>
            <div>
              <span className="mf-mono mf-muted">EXECUTION //</span>
              <p>Zero arbitrary code execution. Static byte buffers are parsed in parallel across 8 Rust Tree-sitter threads.</p>
            </div>
            <div>
              <span className="mf-mono mf-muted">OUTPUT //</span>
              <p>A directed dependency multigraph, Barnes-Hut spatial coordinates and HNSW pgvector symbol embeddings.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STAGE THEATER (light, scroll-driven) ────────────────────── */}
      <section className="hw-theater-section" data-theme="light">
        <div className="mf-wrap">
          <div className="hw-theater-intro">
            <Pill>Under the hood</Pill>
            <h2 className="mf-h1" style={{ margin: "18px 0 0" }}>
              Five stages. <span className="mf-serif-i">Every one inspectable.</span>
            </h2>
          </div>

          <div className="hw-theater" ref={theaterRef}>
            {/* Sticky left column */}
            <aside className="hw-sticky" aria-hidden="false">
              <div className="hw-sticky-num">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={shown.n}
                    initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -60, opacity: 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {shown.n}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="hw-sticky-time mf-mono">
                T+{shown.start.toFixed(2)}s → T+{fmtEnd(shown)}s
              </div>
              <div className="hw-sticky-delta">{shown.dur.toFixed(2)}s</div>

              <div className="hw-rail">
                <div className="hw-rail-line">
                  <motion.span className="hw-rail-fill" style={{ scaleY: railFill }} />
                </div>
                <ol>
                  {STAGES.map((s, i) => (
                    <li key={s.n}>
                      <button type="button" data-active={i === activeStage} data-past={i < activeStage} onClick={() => jumpTo(i)}>
                        <span className="hw-rail-dot" />
                        <span className="hw-rail-label">
                          <b>{s.n}</b> {s.short}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>

            {/* Stage articles */}
            <div className="hw-stages">
              {/* 01 */}
              <article className="hw-stage" data-stage={0} ref={(el) => { stageRefs.current[0] = el; }}>
                <StageHeading stage={STAGES[0]} heading={<>Shallow RAM-disk <span className="mf-serif-i">ingestion.</span></>} />
                <Reveal>
                  <p className="mf-lead">
                    A dedicated worker performs a single-branch, depth-1 fetch straight into an isolated <code>tmpfs</code> memory mount. Private repositories authenticate with your GitHub token strictly in memory — zero bytes ever touch persistent storage.
                  </p>
                  <SanitizeInstrument />
                  <div className="hw-specs">
                    <div>
                      <span className="mf-mono mf-muted">01.1 // GIT WIRE</span>
                      <b>Shallow tree fetch</b>
                      <code>git clone --depth=1 --no-tags --filter=blob:limit=1m</code>
                    </div>
                    <div>
                      <span className="mf-mono mf-muted">01.2 // SANDBOX</span>
                      <b>No-exec memory disk</b>
                      <code>mount -t tmpfs -o size=512m,noexec,nodev tmpfs /work</code>
                    </div>
                    <div>
                      <span className="mf-mono mf-muted">01.3 // SANITIZER</span>
                      <b>Vendored blob strip</b>
                      <code>prunes node_modules/, dist/, .venv/, *.min.js, *.lock</code>
                    </div>
                  </div>
                </Reveal>
              </article>

              {/* 02 */}
              <article className="hw-stage" data-stage={1} ref={(el) => { stageRefs.current[1] = el; }}>
                <StageHeading stage={STAGES[1]} heading={<>Parallel <span className="mf-serif-i">Tree-sitter</span> compilation.</>} />
                <Reveal>
                  <p className="mf-lead">
                    Every file is dispatched to its compiled C/Rust Tree-sitter grammar. Instead of brittle regexes, DevLens walks the concrete syntax tree to record exact byte-range offsets for every function, class, interface and import.
                  </p>
                  <div className="hw-tabs">
                    {AST_GRAMMAR_SAMPLES.map((g, idx) => (
                      <button key={g.lang} type="button" data-on={idx === grammarIdx} onClick={() => setGrammarIdx(idx)}>
                        {g.lang}
                      </button>
                    ))}
                  </div>
                  <div className="hw-triptych">
                    <div className="hw-pane">
                      <div className="hw-pane-head"><span>A // RAW SOURCE</span><span>UTF-8</span></div>
                      <pre><code>{activeGrammar.source}</code></pre>
                    </div>
                    <div className="hw-pane-arrow" aria-hidden="true">→</div>
                    <div className="hw-pane">
                      <div className="hw-pane-head"><span>B // SYNTAX TREE</span><span style={{ color: "#10b981" }}>{activeGrammar.badge}</span></div>
                      <pre style={{ color: "#a7f3d0" }}><code>{activeGrammar.sexpr}</code></pre>
                    </div>
                    <div className="hw-pane-arrow" aria-hidden="true">→</div>
                    <div className="hw-pane">
                      <div className="hw-pane-head"><span>C // SYMBOL TABLE</span><span>INDEXED</span></div>
                      <div className="hw-symbols">
                        {activeGrammar.extracted.map((sym, i) => (
                          <div key={sym}>
                            <span>0{i + 1}</span>
                            {sym}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Reveal>
              </article>

              {/* 03 */}
              <article className="hw-stage" data-stage={2} ref={(el) => { stageRefs.current[2] = el; }}>
                <StageHeading stage={STAGES[2]} heading={<>Cross-file <span className="mf-serif-i">multigraph</span> resolution.</>} />
                <Reveal>
                  <p className="mf-lead">
                    Extracted import specifiers are linked against the global symbol table. DevLens resolves <code>tsconfig.json</code> aliases, Python relative imports and Rust module trees into directed edges — then runs Tarjan’s algorithm in <code>O(V + E)</code> to isolate circular loops. Pick an edge to trace it.
                  </p>
                  <GraphInstrument edgeIdx={edgeIdx} onSelect={setEdgeIdx} />
                </Reveal>
              </article>

              {/* 04 */}
              <article className="hw-stage" data-stage={3} ref={(el) => { stageRefs.current[3] = el; }}>
                <StageHeading stage={STAGES[3]} heading={<>Spatial layout &amp; <span className="mf-serif-i">risk scoring.</span></>} />
                <Reveal>
                  <div className="hw-equation">
                    <div className="mf-mono mf-muted">COMPOSITE ARCHITECTURAL WEIGHT · APPLIED TO EVERY NODE v ∈ V</div>
                    <div className="hw-equation-display">
                      W(v) = 0.45·<span className="mf-serif-i">FanIn</span> + 0.35·<span className="mf-serif-i">Cyclomatic</span> + 0.20·<span className="mf-serif-i">GitChurn</span>
                    </div>
                  </div>
                  <WeightLab />
                  <div className="hw-specs">
                    <div>
                      <span className="mf-mono mf-muted">04.1 // BARNES-HUT N-BODY</span>
                      <b>O(V log V) forces</b>
                      <p>Quadtree approximation computes repulsive and spring forces without all-pairs comparisons.</p>
                    </div>
                    <div>
                      <span className="mf-mono mf-muted">04.2 // CONVEX HULLS</span>
                      <b>Subsystems at a glance</b>
                      <p>Files sharing directory prefixes are wrapped in convex polygon boundaries.</p>
                    </div>
                    <div>
                      <span className="mf-mono mf-muted">04.3 // 2-HOP BLAST</span>
                      <b>Under 1ms to highlight</b>
                      <p>Reverse-reachability sets are bitmask-indexed, so a click shows its downstream blast radius instantly.</p>
                    </div>
                  </div>
                </Reveal>
              </article>

              {/* 05 */}
              <article className="hw-stage" data-stage={4} ref={(el) => { stageRefs.current[4] = el; }}>
                <StageHeading stage={STAGES[4]} heading={<>AST-envelope <span className="mf-serif-i">vector indexing.</span></>} />
                <Reveal>
                  <p className="mf-lead">
                    Why do standard RAG tools hallucinate on codebases? Fixed 500-token splitters slice functions mid-block and strip import context. DevLens chunks strictly along complete AST node envelopes. Flip the switch to see the difference.
                  </p>
                  <ChunkingInstrument />
                </Reveal>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINALE (dark) ───────────────────────────────────────────── */}
      <section className="hw-finale" data-theme="dark">
        <div className="mf-wrap">
          <Reveal>
            <div className="hw-finale-badge mf-mono">
              <span>✓</span> T+7.40s · READY · WORKSPACE UNLOCKED · HTTP 200 / WS OPEN
            </div>
            <h2 className="hw-finale-title">
              Now run it on <span className="mf-serif-i">your repository.</span>
            </h2>
            <div className="hw-finale-grid">
              <div>
                <form
                  className="mf-ingest"
                  style={{ width: "100%" }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLaunchRepo(repoInput);
                  }}
                >
                  <span className="mf-mono mf-muted">github.com/</span>
                  <input
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    placeholder="owner/repo or full URL"
                    aria-label="Repository URL"
                    spellCheck={false}
                  />
                  <button type="submit" className="mf-btn">
                    Execute pipeline <span className="mf-arrow">↗</span>
                  </button>
                </form>
                <div className="hw-chips">
                  {["vercel/next.js", "facebook/react", "fastapi/fastapi", "tailwindlabs/tailwindcss"].map((sample) => (
                    <button key={sample} type="button" className="mf-pill mf-chip" onClick={() => handleLaunchRepo(sample)}>
                      {sample} ↗
                    </button>
                  ))}
                </div>
              </div>
              <pre className="hw-finale-json">
                <code>{`{
  "event": "PIPELINE_COMPLETE",
  "repo": "${repoInput || "vercel/next.js"}",
  "elapsed_ms": 7400,
  "views_ready": ["MAP", "FLOW", "DRIFT", "COPILOT", "DOCS"]
}`}</code>
              </pre>
            </div>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}

function StageHeading({ stage, heading }: { stage: Stage; heading: React.ReactNode }) {
  return (
    <header className="hw-stage-head">
      <div className="hw-stage-meta mf-mono mf-muted">
        <span>
          STAGE {stage.n} / 05
        </span>
        <span>
          T+{stage.start.toFixed(2)}s → T+{fmtEnd(stage)}s · {stage.dur.toFixed(2)}s
        </span>
        <span>{stage.worker}</span>
      </div>
      <h2 className="hw-stage-title">{heading}</h2>
    </header>
  );
}
