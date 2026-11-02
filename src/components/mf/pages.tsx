import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { Pill, Reveal, SiteLayout } from "./site-layout";
import { MorphText } from "@/components/ui/morph-text";
import { AnimatedPath } from "@/components/ui/animated-path";

/* ═══ INTERACTIVE DATA FOR FEATURES SHOWCASE ════════════════════════ */

const JUMP_INDEX = [
  { id: "feat-01", n: "01", t: "Architecture map", tag: "AST Force Graph" },
  { id: "feat-02", n: "02", t: "Code flow tracer", tag: "Execution Hops" },
  { id: "feat-03", n: "03", t: "Drift timeline", tag: "Commit Blast Radius" },
  { id: "feat-04", n: "04", t: "Ask DevLens", tag: "Line-Cited Copilot" },
  { id: "feat-05", n: "05", t: "Onboarding doc", tag: "Auto-Wiki Dossier" },
];

const PROCESS_STEPS = [
  {
    id: "feat-01",
    num: "01)",
    title: "Dependency graph",
    tag: "AST Graph",
    desc: "See how files, modules, and cross-file imports connect across the repository.",
    x: 70,
    y: 44,
  },
  {
    id: "feat-02",
    num: "02)",
    title: "Request flow tracer",
    tag: "Call Path",
    desc: "Follow an HTTP endpoint or background job step by step down to the database.",
    x: 320,
    y: 114,
  },
  {
    id: "feat-03",
    num: "03)",
    title: "Commit history",
    tag: "Impact Check",
    desc: "Review recent commits to see which downstream modules were affected.",
    x: 570,
    y: 184,
  },
  {
    id: "feat-04",
    num: "04)",
    title: "Codebase Q&A",
    tag: "Line Links",
    desc: "Ask questions about your code and jump straight to the exact file and line.",
    x: 820,
    y: 254,
  },
  {
    id: "feat-05",
    num: "05)",
    title: "Onboarding guide",
    tag: "Overview",
    desc: "Read a generated breakdown of the folder layout, entry points, and fragile files.",
    x: 1070,
    y: 324,
  },
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
    riskColor: "#ffffff",
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
      "Core domain models live in src/schemas/graph.py, shared across all five views.",
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
  const [selectedNodeId, setSelectedNodeId] = useState(2);
  const [activeHop, setActiveHop] = useState(2);
  const [activeCommit, setActiveCommit] = useState(0);
  const [activePrompt, setActivePrompt] = useState(0);
  const [activeDossier, setActiveDossier] = useState(0);
  const [copiedDoc, setCopiedDoc] = useState(false);

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

  return (
    <SiteLayout>
      {/* 00. Hero */}
      <section className="mf-hero" data-theme="light" style={{ paddingBottom: "clamp(48px, 6vw, 80px)" }}>
        <div className="mf-wrap">
          <motion.div
            className="mf-hero-top"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Pill live>Five views backed by one syntax graph</Pill>
          </motion.div>

          <div className="feat-hero-grid">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="feat-display-title">
                Five views.
                <span className="feat-line-indent">
                  <MorphText
                    words={["One truth", "Zero drift", "Full trace", "Exact lines"]}
                    morphTime={1.05}
                    holdTime={2.0}
                    strength={7}
                  />{" "}
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
                Every view in DevLens reads from the same Tree-sitter syntax tree and dependency
                graph. Your dependency map, request trace, commit history, Q&amp;A answers, and
                onboarding notes all stay in sync.
              </p>
              <div className="feat-spec-badges">
                <span className="feat-spec-chip">8 AST languages</span>
                <span className="feat-spec-chip">Line-level citations</span>
                <span className="feat-spec-chip">Mermaid &amp; JSON export</span>
              </div>
            </motion.div>
          </div>

          {/* Cascading Process Flow (Framer AnimatedPath Design matching Image 1) */}
          <motion.div
            className="feat-cascade-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Desktop / Tablet SVG animated canvas */}
            <div className="feat-cascade-canvas">
              <AnimatedPath
                viewWidth={1180}
                viewHeight={480}
                lineColor="var(--mf-ink, #0a0a0a)"
                dotColor="var(--mf-ink, #0a0a0a)"
                strokeWidth={1.25}
                dashLength={6}
                gapLength={6}
                dotSize={10}
                speed={130}
                trailLength={0.28}
                baseOpacity={0.16}
              />

              {/* Positioned Step Cards matching Image 1 */}
              {PROCESS_STEPS.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  className="feat-cascade-card"
                  style={{
                    left: `${(step.x / 1180) * 100}%`,
                    top: `${(step.y / 480) * 100}%`,
                  }}
                  onClick={() => scrollToSection(step.id)}
                  title={`Jump to ${step.title}`}
                >
                  <div className="feat-cascade-title">
                    <span className="feat-cascade-num">{step.num}</span> {step.title}
                  </div>
                  <p className="feat-cascade-desc">{step.desc}</p>
                </button>
              ))}
            </div>

            {/* Mobile Responsive List (< 900px) */}
            <div className="feat-cascade-mobile">
              {PROCESS_STEPS.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  className="feat-cascade-mobile-item"
                  onClick={() => scrollToSection(step.id)}
                >
                  <div className="feat-cascade-mobile-dot" />
                  <div>
                    <div className="feat-cascade-title">
                      <span className="feat-cascade-num">{step.num}</span> {step.title}
                    </div>
                    <p className="feat-cascade-desc">{step.desc}</p>
                  </div>
                </button>
              ))}
            </div>
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
                  <Pill live>Dependency graph</Pill>
                  <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                    Module imports &amp; coupling scores
                  </div>
                </div>
              </div>

              <h2 className="mf-h1" style={{ margin: 0 }}>
                Architecture <span className="dx-muted-word">map.</span>
              </h2>

              <p className="mf-lead" style={{ margin: 0 }}>
                Every file becomes an interactive node and every resolved import becomes a directed
                edge. Click any file to see what imports it and how tightly coupled it is.
              </p>

              <div className="feat-subgrid-2x2">
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">Module grouping</span>
                  <div className="feat-micro-text">Clusters files automatically by folder and package</div>
                </div>
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">Complexity scores</span>
                  <div className="feat-micro-text">Shows cyclomatic complexity and coupling per file</div>
                </div>
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">Impact radius</span>
                  <div className="feat-micro-text">Highlights direct and indirect dependents on click</div>
                </div>
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">Diagram export</span>
                  <div className="feat-micro-text">Export the graph to Mermaid, PlantUML, or JSON</div>
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
                    <span className="mf-mono" style={{ marginLeft: 10, color: "#a3a3a3", fontSize: "0.72rem" }}>
                      Click any node to inspect its connections
                    </span>
                  </div>
                  <span className="mf-studio-stat-pill">5 clusters · 6 edges</span>
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
                          stroke={active ? "#ffffff" : "rgba(255,255,255,0.18)"}
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
                              fill="rgba(255, 255, 255, 0.08)"
                              stroke="#ffffff"
                              strokeWidth="1.2"
                              strokeDasharray="3 3"
                            />
                          )}
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={isSel ? 13 : 9}
                            fill={isSel ? "#ffffff" : "#17171c"}
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
                      <span className="mf-mono" style={{ color: "#ffffff", fontSize: "0.68rem" }}>
                        SELECTED NODE · {activeNode.cluster}
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
            <span className="mf-mono mf-muted">02 &amp; 03 · Request tracing and commit history</span>
            <span className="mf-mono mf-muted">Follow execution paths and review recent changes</span>
          </div>

          <div className="feat-stagger-wrap">
            {/* 02. LEFT-ANCHORED 8-COLUMN BLOCK: CODE FLOW TRACER */}
            <div id="feat-02" className="feat-stagger-left feat-block">
              <Reveal>
                <div className="feat-editorial-card">
                  <div className="feat-num-row">
                    <span className="feat-giant-num">02</span>
                    <div style={{ textAlign: "right" }}>
                      <Pill live>Call path stepper</Pill>
                      <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                        Entry handler to database query
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 28, alignItems: "end" }}>
                    <h2 className="mf-h1" style={{ margin: 0 }}>
                      Code flow <span className="dx-muted-word">tracer.</span>
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
                      Each step links directly to its file and line number
                    </div>
                    <button
                      type="button"
                      className="mf-btn ghost sm"
                      onClick={() => setActiveHop((prev) => (prev + 1) % FLOW_HOPS.length)}
                    >
                      Next step ({activeHop + 1}/{FLOW_HOPS.length})
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
                      <Pill live>Commit history</Pill>
                      <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                        Downstream impact per commit
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "0.95fr 1.15fr", gap: 28, alignItems: "end" }}>
                    <h2 className="mf-h1" style={{ margin: 0 }}>
                      Drift <span className="dx-muted-word">timeline.</span>
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
                    <Pill live>Codebase Q&amp;A</Pill>
                    <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                      Vector search combined with AST symbol lookup
                    </div>
                  </div>
                </div>
                <h2 className="mf-h1" style={{ margin: 0 }}>
                  Ask DevLens <span className="dx-muted-word">Copilot.</span>
                </h2>
              </div>

              <div>
                <p className="mf-lead" style={{ margin: 0 }}>
                  Pin any file with <code style={{ fontFamily: "var(--mf-mono)" }}>@mention</code> and
                  ask how a feature works. Every answer links to the exact source lines it used.
                </p>
              </div>
            </div>

            <div className="feat-copilot-grid">
              {/* Left Prompt & Context Selector */}
              <div className="feat-copilot-sidebar">
                <div className="mf-mono mf-muted" style={{ marginBottom: 4 }}>
                  Sample questions
                </div>
                {COPILOT_DEMOS.map((item, idx) => (
                  <button
                    key={item.pin}
                    type="button"
                    className={`feat-prompt-btn ${idx === activePrompt ? "active" : ""}`}
                    onClick={() => setActivePrompt(idx)}
                  >
                    <div className="mf-mono" style={{ fontSize: "0.68rem", opacity: 0.75, marginBottom: 6 }}>
                      Pinned: {item.pin}
                    </div>
                    <div>{item.q}</div>
                  </button>
                ))}

                <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="mf-mono mf-muted" style={{ fontSize: "0.68rem" }}>
                    Included in every answer
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    <span className="mf-studio-stat-pill">File &amp; line links</span>
                    <span className="mf-studio-stat-pill">@file pinning</span>
                    <span className="mf-studio-stat-pill">Follow-up threads</span>
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
                        Pinned: {currentCopilot.pin}
                      </span>
                      <span className="mf-mono" style={{ color: "#ffffff", fontSize: "0.72rem" }}>
                        3 symbols referenced
                      </span>
                    </div>

                    <div style={{ fontSize: "clamp(1.2rem, 2vw, 1.5rem)", fontWeight: 500, color: "#ffffff", letterSpacing: "-0.02em", marginBottom: 16 }}>
                      {currentCopilot.q}
                    </div>

                    <p style={{ fontSize: "1.05rem", lineHeight: 1.65, color: "#d4d4d4", margin: 0 }}>
                      {currentCopilot.a}
                    </p>

                    {/* Verified Source Citations */}
                    <div style={{ marginTop: 28 }}>
                      <div className="mf-mono mf-muted" style={{ marginBottom: 10, fontSize: "0.72rem" }}>
                        Cited source lines
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
                              background: "rgba(255, 255, 255, 0.08)",
                              border: "1px solid rgba(255, 255, 255, 0.2)",
                              color: "#ffffff",
                            }}
                          >
                            {cite}
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
                  <div className="mf-mono mf-muted" style={{ fontSize: "0.72rem" }}>
                    Symbols: {currentCopilot.symbols.join(" · ")}
                  </div>
                  <Link to="/dashboard" className="mf-btn inv sm">
                    Open dashboard
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
                      {copiedDoc ? "Copied Markdown" : "Copy Markdown"}
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
                  <Pill live>Onboarding guide</Pill>
                  <div className="mf-mono mf-muted" style={{ marginTop: 8 }}>
                    Exportable Markdown summary
                  </div>
                </div>
              </div>

              <h2 className="mf-h1" style={{ margin: 0 }}>
                Onboarding <span className="dx-muted-word">doc.</span>
              </h2>

              <p className="mf-lead" style={{ margin: 0 }}>
                Generate a structured overview of any repository: where requests enter, how modules
                are organized, and which high-coupling files new teammates should read first.
              </p>

              <div className="feat-subgrid-2x2">
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">Markdown export</span>
                  <div className="feat-micro-text">Copy clean Markdown for your repo README or wiki</div>
                </div>
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">Module boundaries</span>
                  <div className="feat-micro-text">Lists folder responsibilities and import rules</div>
                </div>
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">High-coupling files</span>
                  <div className="feat-micro-text">Flags files with the most dependents and complexity</div>
                </div>
                <div className="feat-micro-card">
                  <span className="feat-micro-idx">Branch updates</span>
                  <div className="feat-micro-text">Regenerates whenever you index a new branch or commit</div>
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
                  <Pill>Comparison</Pill>
                  <h2 className="mf-h2" style={{ marginTop: 16 }}>
                    Why static grep &amp; generic chat <span className="dx-muted-word">fall short.</span>
                  </h2>
                </div>
                <span className="mf-mono mf-muted">How AST parsing compares to text search and generic chat</span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="feat-matrix">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>IDE search / grep</th>
                      <th>Generic LLM chat</th>
                      <th>DevLens</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Cross-file call hierarchy</td>
                      <td className="mf-muted">Manual file-by-file jumping</td>
                      <td className="mf-muted">Guesses unindexed imports</td>
                      <td><strong>Resolved Tree-sitter import graph</strong></td>
                    </tr>
                    <tr>
                      <td>Commit impact check</td>
                      <td className="mf-muted">Raw line diff only</td>
                      <td className="mf-muted">No cross-file dependency graph</td>
                      <td><strong>Direct and indirect dependent check</strong></td>
                    </tr>
                    <tr>
                      <td>Source code citations</td>
                      <td className="mf-muted">String match only</td>
                      <td className="mf-muted">Unverified snippets</td>
                      <td><strong>Clickable file and line links</strong></td>
                    </tr>
                    <tr>
                      <td>New engineer onboarding</td>
                      <td className="mf-muted">Reading folders by hand</td>
                      <td className="mf-muted">Outdated README summaries</td>
                      <td><strong>Generated Markdown overview</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}
