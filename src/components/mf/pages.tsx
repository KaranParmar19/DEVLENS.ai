import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { Pill, Reveal, SiteLayout } from "./site-layout";
import { MorphText } from "@/components/ui/morph-text";
import { normalizeRepoUrl } from "@/lib/utils";

/* ═══ INTERACTIVE DATA FOR FEATURES SHOWCASE ════════════════════════ */

const JUMP_INDEX = [
  { id: "feat-01", n: "01", t: "Architecture map", tag: "AST Force Graph" },
  { id: "feat-02", n: "02", t: "Code flow tracer", tag: "Execution Hops" },
  { id: "feat-03", n: "03", t: "Drift timeline", tag: "Commit Blast Radius" },
  { id: "feat-04", n: "04", t: "Ask DevLens", tag: "Line-Cited Copilot" },
  { id: "feat-05", n: "05", t: "Onboarding doc", tag: "Auto-Wiki Dossier" },
];

const FEAT_NODES = [
  {
    id: 0,
    label: "api/gateway.ts",
    cluster: "Edge Ingress",
    x: 85,
    y: 85,
    coupling: 0.94,
    complexity: 18,
    dependents: 19,
    note: "Primary HTTP ingress router; dispatches authenticated payloads to domain services.",
  },
  {
    id: 1,
    label: "auth/jwt-guard.ts",
    cluster: "Security Core",
    x: 225,
    y: 52,
    coupling: 0.89,
    complexity: 14,
    dependents: 15,
    note: "Validates Ed25519 session tokens and enforces rate-limit quotas per workspace.",
  },
  {
    id: 2,
    label: "worker/tree-sitter.rs",
    cluster: "AST Engine",
    x: 245,
    y: 165,
    coupling: 0.97,
    complexity: 31,
    dependents: 12,
    note: "Parses multi-language syntax trees in an isolated ephemeral sandbox.",
  },
  {
    id: 3,
    label: "graph/blast-radius.ts",
    cluster: "Graph Kernel",
    x: 405,
    y: 95,
    coupling: 0.91,
    complexity: 24,
    dependents: 9,
    note: "Computes transitive import cycles, PageRank centrality, and module hull boundaries.",
  },
  {
    id: 4,
    label: "storage/pgvector.ts",
    cluster: "Persistence",
    x: 525,
    y: 145,
    coupling: 0.76,
    complexity: 11,
    dependents: 7,
    note: "Stores AST chunk embeddings and symbol cross-references for cited retrieval.",
  },
];

const FEAT_EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [2, 4],
  [3, 4],
];

const FLOW_HOPS = [
  {
    step: "01",
    fn: "POST /api/v1/repos/analyze",
    file: "src/api/routes/repos.py:42",
    latency: "1.4ms",
    kind: "INGRESS",
    desc: "Validates GitHub repository URL, normalizes branch ref, and allocates an ephemeral analysis job ID.",
  },
  {
    step: "02",
    fn: "spawnCloneWorker(repoUrl, sha)",
    file: "src/workers/clone.py:108",
    latency: "640ms",
    kind: "IO SANDBOX",
    desc: "Performs shallow git clone (--depth 1) in an isolated memory-mapped directory; strips vendored blobs.",
  },
  {
    step: "03",
    fn: "parseSyntaxTree(fileBuffer, lang)",
    file: "src/ast/tree_sitter_runner.py:219",
    latency: "1,820ms",
    kind: "HOTSPOT · AST",
    desc: "Extracts function signatures, class hierarchies, and import specifiers across 14+ language grammars.",
  },
  {
    step: "04",
    fn: "resolveTransitiveEdges(symbolTable)",
    file: "src/graph/dependency_solver.py:87",
    latency: "410ms",
    kind: "GRAPH SOLVER",
    desc: "Links cross-file imports into a directed multigraph; flags circular dependencies and load-bearing hubs.",
  },
  {
    step: "05",
    fn: "commitEmbeddings(chunks, graphId)",
    file: "src/db/vector_store.py:154",
    latency: "390ms",
    kind: "PERSISTENCE",
    desc: "Persists AST-bounded code chunks and broadcasts WebSocket completion event to the studio client.",
  },
];

const DRIFT_COMMITS = [
  {
    sha: "f500de1",
    author: "karan.parmar",
    time: "2h ago",
    title: "refactor(graph): split AST symbol resolver from worker pool",
    risk: "LOW RISK",
    riskColor: "#10b981",
    deltaEdges: "-4 circular edges",
    touched: "6 files · +184 / -92",
    audit: "Decoupled graph solver from worker loop. Cyclomatic complexity in tree_sitter_runner dropped from 38 to 24.",
  },
  {
    sha: "8103188",
    author: "karan.parmar",
    time: "1d ago",
    title: "feat(auth): inject session token validation into websocket handshake",
    risk: "MODERATE",
    riskColor: "#f59e0b",
    deltaEdges: "+7 cross-module edges",
    touched: "11 files · +312 / -45",
    audit: "Touches core security middleware; 9 downstream route handlers now depend on auth/jwt-guard.ts.",
  },
  {
    sha: "3e05901",
    author: "karan.parmar",
    time: "3d ago",
    title: "perf(db): batch vector upserts across shared connection pool",
    risk: "HIGH BLAST",
    riskColor: "#ef4444",
    deltaEdges: "+14 downstream sinks",
    touched: "19 files · +640 / -210",
    audit: "High blast radius: modifies storage/pgvector.ts which is imported by 14 analysis and chat pipelines.",
  },
];

const COPILOT_DEMOS = [
  {
    pin: "@worker/tree-sitter.rs",
    q: "How does DevLens isolate untrusted repositories during AST parsing?",
    a: "Repository clones execute inside an ephemeral temp directory with stripped environment variables. Tree-sitter parses raw byte buffers in-memory without executing repository build scripts or package hooks.",
    citations: ["src/workers/clone.py:108-142", "src/ast/tree_sitter_runner.py:219", "src/security/sandbox.py:19"],
    symbols: ["spawnCloneWorker()", "parseSyntaxTree()", "SandboxPolicy"],
  },
  {
    pin: "@graph/blast-radius.ts",
    q: "What breaks if we change the schema in storage/pgvector.ts?",
    a: "Modifying pgvector.ts directly impacts 7 downstream modules, including the hybrid RAG retriever, session snapshot serializer, and onboarding doc generator. Run migration 004_vector_dims before deploying.",
    citations: ["src/storage/pgvector.ts:44-98", "src/chat/retriever.py:63", "src/docs/onboarding_gen.py:112"],
    symbols: ["VectorStore.upsert()", "HybridRetriever", "DocSynthesizer"],
  },
  {
    pin: "@api/gateway.ts",
    q: "Where are circular dependencies detected and scored?",
    a: "Tarjan's strongly connected components algorithm runs in resolveTransitiveEdges(). Any cycle with >2 nodes increments the module drift penalty and highlights red dashed edges on the canvas.",
    citations: ["src/graph/dependency_solver.py:87-134", "src/components/studio/arch-canvas.tsx:204"],
    symbols: ["findStronglyConnected()", "computeCouplingScore()"],
  },
];

const DOSSIER_TABS = [
  {
    id: "overview",
    file: "01_ARCHITECTURE_OVERVIEW.md",
    badge: "AUTO-GENERATED · 4.2s",
    title: "System Architecture & Data Flow",
    body: "DevLens operates as a three-tier AST intelligence pipeline: an Ingress API layer (FastAPI), an Ephemeral Parsing Worker pool (Tree-sitter + Git), and a Graph & Vector Persistence layer (PostgreSQL + pgvector).",
    code: `// Load-bearing entry path (Coupling: 0.94)
POST /api/v1/repos/analyze
  └─► cloneWorker.spawn(repoUrl)       // [src/workers/clone.py:108]
       └─► treeSitter.parseAll()       // [src/ast/runner.py:219]
            └─► graphSolver.solve()    // [src/graph/solver.py:87]`,
    bullets: [
      "Start reading in src/api/routes/repos.py to trace job creation.",
      "Core domain models live in src/schemas/graph.py — shared across all 5 views.",
    ],
  },
  {
    id: "invariants",
    file: "02_SYSTEM_INVARIANTS.md",
    badge: "3 CRITICAL RULES",
    title: "Architectural Invariants & Contracts",
    body: "These structural rules are enforced across the dependency graph. Violating any invariant triggers a High Drift alert in the timeline view:",
    code: `INVARIANT_01: UI components must never import backend database schemas directly.
INVARIANT_02: All LLM copilot responses must attach >= 1 verified AST file:line citation.
INVARIANT_03: Worker sandboxes must purge cloned disk state within 30s of job completion.`,
    bullets: [
      "Zero direct edges allowed from src/routes/* to src/storage/*.",
      "Every graph node ID is deterministically hashed from its relative POSIX path.",
    ],
  },
  {
    id: "hotspots",
    file: "03_FRAGILE_HOTSPOTS.md",
    badge: "BLAST RADIUS > 0.85",
    title: "High-Coupling Hotspots & Traps",
    body: "Ranked by cyclomatic complexity × fan-in coupling. Modify these files with caution and run full integration suites before merging:",
    code: `1. src/ast/tree_sitter_runner.py   [Complexity: 31 | Coupling: 0.97 | 12 dependents]
2. src/api/gateway.ts              [Complexity: 18 | Coupling: 0.94 | 19 dependents]
3. src/graph/blast-radius.ts       [Complexity: 24 | Coupling: 0.91 |  9 dependents]`,
    bullets: [
      "Trap: Do not block the async event loop inside tree_sitter_runner.py.",
      "Trap: Updating GraphNode schema requires regenerating client TypeScript bindings.",
    ],
  },
];

/* ═══ FEATURES PAGE COMPONENT ═══════════════════════════════════════ */

export function FeaturesPage() {
  const navigate = useNavigate();
  const [selectedNodeId, setSelectedNodeId] = useState(2);
  const [activeHop, setActiveHop] = useState(2);
  const [activeCommit, setActiveCommit] = useState(0);
  const [activePrompt, setActivePrompt] = useState(0);
  const [activeDossier, setActiveDossier] = useState(0);
  const [copiedDoc, setCopiedDoc] = useState(false);
  const [repoInput, setRepoInput] = useState("facebook/react");

  const activeNode = FEAT_NODES.find((n) => n.id === selectedNodeId) ?? FEAT_NODES[2];
  const currentHop = FLOW_HOPS[activeHop] ?? FLOW_HOPS[2];
  const currentCommit = DRIFT_COMMITS[activeCommit] ?? DRIFT_COMMITS[0];
  const currentCopilot = COPILOT_DEMOS[activePrompt] ?? COPILOT_DEMOS[0];
  const currentDossier = DOSSIER_TABS[activeDossier] ?? DOSSIER_TABS[0];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleCopyDossier = () => {
    navigator.clipboard?.writeText(
      `# ${currentDossier.title}\n\n${currentDossier.body}\n\n\`\`\`\n${currentDossier.code}\n\`\`\``
    );
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 1800);
  };

  const handleLaunchRepo = (raw: string) => {
    const normalized = normalizeRepoUrl(raw);
    if (!normalized) return;
    navigate({ to: "/dashboard", search: { repo: normalized } });
  };

  return (
    <SiteLayout>
      {/* ── 00. ASYMMETRIC EDITORIAL HERO ───────────────────────────── */}
      <section className="mf-hero" data-theme="light" style={{ paddingBottom: "clamp(48px, 6vw, 80px)" }}>
        <div className="mf-hero-grid-bg" />
        <div className="mf-wrap">
          <motion.div
            className="mf-hero-top"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Pill live>05 Core Engines · AST Grounded</Pill>
            <span className="mf-mono mf-muted">SYS.SPEC // V2.4 · ZERO HALLUCINATION</span>
          </motion.div>

          <div className="feat-hero-grid">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mf-mono mf-muted" style={{ marginBottom: 18 }}>
                [ ARCHITECTURAL INTELLIGENCE SUITE ]
              </div>
              <h1 className="feat-display-title">
                Five views.
                <span className="feat-line-indent">
                  <span className="mf-serif-i">
                    <MorphText
                      words={["One truth", "Zero drift", "Full trace", "Exact lines"]}
                      morphTime={1.05}
                      holdTime={2.0}
                      strength={7}
                    />
                  </span>{" "}
                  in code.
                </span>
              </h1>
            </motion.div>

            <motion.div
              className="feat-hero-aside"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="mf-lead" style={{ margin: 0 }}>
                Every view in DevLens is projected from a single Tree-sitter AST and dependency
                multigraph — so your architecture map, call flow, commit drift, AI answers, and
                onboarding docs never disagree.
              </p>
              <div className="feat-spec-badges">
                <span className="feat-spec-chip">&lt; 8.0s Cold Parse</span>
                <span className="feat-spec-chip">14+ AST Grammars</span>
                <span className="feat-spec-chip">100% Line-Cited</span>
                <span className="feat-spec-chip">Mermaid &amp; JSON</span>
              </div>
            </motion.div>
          </div>

          {/* Interactive 5-Cell Jump Strip */}
          <motion.div
            className="feat-jump-bar"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22 }}
          >
            {JUMP_INDEX.map((item) => (
              <button
                key={item.id}
                type="button"
                className="feat-jump-item"
                onClick={() => scrollToSection(item.id)}
              >
                <div className="feat-jump-top">
                  <span className="feat-jump-num">/ {item.n}</span>
                  <span className="mf-arrow">↘</span>
                </div>
                <div>
                  <div className="feat-jump-title">{item.t}</div>
                  <div className="feat-jump-tag" style={{ marginTop: 4 }}>
                    {item.tag}
                  </div>
                </div>
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 01. ARCHITECTURE MAP (ASYMMETRIC SPLIT + LIVE GRAPH) ────── */}
      <section id="feat-01" className="mf-section feat-block" data-theme="light">
        <div className="mf-wrap">
          <div className="feat-split-01">
            {/* Left Sticky Editorial Column */}
            <div className="feat-sticky-col">
              <div className="feat-num-row">
                <span className="feat-giant-num">01</span>
                <div style={{ textAlign: "right" }}>
                  <Pill live>LIVE AST GRAPH</Pill>
                  <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                    FORCE-DIRECTED · PAGE-RANK SCORED
                  </div>
                </div>
              </div>

              <h2 className="mf-h1" style={{ margin: 0 }}>
                Architecture <span className="mf-serif-i">map.</span>
              </h2>

              <p className="mf-lead" style={{ margin: 0 }}>
                Every file becomes an interactive node; every resolved import becomes a directed
                edge. Modules cluster automatically into package hulls while load-bearing bottlenecks
                scale by fan-in coupling.
              </p>

              <div className="feat-subgrid-2x2">
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">01.A // TOPOLOGY</span>
                  <div className="feat-micro-text">Force-directed layout with convex module hulls</div>
                </div>
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">01.B // TELEMETRY</span>
                  <div className="feat-micro-text">Cyclomatic complexity &amp; coupling per node</div>
                </div>
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">01.C // BLAST HALO</span>
                  <div className="feat-micro-text">1-hop &amp; 2-hop impact radius on selection</div>
                </div>
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">01.D // PORTABILITY</span>
                  <div className="feat-micro-text">Instant export to Mermaid, PlantUML, or JSON</div>
                </div>
              </div>
            </div>

            {/* Right Interactive AST Graph Canvas */}
            <Reveal>
              <div className="feat-canvas-shell">
                <div className="feat-canvas-bar">
                  <div className="feat-canvas-dots">
                    <i />
                    <i />
                    <i />
                    <span className="mf-mono" style={{ marginLeft: 10, color: "#a3a3a3", fontSize: "0.68rem" }}>
                      AST_GRAPH_INSPECTOR // CLICK ANY NODE
                    </span>
                  </div>
                  <span className="mf-studio-stat-pill">5 CLUSTERS · 6 EDGES</span>
                </div>

                <div style={{ padding: "20px 24px 12px" }}>
                  <svg
                    viewBox="0 0 620 225"
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                      background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05), transparent 70%)",
                      borderRadius: 14,
                    }}
                  >
                    <defs>
                      <pattern id="feat-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                        <path
                          d="M 28 0 L 0 0 0 28"
                          fill="none"
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="1"
                        />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#feat-grid)" />

                    {/* Directed Edges */}
                    {FEAT_EDGES.map(([a, b], idx) => {
                      const active = a === selectedNodeId || b === selectedNodeId;
                      return (
                        <line
                          key={idx}
                          x1={FEAT_NODES[a].x}
                          y1={FEAT_NODES[a].y}
                          x2={FEAT_NODES[b].x}
                          y2={FEAT_NODES[b].y}
                          stroke={active ? "#10b981" : "rgba(255,255,255,0.18)"}
                          strokeWidth={active ? 2.2 : 1.2}
                          strokeDasharray={active ? "none" : "4 4"}
                          style={{ transition: "all 0.3s ease" }}
                        />
                      );
                    })}

                    {/* Interactive Nodes */}
                    {FEAT_NODES.map((node) => {
                      const isSel = node.id === selectedNodeId;
                      return (
                        <g
                          key={node.id}
                          onClick={() => setSelectedNodeId(node.id)}
                          style={{ cursor: "pointer" }}
                        >
                          {isSel && (
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r="28"
                              fill="rgba(16, 185, 129, 0.12)"
                              stroke="#10b981"
                              strokeWidth="1.2"
                              strokeDasharray="3 3"
                            />
                          )}
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={isSel ? 13 : 9}
                            fill={isSel ? "#10b981" : "#17171c"}
                            stroke={isSel ? "#ffffff" : "rgba(255,255,255,0.65)"}
                            strokeWidth={isSel ? 2.5 : 1.5}
                            style={{ transition: "all 0.25s ease" }}
                          />
                          <text
                            x={node.x}
                            y={node.y + 26}
                            textAnchor="middle"
                            fill={isSel ? "#ffffff" : "rgba(255,255,255,0.65)"}
                            fontSize="10.5"
                            fontFamily="var(--mf-mono)"
                            fontWeight={isSel ? 600 : 400}
                          >
                            {node.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Node Telemetry Inspector Drawer */}
                <div
                  style={{
                    margin: "8px 20px 20px",
                    padding: "18px 20px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <span className="mf-mono" style={{ color: "#10b981", fontSize: "0.68rem" }}>
                        SELECTED NODE // {activeNode.cluster}
                      </span>
                      <div style={{ fontSize: "1.15rem", fontWeight: 600, marginTop: 2, fontFamily: "var(--mf-mono)" }}>
                        {activeNode.label}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="mf-studio-stat-pill">
                        COUPLING: {(activeNode.coupling * 100).toFixed(0)}%
                      </span>
                      <span className="mf-studio-stat-pill">
                        COMPLEXITY: {activeNode.complexity}
                      </span>
                      <span className="mf-studio-stat-pill">
                        DEPENDENTS: {activeNode.dependents}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: "12px 0 0", fontSize: "0.875rem", color: "#bfbfbf", lineHeight: 1.5 }}>
                    {activeNode.note}
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 02 & 03. STAGGERED DIAGONAL DARK SECTION (FLOW + DRIFT) ── */}
      <section className="mf-section mf-dark" data-theme="dark">
        <div className="mf-wrap">
          {/* Editorial Section Divider Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid var(--mf-line)",
              paddingBottom: 20,
              marginBottom: "clamp(48px, 6vw, 84px)",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <span className="mf-mono mf-muted">02 &amp; 03 // EXECUTION TRACE + TEMPORAL DRIFT</span>
            <span className="mf-mono mf-muted">RUNTIME CALL GRAPH · GIT BLAST RADIUS</span>
          </div>

          <div className="feat-stagger-wrap">
            {/* 02. LEFT-ANCHORED 8-COLUMN BLOCK: CODE FLOW TRACER */}
            <div id="feat-02" className="feat-stagger-left feat-block">
              <Reveal>
                <div className="feat-editorial-card">
                  <div className="feat-num-row">
                    <span className="feat-giant-num">02</span>
                    <div style={{ textAlign: "right" }}>
                      <Pill live>CALL GRAPH STEPPER</Pill>
                      <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                        ENTRYPOINT → SINK TRACE
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 28, alignItems: "end" }}>
                    <h2 className="mf-h1" style={{ margin: 0 }}>
                      Code flow <span className="mf-serif-i">tracer.</span>
                    </h2>
                    <p className="mf-body" style={{ margin: 0, fontSize: "1rem" }}>
                      Pick any HTTP route, CLI command, or worker queue and scrub forward or backward
                      one execution hop at a time down to the database layer.
                    </p>
                  </div>

                  {/* Interactive Hop Scrubber */}
                  <div className="feat-hop-track">
                    {FLOW_HOPS.map((h, idx) => (
                      <button
                        key={h.step}
                        type="button"
                        className={`feat-hop-btn ${idx === activeHop ? "active" : ""}`}
                        onClick={() => setActiveHop(idx)}
                      >
                        <div className="mf-mono" style={{ fontSize: "0.65rem", opacity: 0.7 }}>
                          HOP {h.step}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: "0.82rem", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {h.kind}
                        </div>
                        <div className="mf-mono" style={{ fontSize: "0.65rem", marginTop: 6, opacity: 0.8 }}>
                          {h.latency}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Active Hop Execution Inspector */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentHop.step}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                      style={{
                        marginTop: 18,
                        padding: "20px 22px",
                        borderRadius: 16,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.14)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                        <code style={{ fontFamily: "var(--mf-mono)", fontSize: "0.95rem", color: "#ffffff", fontWeight: 600 }}>
                          {currentHop.fn}
                        </code>
                        <span className="mf-studio-stat-pill">
                          {currentHop.file} · {currentHop.latency}
                        </span>
                      </div>
                      <p style={{ margin: "10px 0 0", color: "#bfbfbf", fontSize: "0.9rem", lineHeight: 1.5 }}>
                        {currentHop.desc}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, flexWrap: "wrap", gap: 12 }}>
                    <div className="mf-mono mf-muted">
                      DEEP-LINKABLE HOPS · CYCLE &amp; HOTSPOT FLAGS
                    </div>
                    <button
                      type="button"
                      className="mf-btn ghost sm"
                      onClick={() => setActiveHop((prev) => (prev + 1) % FLOW_HOPS.length)}
                    >
                      Step next hop ({activeHop + 1}/{FLOW_HOPS.length}) →
                    </button>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* 03. RIGHT-OFFSET DIAGONAL 8-COLUMN BLOCK: DRIFT TIMELINE */}
            <div id="feat-03" className="feat-stagger-right feat-block">
              <Reveal>
                <div className="feat-editorial-card">
                  <div className="feat-num-row">
                    <span className="feat-giant-num">03</span>
                    <div style={{ textAlign: "right" }}>
                      <Pill live>RISK RADAR</Pill>
                      <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                        COMMIT-BY-COMMIT DELTA
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "0.95fr 1.15fr", gap: 28, alignItems: "end" }}>
                    <h2 className="mf-h1" style={{ margin: 0 }}>
                      Drift <span className="mf-serif-i">timeline.</span>
                    </h2>
                    <p className="mf-body" style={{ margin: 0, fontSize: "1rem" }}>
                      Scrub across Git history to measure structural erosion, new circular imports,
                      and downstream blast radius before a pull request ever merges.
                    </p>
                  </div>

                  {/* Commit Scrubber Selector */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 28 }}>
                    {DRIFT_COMMITS.map((c, idx) => (
                      <button
                        key={c.sha}
                        type="button"
                        className={`feat-hop-btn ${idx === activeCommit ? "active" : ""}`}
                        onClick={() => setActiveCommit(idx)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="mf-mono" style={{ fontWeight: 600 }}>#{c.sha}</span>
                          <span className="mf-mono" style={{ fontSize: "0.62rem", opacity: 0.75 }}>{c.time}</span>
                        </div>
                        <div style={{ fontSize: "0.8rem", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.title}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Commit Blast-Radius Audit Card */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentCommit.sha}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                      style={{
                        marginTop: 18,
                        padding: "20px 22px",
                        borderRadius: 16,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.14)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            style={{
                              display: "inline-block",
                              width: 9,
                              height: 9,
                              borderRadius: "50%",
                              background: currentCommit.riskColor,
                              boxShadow: `0 0 10px ${currentCommit.riskColor}`,
                            }}
                          />
                          <span className="mf-mono" style={{ fontWeight: 600, color: "#ffffff" }}>
                            {currentCommit.risk}
                          </span>
                          <span className="mf-mono mf-muted">· {currentCommit.deltaEdges}</span>
                        </div>
                        <span className="mf-studio-stat-pill">{currentCommit.touched}</span>
                      </div>

                      <div style={{ fontWeight: 500, fontSize: "0.98rem", color: "#ffffff", marginTop: 12 }}>
                        {currentCommit.title}
                      </div>
                      <p style={{ margin: "8px 0 0", fontSize: "0.875rem", color: "#bfbfbf", lineHeight: 1.5 }}>
                        <strong style={{ color: "#ffffff" }}>Copilot Audit:</strong> {currentCommit.audit}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── 04. ASK DEVLENS COPILOT (CENTER-STAGE SPOTLIGHT) ───────── */}
      <section id="feat-04" className="mf-section mf-dark feat-block" data-theme="dark" style={{ paddingTop: 20 }}>
        <div className="mf-wrap">
          <Reveal>
            <div className="feat-spotlight-head">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
                  <span className="feat-giant-num">04</span>
                  <div>
                    <Pill live>AST-GROUNDED COPILOT</Pill>
                    <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                      HYBRID VECTOR + SYMBOL GRAPH RETRIEVAL
                    </div>
                  </div>
                </div>
                <h2 className="mf-h1" style={{ margin: 0 }}>
                  Ask DevLens <span className="mf-serif-i">Copilot.</span>
                </h2>
              </div>

              <div>
                <p className="mf-lead" style={{ margin: 0 }}>
                  Zero unverified guesswork. Pin any module with <code style={{ fontFamily: "var(--mf-mono)" }}>@mention</code> and
                  get streaming architectural answers where every claim links to exact source lines.
                </p>
              </div>
            </div>

            <div className="feat-copilot-grid">
              {/* Left Prompt & Context Selector */}
              <div className="feat-copilot-sidebar">
                <div className="mf-mono mf-muted" style={{ marginBottom: 4 }}>
                  SELECT AN ENGINEERING QUERY
                </div>
                {COPILOT_DEMOS.map((item, idx) => (
                  <button
                    key={item.pin}
                    type="button"
                    className={`feat-prompt-btn ${idx === activePrompt ? "active" : ""}`}
                    onClick={() => setActivePrompt(idx)}
                  >
                    <div className="mf-mono" style={{ fontSize: "0.66rem", opacity: 0.75, marginBottom: 6 }}>
                      PINNED: {item.pin}
                    </div>
                    <div>“{item.q}”</div>
                  </button>
                ))}

                <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="mf-mono mf-muted" style={{ fontSize: "0.65rem" }}>
                    CAPABILITIES //
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    <span className="mf-studio-stat-pill">FILE:LINE CITATIONS</span>
                    <span className="mf-studio-stat-pill">@MENTION PINNING</span>
                    <span className="mf-studio-stat-pill">SESSION MEMORY</span>
                  </div>
                </div>
              </div>

              {/* Right Cited Answer Terminal */}
              <div style={{ padding: "clamp(24px, 4vw, 40px)", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 24 }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentCopilot.pin}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                      <span className="mf-studio-stat-pill">
                        CONTEXT PIN: {currentCopilot.pin}
                      </span>
                      <span className="mf-mono" style={{ color: "#10b981", fontSize: "0.7rem" }}>
                        ● 3 AST SYMBOLS VERIFIED
                      </span>
                    </div>

                    <div style={{ fontSize: "clamp(1.2rem, 2vw, 1.5rem)", fontWeight: 500, color: "#ffffff", letterSpacing: "-0.02em", marginBottom: 16 }}>
                      “{currentCopilot.q}”
                    </div>

                    <p style={{ fontSize: "1.05rem", lineHeight: 1.65, color: "#d4d4d4", margin: 0 }}>
                      {currentCopilot.a}
                    </p>

                    {/* Verified Source Citations */}
                    <div style={{ marginTop: 28 }}>
                      <div className="mf-mono mf-muted" style={{ marginBottom: 10, fontSize: "0.68rem" }}>
                        CITED SOURCE LINES (CLICKABLE IN WORKSPACE)
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {currentCopilot.citations.map((cite) => (
                          <span
                            key={cite}
                            style={{
                              fontFamily: "var(--mf-mono)",
                              fontSize: "0.75rem",
                              padding: "7px 12px",
                              borderRadius: 8,
                              background: "rgba(16, 185, 129, 0.12)",
                              border: "1px solid rgba(16, 185, 129, 0.4)",
                              color: "#10b981",
                            }}
                          >
                            📄 {cite}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    paddingTop: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div className="mf-mono mf-muted" style={{ fontSize: "0.68rem" }}>
                    RESOLVED AST SYMBOLS: {currentCopilot.symbols.join(" · ")}
                  </div>
                  <Link to="/dashboard" className="mf-btn inv sm">
                    Ask on your repo <span className="mf-arrow">↗</span>
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 05. ONBOARDING DOC GENERATOR (REVERSED DOSSIER SPREAD) ── */}
      <section id="feat-05" className="mf-section feat-block" data-theme="light">
        <div className="mf-wrap">
          <div className="feat-split-05">
            {/* Left Interactive Markdown Dossier Preview */}
            <Reveal>
              <div className="feat-dossier">
                <div className="feat-dossier-tabs">
                  {DOSSIER_TABS.map((tab, idx) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`feat-dossier-tab ${idx === activeDossier ? "active" : ""}`}
                      onClick={() => setActiveDossier(idx)}
                    >
                      {tab.file}
                    </button>
                  ))}
                </div>

                <div style={{ padding: "clamp(24px, 3.5vw, 38px)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                    <span className="feat-spec-chip">{currentDossier.badge}</span>
                    <button
                      type="button"
                      className="mf-btn ghost sm"
                      onClick={handleCopyDossier}
                    >
                      {copiedDoc ? "Copied Markdown ✓" : "Copy Markdown ⧉"}
                    </button>
                  </div>

                  <h3 className="mf-h2" style={{ fontSize: "clamp(1.5rem, 2.5vw, 2.1rem)", margin: "0 0 12px" }}>
                    {currentDossier.title}
                  </h3>

                  <p className="mf-body" style={{ fontSize: "0.95rem", marginBottom: 20 }}>
                    {currentDossier.body}
                  </p>

                  <pre
                    style={{
                      background: "#0c0c0f",
                      color: "#e5e5e5",
                      padding: "18px 20px",
                      borderRadius: 14,
                      fontFamily: "var(--mf-mono)",
                      fontSize: "0.78rem",
                      lineHeight: 1.65,
                      overflowX: "auto",
                      margin: "0 0 20px",
                    }}
                  >
                    <code>{currentDossier.code}</code>
                  </pre>

                  <ul className="mf-list" style={{ marginTop: 12 }}>
                    {currentDossier.bullets.map((b) => (
                      <li key={b} style={{ padding: "10px 0", fontSize: "0.875rem" }}>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>

            {/* Right Sticky Typography Column */}
            <div className="feat-sticky-col">
              <div className="feat-num-row">
                <span className="feat-giant-num">05</span>
                <div style={{ textAlign: "right" }}>
                  <Pill live>AUTODOC SYNTHESIZER</Pill>
                  <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                    SHIPPABLE MARKDOWN WIKI
                  </div>
                </div>
              </div>

              <h2 className="mf-h1" style={{ margin: 0 }}>
                Onboarding <span className="mf-serif-i">doc.</span>
              </h2>

              <p className="mf-lead" style={{ margin: 0 }}>
                Turn a 200,000-line codebase into a structured architectural briefing in seconds:
                what matters, which invariants cannot be broken, and where new engineers should start
                reading on day one.
              </p>

              <div className="feat-subgrid-2x2">
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">05.A // WIKI READY</span>
                  <div className="feat-micro-text">Clean Markdown ready for GitHub or Notion</div>
                </div>
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">05.B // INVARIANTS</span>
                  <div className="feat-micro-text">Surfaces unwritten architectural contracts</div>
                </div>
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">05.C // HOTSPOT TRAPS</span>
                  <div className="feat-micro-text">Flags fragile high-coupling files automatically</div>
                </div>
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">05.D // LIVE SYNC</span>
                  <div className="feat-micro-text">Re-synthesizes whenever you re-index a branch</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 06. ARCHITECTURAL COMPARISON MATRIX & LAUNCHER CTA ────── */}
      <section className="mf-section" data-theme="light" style={{ paddingTop: 0 }}>
        <div className="mf-wrap">
          <Reveal>
            <div style={{ borderTop: "1px solid var(--mf-line)", paddingTop: "clamp(48px, 6vw, 88px)" }}>
              <div className="mf-sec-head" style={{ marginBottom: 40 }}>
                <div>
                  <Pill>BENCHMARK MATRIX</Pill>
                  <h2 className="mf-h2" style={{ marginTop: 16 }}>
                    Why static grep &amp; generic chat <span className="mf-serif-i">fall short.</span>
                  </h2>
                </div>
                <span className="mf-mono mf-muted"> DETERMINISTIC AST VS. HEURISTIC GUESSING</span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="feat-matrix">
                  <thead>
                    <tr>
                      <th>CAPABILITY</th>
                      <th>IDE SEARCH / GREP</th>
                      <th>GENERIC LLM CHAT</th>
                      <th>DEVLENS AST ENGINE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Cross-file call hierarchy</td>
                      <td className="mf-muted">Manual file-by-file jumping</td>
                      <td className="mf-muted">Hallucinates unindexed imports</td>
                      <td><strong>Deterministic Tree-sitter multigraph</strong></td>
                    </tr>
                    <tr>
                      <td>Commit blast radius</td>
                      <td className="mf-muted">Raw line diff only</td>
                      <td className="mf-muted">No transitive graph awareness</td>
                      <td><strong>1-hop &amp; 2-hop coupling risk radar</strong></td>
                    </tr>
                    <tr>
                      <td>Source code citations</td>
                      <td className="mf-muted">String match only</td>
                      <td className="mf-muted">Unverified snippets</td>
                      <td><strong>100% grounded file:line citations</strong></td>
                    </tr>
                    <tr>
                      <td>New engineer onboarding</td>
                      <td className="mf-muted">Weeks of tribal knowledge</td>
                      <td className="mf-muted">Outdated README summaries</td>
                      <td><strong>Auto-synthesized architecture dossier</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>

          {/* Interactive Bottom Repo Launcher */}
          <Reveal>
            <div
              style={{
                marginTop: "clamp(64px, 8vw, 112px)",
                padding: "clamp(36px, 5vw, 64px)",
                borderRadius: 28,
                border: "1px solid var(--mf-ink)",
                background: "var(--mf-soft)",
                display: "grid",
                gridTemplateColumns: "1.1fr 1fr",
                gap: 40,
                alignItems: "center",
              }}
              className="feat-hero-grid"
            >
              <div>
                <Pill live>READY IN UNDER 8 SECONDS</Pill>
                <h2 className="mf-h1" style={{ margin: "18px 0 0", fontSize: "clamp(2.2rem, 4.8vw, 4.2rem)" }}>
                  Map your own repository <span className="mf-serif-i">right now.</span>
                </h2>
              </div>

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
                    Analyze <span className="mf-arrow">↗</span>
                  </button>
                </form>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  {["facebook/react", "vercel/next.js", "fastapi/fastapi"].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      className="mf-pill mf-chip"
                      onClick={() => handleLaunchRepo(sample)}
                    >
                      {sample} ↗
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}

/* ═══ HOW IT WORKS — PIPELINE DATA & COMPONENT ══════════════════════ */

const PIPELINE_SIM_STAGES = [
  {
    n: "01",
    code: "STAGE_CLONE",
    title: "Shallow Ephemeral Clone",
    duration: "0.62s",
    pct: 18,
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
    code: "STAGE_AST",
    title: "Tree-sitter Grammar Parse",
    duration: "1.88s",
    pct: 42,
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
    code: "STAGE_GRAPH",
    title: "Dependency Multigraph",
    duration: "1.41s",
    pct: 64,
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
    code: "STAGE_LAYOUT",
    title: "Spatial Hull Clustering",
    duration: "2.05s",
    pct: 84,
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
    code: "STAGE_VECTOR",
    title: "AST-Bounded Vector Index",
    duration: "1.44s",
    pct: 100,
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

export function HowItWorksPage() {
  const navigate = useNavigate();
  const [simIndex, setSimIndex] = useState(0);
  const [isPlayingSim, setIsPlayingSim] = useState(false);
  const [grammarIdx, setGrammarIdx] = useState(0);
  const [edgeIdx, setEdgeIdx] = useState(0);
  const [repoInput, setRepoInput] = useState("vercel/next.js");

  const activeSim = PIPELINE_SIM_STAGES[simIndex] ?? PIPELINE_SIM_STAGES[0];
  const activeGrammar = AST_GRAMMAR_SAMPLES[grammarIdx] ?? AST_GRAMMAR_SAMPLES[0];
  const activeEdge = RESOLVED_EDGES[edgeIdx] ?? RESOLVED_EDGES[0];

  // Auto-advance WebSocket simulation when playing
  useEffect(() => {
    if (!isPlayingSim) return;
    const timer = window.setInterval(() => {
      setSimIndex((prev) => {
        if (prev >= PIPELINE_SIM_STAGES.length - 1) {
          setIsPlayingSim(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1350);
    return () => window.clearInterval(timer);
  }, [isPlayingSim]);

  const startReplay = () => {
    setSimIndex(0);
    setIsPlayingSim(true);
  };

  const handleLaunchRepo = (raw: string) => {
    const normalized = normalizeRepoUrl(raw);
    if (!normalized) return;
    navigate({ to: "/dashboard", search: { repo: normalized } });
  };

  return (
    <SiteLayout>
      {/* ── 00. 3-TIER MONUMENTAL CASCADE HERO + PROPORTIONAL TIME-RULER ── */}
      <section className="mf-hero" data-theme="light" style={{ paddingBottom: "clamp(48px, 6vw, 84px)" }}>
        <div className="mf-hero-grid-bg" />
        <div className="mf-wrap">
          <motion.div
            className="mf-hero-top"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Pill live>Pipeline Blueprint // Spec 5.0</Pill>
            <span className="mf-mono mf-muted">CHRONOLOGICAL TELEMETRY · T+0.00S ──► T+7.40S</span>
          </motion.div>

          {/* 3-Tier Full-Span Typographic Cascade */}
          <div className="hiw-cascade-wrap">
            <div className="hiw-cascade-meta-row">
              <span>[ 00 // DETERMINISTIC EXECUTION TIMELINE ]</span>
              <span>STREAM PROTOCOL: WSS // JSON-RPC</span>
              <span>SANDBOX: TMPFS RAM-DISK</span>
            </div>

            <motion.h1
              className="hiw-tier-1"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              Raw Git repository
            </motion.h1>

            <motion.div
              className="hiw-tier-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="mf-serif-i">in 7.40 seconds</span>
            </motion.div>

            <motion.div
              className="hiw-tier-3"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              to a live{" "}
              <span className="mf-serif-i">
                <MorphText
                  words={["AST multigraph", "call hierarchy", "blast radar", "cited copilot"]}
                  morphTime={1.0}
                  holdTime={2.0}
                  strength={7}
                />
              </span>
              .
            </motion.div>

            {/* 3-Column Architectural Deck */}
            <div className="hiw-hero-deck">
              <div className="hiw-hero-deck-cell">
                <div className="mf-mono mf-muted" style={{ marginBottom: 6 }}>
                  INPUT VECTOR //
                </div>
                <div style={{ fontWeight: 500, fontSize: "0.95rem" }}>
                  Any public GitHub URL, <code style={{ fontFamily: "var(--mf-mono)" }}>owner/repo</code> shorthand, or private repo via ephemeral OAuth/PAT.
                </div>
              </div>
              <div className="hiw-hero-deck-cell">
                <div className="mf-mono mf-muted" style={{ marginBottom: 6 }}>
                  EXECUTION MODEL //
                </div>
                <div style={{ fontWeight: 500, fontSize: "0.95rem" }}>
                  Zero arbitrary code execution. Static byte buffers are parsed in parallel across 8 Rust Tree-sitter threads.
                </div>
              </div>
              <div className="hiw-hero-deck-cell">
                <div className="mf-mono mf-muted" style={{ marginBottom: 6 }}>
                  OUTPUT ARTIFACT //
                </div>
                <div style={{ fontWeight: 500, fontSize: "0.95rem" }}>
                  Directed dependency multigraph, Barnes-Hut spatial coordinates, and HNSW pgvector symbol embeddings.
                </div>
              </div>
            </div>
          </div>

          {/* Proportional Execution Time-Ruler Schematic */}
          <motion.div
            className="hiw-ruler-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
          >
            <div className="hiw-ruler-top">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="mf-dot live" style={{ background: "#10b981" }} />
                <span className="mf-mono" style={{ fontWeight: 600 }}>
                  PROPORTIONAL EXECUTION TIME-RULER (7,400ms TOTAL COLD RUN)
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="mf-mono mf-muted">ACTIVE FRAME: {activeSim.code}</span>
                <button
                  type="button"
                  className="mf-btn sm"
                  onClick={startReplay}
                  style={{ height: 32, padding: "0 14px", fontSize: "0.75rem" }}
                >
                  {isPlayingSim ? "● Tracing live..." : "▶ Trace 7.40s execution"}
                </button>
              </div>
            </div>

            {/* Millisecond Ruler Ticks */}
            <div className="hiw-ruler-ticks">
              <span>T+0.00s</span>
              <span>T+1.00s</span>
              <span>T+2.00s</span>
              <span>T+3.00s</span>
              <span>T+4.00s</span>
              <span>T+5.00s</span>
              <span>T+6.00s</span>
              <span>T+7.40s</span>
            </div>

            {/* Proportional Segments (Width matches real execution duration) */}
            <div className="hiw-ruler-bar">
              {PIPELINE_SIM_STAGES.map((st, idx) => (
                <button
                  key={st.n}
                  type="button"
                  className={`hiw-ruler-seg ${idx === simIndex ? "active" : ""}`}
                  onClick={() => {
                    setIsPlayingSim(false);
                    setSimIndex(idx);
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mf-mono" style={{ fontSize: "0.65rem", opacity: 0.7 }}>
                      /{st.n}
                    </span>
                    <span className="mf-mono" style={{ fontSize: "0.68rem", fontWeight: 600 }}>
                      {st.duration}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", marginTop: 8, letterSpacing: "-0.02em" }}>
                    {st.title}
                  </div>
                </button>
              ))}
            </div>

            {/* Live Progress Bar */}
            <div style={{ height: 4, background: "var(--mf-soft-2)", width: "100%" }}>
              <div
                style={{
                  height: "100%",
                  width: `${activeSim.pct}%`,
                  background: "#10b981",
                  transition: "width 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </div>

            {/* 3-Column Dark Telemetry Readout */}
            <div className="hiw-ruler-readout">
              <div>
                <div className="mf-mono" style={{ color: "#8a8a8a", fontSize: "0.65rem" }}>
                  WEBSOCKET FRAME //
                </div>
                <div className="mf-mono" style={{ color: "#10b981", fontSize: "0.74rem", marginTop: 6, wordBreak: "break-all" }}>
                  {activeSim.wsEvent}
                </div>
              </div>

              <div>
                <div className="mf-mono" style={{ color: "#8a8a8a", fontSize: "0.65rem", marginBottom: 6 }}>
                  WORKER STDOUT STREAM //
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSim.code}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    style={{ fontFamily: "var(--mf-mono)", fontSize: "0.74rem", lineHeight: 1.6, color: "#e5e5e5" }}
                  >
                    {activeSim.logs.map((line, i) => (
                      <div key={i}>
                        <span style={{ color: "#10b981", marginRight: 8 }}>[{activeSim.n}.{i + 1}]</span>
                        {line}
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div className="mf-mono" style={{ color: "#8a8a8a", fontSize: "0.65rem" }}>
                    {activeSim.metricLabel}
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.04em", marginTop: 4 }}>
                    {activeSim.metricVal}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#a3a3a3", marginTop: 4 }}>
                    {activeSim.metricSub}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── STAGES 01 & 02: CHRONOLOGICAL CONDUIT SPINE (LIGHT) ─────── */}
      <section className="hiw-conduit-section" data-theme="light">
        <div className="mf-wrap">
          {/* STAGE 01 CONDUIT ROW */}
          <div className="hiw-conduit-row">
            <div className="hiw-time-rail">
              <span className="hiw-crosshair">+</span>
              <div>
                <div className="hiw-time-stamp">T+0.00s ──► T+0.62s</div>
                <div className="hiw-time-delta">0.62s</div>
                <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                  STAGE 01 OF 05
                </div>
              </div>
              <div className="mf-mono mf-muted" style={{ fontSize: "0.65rem" }}>
                WORKER: CLONE_SANDBOX
              </div>
            </div>

            <div className="hiw-stage-canvas">
              <Reveal>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 16 }}>
                  <h2 className="mf-h1" style={{ margin: 0 }}>
                    Shallow RAM-disk <span className="mf-serif-i">ingestion.</span>
                  </h2>
                  <span className="mf-mono mf-muted">[ 01 // EPHEMERAL TMPFS ]</span>
                </div>

                <p className="mf-lead" style={{ marginTop: 18 }}>
                  A dedicated worker performs a single-branch, depth-1 fetch directly into an
                  isolated <code style={{ fontFamily: "var(--mf-mono)" }}>tmpfs</code> memory mount. Private
                  repositories authenticate using your GitHub token strictly in-memory — zero bytes
                  ever touch persistent storage.
                </p>

                {/* Exposed 3-Cell Swiss Blueprint Strip */}
                <div className="hiw-schematic-strip">
                  <div className="hiw-schematic-cell">
                    <div className="mf-mono mf-muted" style={{ marginBottom: 8 }}>
                      STEP 01.1 // GIT WIRE PROTOCOL
                    </div>
                    <div style={{ fontWeight: 600, fontSize: "1.05rem", marginBottom: 8 }}>
                      Shallow Tree Fetch
                    </div>
                    <code style={{ fontFamily: "var(--mf-mono)", fontSize: "0.74rem", color: "var(--mf-ink-2)", display: "block" }}>
                      git clone --depth=1 --no-tags --filter=blob:limit=1m
                    </code>
                  </div>

                  <div className="hiw-schematic-cell">
                    <div className="mf-mono mf-muted" style={{ marginBottom: 8 }}>
                      STEP 01.2 // SANDBOX MOUNT
                    </div>
                    <div style={{ fontWeight: 600, fontSize: "1.05rem", marginBottom: 8 }}>
                      No-Exec Memory Disk
                    </div>
                    <code style={{ fontFamily: "var(--mf-mono)", fontSize: "0.74rem", color: "var(--mf-ink-2)", display: "block" }}>
                      mount -t tmpfs -o size=512m,noexec,nodev tmpfs /work
                    </code>
                  </div>

                  <div className="hiw-schematic-cell">
                    <div className="mf-mono mf-muted" style={{ marginBottom: 8 }}>
                      STEP 01.3 // TREE SANITIZER
                    </div>
                    <div style={{ fontWeight: 600, fontSize: "1.05rem", marginBottom: 8 }}>
                      Vendored Blob Strip
                    </div>
                    <code style={{ fontFamily: "var(--mf-mono)", fontSize: "0.74rem", color: "var(--mf-ink-2)", display: "block" }}>
                      Prunes node_modules/, dist/, .venv/, *.min.js, *.lock
                    </code>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* STAGE 02 CONDUIT ROW */}
          <div className="hiw-conduit-row">
            <div className="hiw-time-rail">
              <span className="hiw-crosshair">+</span>
              <div>
                <div className="hiw-time-stamp">T+0.62s ──► T+2.50s</div>
                <div className="hiw-time-delta">1.88s</div>
                <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                  STAGE 02 OF 05
                </div>
              </div>
              <div className="mf-mono mf-muted" style={{ fontSize: "0.65rem" }}>
                WORKER: RUST_TREESITTER_8X
              </div>
            </div>

            <div className="hiw-stage-canvas">
              <Reveal>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 16 }}>
                  <h2 className="mf-h1" style={{ margin: 0 }}>
                    Parallel <span className="mf-serif-i">Tree-sitter</span> compilation.
                  </h2>
                  <div style={{ display: "flex", gap: 6 }}>
                    {AST_GRAMMAR_SAMPLES.map((g, idx) => (
                      <button
                        key={g.lang}
                        type="button"
                        onClick={() => setGrammarIdx(idx)}
                        style={{
                          padding: "7px 14px",
                          border: "1px solid var(--mf-ink)",
                          background: idx === grammarIdx ? "var(--mf-ink)" : "transparent",
                          color: idx === grammarIdx ? "#ffffff" : "var(--mf-ink)",
                          fontFamily: "var(--mf-mono)",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {g.lang}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="mf-lead" style={{ marginTop: 18 }}>
                  Every source file is dispatched to its compiled C/Rust Tree-sitter grammar.
                  Instead of brittle regexes, DevLens walks the Concrete Syntax Tree (CST) to record
                  exact byte-range offsets for every function, class, interface, and import.
                </p>

                {/* 3-Pane Compiler Translation Triptych */}
                <div className="hiw-compiler-triptych">
                  <div className="hiw-compiler-pane">
                    <div className="hiw-compiler-head">
                      <span>PANE A // RAW SOURCE BYTES</span>
                      <span>UTF-8</span>
                    </div>
                    <pre className="hiw-compiler-body" style={{ margin: 0, color: "#e5e5e5" }}>
                      <code>{activeGrammar.source}</code>
                    </pre>
                  </div>

                  <div className="hiw-compiler-pane">
                    <div className="hiw-compiler-head">
                      <span>PANE B // CONCRETE SYNTAX TREE (CST)</span>
                      <span style={{ color: "#10b981" }}>{activeGrammar.badge}</span>
                    </div>
                    <pre className="hiw-compiler-body" style={{ margin: 0, color: "#a7f3d0" }}>
                      <code>{activeGrammar.sexpr}</code>
                    </pre>
                  </div>

                  <div className="hiw-compiler-pane">
                    <div className="hiw-compiler-head">
                      <span>PANE C // SYMBOL TABLE</span>
                      <span>INDEXED</span>
                    </div>
                    <div className="hiw-compiler-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {activeGrammar.extracted.map((sym, i) => (
                        <div
                          key={sym}
                          style={{
                            padding: "10px 12px",
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "rgba(255,255,255,0.03)",
                            color: "#ffffff",
                          }}
                        >
                          <span style={{ color: "#10b981", marginRight: 8 }}>0{i + 1}</span>
                          {sym}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── STAGES 03 & 04: OBSIDIAN DARK CONDUIT SPINE ────────────── */}
      <section className="hiw-conduit-section mf-dark" data-theme="dark">
        <div className="mf-wrap">
          {/* STAGE 03 CONDUIT ROW */}
          <div className="hiw-conduit-row">
            <div className="hiw-time-rail">
              <span className="hiw-crosshair">+</span>
              <div>
                <div className="hiw-time-stamp">T+2.50s ──► T+3.91s</div>
                <div className="hiw-time-delta">1.41s</div>
                <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                  STAGE 03 OF 05
                </div>
              </div>
              <div className="mf-mono mf-muted" style={{ fontSize: "0.65rem" }}>
                SOLVER: TARJAN_SCC + PAGERANK
              </div>
            </div>

            <div className="hiw-stage-canvas">
              <Reveal>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 16 }}>
                  <h2 className="mf-h1" style={{ margin: 0 }}>
                    Cross-file <span className="mf-serif-i">multigraph</span> resolution.
                  </h2>
                  <span className="mf-mono mf-muted">[ 03 // DIRECTED ADJACENCY SOLVER ]</span>
                </div>

                <p className="mf-lead" style={{ marginTop: 18 }}>
                  Extracted import specifiers are linked against the global symbol table. DevLens
                  resolves <code style={{ fontFamily: "var(--mf-mono)" }}>tsconfig.json</code> aliases, Python
                  relative imports, and Rust module trees into directed edges — then executes
                  Tarjan&apos;s algorithm in <code style={{ fontFamily: "var(--mf-mono)" }}>O(V + E)</code> time to isolate circular loops.
                </p>

                {/* Exposed 2D Resolution Table + Inspector */}
                <div className="hiw-matrix-layout">
                  <div style={{ borderRight: "1px solid rgba(255,255,255,0.22)" }}>
                    <div
                      style={{
                        padding: "12px 20px",
                        borderBottom: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.04)",
                        fontFamily: "var(--mf-mono)",
                        fontSize: "0.68rem",
                        color: "#8a8a8a",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>SELECT AN IMPORT EDGE TO TRACE</span>
                      <span>FAN-IN / STATUS</span>
                    </div>

                    {RESOLVED_EDGES.map((edge, idx) => (
                      <button
                        key={edge.raw}
                        type="button"
                        className={`hiw-matrix-row-btn ${idx === edgeIdx ? "active" : ""}`}
                        onClick={() => setEdgeIdx(idx)}
                      >
                        <span style={{ opacity: 0.6 }}>E_0{idx + 1}</span>
                        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {edge.raw}
                        </span>
                        <span>{edge.fanIn}</span>
                        <span style={{ textAlign: "right", fontWeight: 600 }}>{edge.status.split(" ")[0]}</span>
                      </button>
                    ))}
                  </div>

                  <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeEdge.raw}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              background: activeEdge.statusColor,
                              display: "inline-block",
                            }}
                          />
                          <span className="mf-mono" style={{ color: "#ffffff", fontWeight: 600 }}>
                            {activeEdge.status}
                          </span>
                        </div>

                        <div className="mf-mono" style={{ fontSize: "0.75rem", color: "#a3a3a3", lineHeight: 1.8 }}>
                          <div>CALLER NODE: <strong style={{ color: "#ffffff" }}>{activeEdge.from}</strong></div>
                          <div>TARGET NODE: <strong style={{ color: "#10b981" }}>{activeEdge.to}</strong></div>
                          <div>CENTRALITY:  <strong style={{ color: "#ffffff" }}>{activeEdge.fanIn}</strong></div>
                        </div>

                        <p style={{ margin: "16px 0 0", fontSize: "0.88rem", color: "#d4d4d4", lineHeight: 1.55 }}>
                          {activeEdge.detail}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* STAGE 04 CONDUIT ROW */}
          <div className="hiw-conduit-row">
            <div className="hiw-time-rail">
              <span className="hiw-crosshair">+</span>
              <div>
                <div className="hiw-time-stamp">T+3.91s ──► T+5.96s</div>
                <div className="hiw-time-delta">2.05s</div>
                <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                  STAGE 04 OF 05
                </div>
              </div>
              <div className="mf-mono mf-muted" style={{ fontSize: "0.65rem" }}>
                ENGINE: BARNES_HUT_QUADTREE
              </div>
            </div>

            <div className="hiw-stage-canvas">
              <Reveal>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 16 }}>
                  <h2 className="mf-h1" style={{ margin: 0 }}>
                    Spatial layout &amp; <span className="mf-serif-i">risk scoring.</span>
                  </h2>
                  <span className="mf-mono mf-muted">[ 04 // TOPOLOGICAL GEOMETRY ]</span>
                </div>

                {/* Swiss Typographic Mathematical Formula Poster */}
                <div className="hiw-equation-poster">
                  <div className="mf-mono mf-muted">
                    COMPOSITE ARCHITECTURAL WEIGHT EQUATION // APPLIED TO EVERY GRAPH NODE v ∈ V
                  </div>
                  <div className="hiw-equation-display">
                    W(v) = 0.45 · <span className="mf-serif-i">FanIn</span>(v) + 0.35 ·{" "}
                    <span className="mf-serif-i">Cyclomatic</span>(v) + 0.20 ·{" "}
                    <span className="mf-serif-i">GitChurn</span>(v)
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
                    <div>
                      <div className="mf-mono" style={{ color: "#10b981", marginBottom: 6 }}>
                        01 // BARNES-HUT N-BODY
                      </div>
                      <p className="mf-body" style={{ margin: 0, fontSize: "0.875rem" }}>
                        Quadtree spatial approximation computes repulsive and attractive spring
                        forces in <code style={{ fontFamily: "var(--mf-mono)" }}>O(V log V)</code> time.
                      </p>
                    </div>
                    <div>
                      <div className="mf-mono" style={{ color: "#10b981", marginBottom: 6 }}>
                        02 // CONVEX MODULE HULLS
                      </div>
                      <p className="mf-body" style={{ margin: 0, fontSize: "0.875rem" }}>
                        Files sharing directory prefixes are wrapped in convex polygon boundaries so
                        subsystem separation is visible at a glance.
                      </p>
                    </div>
                    <div>
                      <div className="mf-mono" style={{ color: "#10b981", marginBottom: 6 }}>
                        03 // 2-HOP BLAST PRECOMPUTE
                      </div>
                      <p className="mf-body" style={{ margin: 0, fontSize: "0.875rem" }}>
                        Transitive reverse-reachability sets are bitmask-indexed so clicking any
                        node highlights its downstream blast radius in &lt;1ms.
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── STAGE 05 & PROTOCOL FINALE: LIGHT CONDUIT SPINE ────────── */}
      <section className="hiw-conduit-section" data-theme="light">
        <div className="mf-wrap">
          {/* STAGE 05 CONDUIT ROW */}
          <div className="hiw-conduit-row">
            <div className="hiw-time-rail">
              <span className="hiw-crosshair">+</span>
              <div>
                <div className="hiw-time-stamp">T+5.96s ──► T+7.40s</div>
                <div className="hiw-time-delta">1.44s</div>
                <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                  STAGE 05 OF 05
                </div>
              </div>
              <div className="mf-mono mf-muted" style={{ fontSize: "0.65rem" }}>
                INDEX: PGVECTOR_HNSW
              </div>
            </div>

            <div className="hiw-stage-canvas">
              <Reveal>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 16 }}>
                  <h2 className="mf-h1" style={{ margin: 0 }}>
                    AST-envelope <span className="mf-serif-i">vector indexing.</span>
                  </h2>
                  <span className="mf-mono mf-muted">[ 05 // SEMANTIC + GRAPH EMBEDDING ]</span>
                </div>

                <p className="mf-lead" style={{ marginTop: 18 }}>
                  Why do standard RAG tools hallucinate on codebases? Because fixed 500-token
                  splitters slice functions mid-block and strip import context. DevLens chunks code
                  strictly along complete AST node envelopes.
                </p>

                {/* Side-by-Side Visual Code Slicing Comparison */}
                <div className="hiw-diff-grid">
                  <div className="hiw-diff-col">
                    <div className="mf-mono" style={{ color: "#ef4444", fontWeight: 600, marginBottom: 10 }}>
                      ✕ NAIVE 500-TOKEN TEXT SPLITTER (STANDARD RAG)
                    </div>
                    <p className="mf-body" style={{ fontSize: "0.875rem", marginBottom: 16 }}>
                      Cuts across syntax boundaries, separating function signatures from return
                      statements and losing caller context:
                    </p>
                    <pre
                      style={{
                        margin: 0,
                        padding: 16,
                        background: "#fff5f5",
                        border: "1px solid #fecaca",
                        color: "#991b1b",
                        fontFamily: "var(--mf-mono)",
                        fontSize: "0.74rem",
                        lineHeight: 1.55,
                        overflowX: "auto",
                      }}
                    >
                      <code>{`// --- CHUNK #41 (BROKEN MID-EXPRESSION) ---
  const token = req.headers.get("Authorization");
  if (!token) throw new AuthError(
// --- CHUNK #42 (SIGNATURE & IMPORTS LOST) ---
  "Missing bearer token", 401);
  return verifyJwt(token, SECRET_KEY);
}`}</code>
                    </pre>
                  </div>

                  <div className="hiw-diff-col">
                    <div className="mf-mono" style={{ color: "#10b981", fontWeight: 600, marginBottom: 10 }}>
                      ✓ DEVLENS AST-ENVELOPE + GRAPH HEADER CHUNKER
                    </div>
                    <p className="mf-body" style={{ fontSize: "0.875rem", marginBottom: 16 }}>
                      Preserves complete syntactic units and injects resolved upstream callers and
                      exact line numbers before embedding:
                    </p>
                    <pre
                      style={{
                        margin: 0,
                        padding: 16,
                        background: "#0a0a0a",
                        border: "1px solid #0a0a0a",
                        color: "#a7f3d0",
                        fontFamily: "var(--mf-mono)",
                        fontSize: "0.74rem",
                        lineHeight: 1.55,
                        overflowX: "auto",
                      }}
                    >
                      <code>{`# [AST_SYMBOL] src/auth/guard.ts:42-49 · fn authenticateRequest()
# [CALLERS]    src/api/gateway.ts:88, src/ws/stream.ts:19
# [CALLEES]    src/crypto/jwt.ts:12 -> verifyJwt()
export async function authenticateRequest(req: Request) {
  const token = req.headers.get("Authorization");
  if (!token) throw new AuthError("Missing bearer token", 401);
  return verifyJwt(token, SECRET_KEY);
}`}</code>
                    </pre>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* T+7.40S TERMINAL DISPATCH FINALE (DISTINCT EXPOSED BLUEPRINT BAR) */}
          <div className="hiw-conduit-row" style={{ borderBottom: "1px solid var(--mf-ink)" }}>
            <div className="hiw-time-rail">
              <span className="hiw-crosshair" style={{ background: "#10b981", color: "#0a0a0a" }}>✓</span>
              <div>
                <div className="hiw-time-stamp" style={{ color: "#10b981" }}>T+7.40s // READY</div>
                <div className="hiw-time-delta">100%</div>
                <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                  WORKSPACE UNLOCKED
                </div>
              </div>
              <div className="mf-mono mf-muted" style={{ fontSize: "0.65rem" }}>
                STATUS: HTTP 200 / WS OPEN
              </div>
            </div>

            <div className="hiw-stage-canvas">
              <Reveal>
                <div className="mf-mono mf-muted" style={{ marginBottom: 10 }}>
                  [ FINAL STAGE_COMPLETE WEBSOCKET DISPATCH ]
                </div>
                <h2 className="mf-h1" style={{ margin: "0 0 24px", fontSize: "clamp(2.2rem, 5vw, 4.5rem)" }}>
                  Test the pipeline on <span className="mf-serif-i">any repository.</span>
                </h2>

                <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 32, alignItems: "center" }} className="hiw-matrix-layout">
                  <div style={{ padding: 24 }}>
                    <form
                      className="mf-ingest"
                      style={{ width: "100%", borderRadius: 0 }}
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
                      <button type="submit" className="mf-btn" style={{ borderRadius: 0 }}>
                        Execute Pipeline <span className="mf-arrow">↗</span>
                      </button>
                    </form>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                      {["vercel/next.js", "facebook/react", "fastapi/fastapi", "tailwindlabs/tailwindcss"].map((sample) => (
                        <button
                          key={sample}
                          type="button"
                          className="mf-pill mf-chip"
                          style={{ borderRadius: 0 }}
                          onClick={() => handleLaunchRepo(sample)}
                        >
                          {sample} ↗
                        </button>
                      ))}
                    </div>
                  </div>

                  <pre
                    style={{
                      margin: 0,
                      padding: 24,
                      background: "#0a0a0a",
                      color: "#10b981",
                      fontFamily: "var(--mf-mono)",
                      fontSize: "0.74rem",
                      lineHeight: 1.6,
                      overflowX: "auto",
                    }}
                  >
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
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
