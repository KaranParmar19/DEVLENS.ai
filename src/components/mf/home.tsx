import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { Pill, Reveal, SiteLayout } from "./site-layout";
import { StatsSection } from "@/components/ui/stats-section";
import { FAQSection } from "@/components/ui/faq-section";
import { MorphText } from "@/components/ui/morph-text";
import { normalizeRepoUrl } from "@/lib/utils";

const TRY = [
  { label: "facebook/react", tag: "TS / Core" },
  { label: "vercel/next.js", tag: "Monorepo" },
  { label: "fastapi/fastapi", tag: "Python" },
  { label: "tailwindlabs/tailwindcss", tag: "CSS Engine" },
];

const FEATURES = [
  {
    n: "01",
    t: "Architecture map",
    d: "A live dependency graph of every module, clustered by package, with coupling and cyclomatic complexity scored per node.",
    tag: "LIVE AST GRAPH",
  },
  {
    n: "02",
    t: "Code flow tracer",
    d: "Trace a request from entry point to data layer. Scrub through the full call path one execution hop at a time.",
    tag: "CALL GRAPH",
  },
  {
    n: "03",
    t: "Drift timeline",
    d: "Step through commit history to assess blast radius, dependency deltas, and architectural erosion before shipping.",
    tag: "RISK RADAR",
  },
  {
    n: "04",
    t: "Ask DevLens Copilot",
    d: "An AI copilot grounded directly in parsed AST symbols and call hierarchies. Every answer cites exact source lines.",
    tag: "AST GROUNDED",
  },
  {
    n: "05",
    t: "Onboarding doc generator",
    d: "A generated architectural walkthrough: what matters, what's fragile, and where to start reading.",
    tag: "AUTODOC",
  },
];

const STEPS = [
  {
    t: "Paste a repo",
    d: "Any public GitHub repository URL or shorthand (owner/repo) — or connect private repositories with a PAT.",
  },
  {
    t: "Tree-sitter parses it",
    d: "Clone to an ephemeral worker, parse AST syntax trees, resolve module imports and compute cyclomatic blast radius.",
  },
  {
    t: "Explore & interrogate",
    d: "Interact with the architecture map, trace execution flows, and ask the cited Copilot in plain English.",
  },
];

const MARQUEE = [
  "React",
  "Next.js",
  "FastAPI",
  "Django",
  "Rails",
  "Express",
  "Laravel",
  "Spring",
  "Svelte",
  "Vue",
  "Nest",
  "Go-Gin",
  "Flask",
  "Actix-Web",
];

function Marquee() {
  const items = [...MARQUEE, ...MARQUEE];
  return (
    <div className="mf-marquee" aria-hidden>
      <div className="mf-marquee-track">
        {items.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
    </div>
  );
}

/* Interactive Mini graph used inside the product frame */
const GRAPH_NODES = [
  { id: 0, label: "server.ts", x: 60, y: 70, coupling: 0.92, complexity: 12 },
  { id: 1, label: "router.ts", x: 150, y: 40, coupling: 0.88, complexity: 16 },
  { id: 2, label: "middleware.ts", x: 150, y: 120, coupling: 0.65, complexity: 8 },
  { id: 3, label: "app-render.tsx", x: 250, y: 80, coupling: 0.95, complexity: 22 },
  { id: 4, label: "context.ts", x: 250, y: 170, coupling: 0.45, complexity: 6 },
  { id: 5, label: "response.ts", x: 340, y: 40, coupling: 0.52, complexity: 9 },
  { id: 6, label: "stream.ts", x: 340, y: 130, coupling: 0.74, complexity: 14 },
  { id: 7, label: "db.ts", x: 430, y: 90, coupling: 0.82, complexity: 11 },
  { id: 8, label: "auth.ts", x: 120, y: 200, coupling: 0.61, complexity: 7 },
  { id: 9, label: "session.ts", x: 220, y: 250, coupling: 0.55, complexity: 8 },
];

const GRAPH_EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [2, 4],
  [3, 5],
  [3, 6],
  [6, 7],
  [4, 6],
  [2, 8],
  [8, 9],
  [4, 9],
];

function MiniGraph({
  selectedNodeId,
  onSelectNode,
}: {
  selectedNodeId: number;
  onSelectNode: (id: number) => void;
}) {
  const connectedEdges = GRAPH_EDGES.filter(
    ([a, b]) => a === selectedNodeId || b === selectedNodeId,
  );
  const connectedNodeIds = new Set(connectedEdges.flatMap(([a, b]) => [a, b]));

  return (
    <svg
      viewBox="0 0 500 300"
      width="100%"
      height="100%"
      role="img"
      aria-label="Interactive Sample Dependency Graph"
      style={{ cursor: "crosshair" }}
    >
      {/* Background grid dots */}
      <defs>
        <pattern id="graph-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.08)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#graph-grid)" />

      {/* Edges */}
      {GRAPH_EDGES.map(([a, b], i) => {
        const isConnected = a === selectedNodeId || b === selectedNodeId;
        return (
          <line
            key={i}
            x1={GRAPH_NODES[a].x}
            y1={GRAPH_NODES[a].y}
            x2={GRAPH_NODES[b].x}
            y2={GRAPH_NODES[b].y}
            stroke={isConnected ? "#ffffff" : "rgba(255,255,255,0.2)"}
            strokeWidth={isConnected ? 2 : 1}
            strokeDasharray={isConnected ? "none" : "3 3"}
            style={{ transition: "all 0.3s" }}
          />
        );
      })}

      {/* Nodes */}
      {GRAPH_NODES.map((n) => {
        const isSelected = n.id === selectedNodeId;
        const isConnected = connectedNodeIds.has(n.id);

        return (
          <g key={n.id} onClick={() => onSelectNode(n.id)} style={{ cursor: "pointer" }}>
            {isSelected && (
              <circle
                cx={n.x}
                cy={n.y}
                r="24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.5"
                opacity="0.4"
                strokeDasharray="4 4"
              />
            )}
            <circle
              cx={n.x}
              cy={n.y}
              r={isSelected ? 14 : isConnected ? 9 : 7}
              fill={isSelected ? "#ffffff" : isConnected ? "rgba(255,255,255,0.8)" : "#0c0c0f"}
              stroke="#ffffff"
              strokeWidth={isSelected ? 2.5 : 1.5}
              style={{ transition: "all 0.25s" }}
            />
            <text
              x={n.x}
              y={n.y + (isSelected ? 26 : 20)}
              textAnchor="middle"
              fill={isSelected ? "#ffffff" : "rgba(255,255,255,0.6)"}
              fontSize={isSelected ? "11" : "9"}
              fontFamily="var(--mf-mono, monospace)"
              fontWeight={isSelected ? 600 : 400}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const COPILOT_PREVIEWS: Record<number, { q: string; a: string; sources: string }> = {
  0: {
    q: "What is server.ts responsible for?",
    a: "server.ts initializes the HTTP listener, sets up middleware pipelines, and delegates route matching to router.ts. It is the primary architectural entry point.",
    sources: "server.ts:1-45 · router.ts:12",
  },
  1: {
    q: "What breaks if I delete router.ts?",
    a: "14 direct imports break. AppRouter and DevServer lose their routing layer; 9 of 14 consumer paths have no tests.",
    sources: "server/router.ts · app-render.tsx",
  },
  3: {
    q: "What is the blast radius of app-render.tsx?",
    a: "Modifying app-render.tsx impacts 8 downstream rendering sinks including stream.ts, response.ts, and db.ts. Cyclomatic complexity is 22.",
    sources: "app-render.tsx:44-180 · stream.ts",
  },
};

function ProductFrame() {
  const [frameTab, setFrameTab] = useState<"architecture" | "flow" | "drift" | "doc">(
    "architecture",
  );
  const [selectedNodeId, setSelectedNodeId] = useState(1);
  const activeNode = GRAPH_NODES.find((n) => n.id === selectedNodeId) ?? GRAPH_NODES[1];
  const copilotData = COPILOT_PREVIEWS[selectedNodeId] ?? COPILOT_PREVIEWS[1];

  return (
    <div className="mf-frame">
      <div
        className="mf-frame-bar"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i />
          <i />
          <i />
          <span className="mf-mono">devlens // vercel/next.js // main</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="mf-pill"
            style={{
              padding: "3px 8px",
              fontSize: "0.625rem",
              color: "#10b981",
              borderColor: "rgba(16,185,129,0.3)",
            }}
          >
            ● AST ENGINE LIVE
          </span>
        </div>
      </div>

      <div className="mf-frame-body">
        {/* Left: Files Pane */}
        <div>
          <div
            className="mf-mono"
            style={{
              color: "#8a8a8a",
              marginBottom: 12,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Source Tree</span>
            <span style={{ opacity: 0.5 }}>10 files</span>
          </div>
          {GRAPH_NODES.map((n) => {
            const isSelected = n.id === selectedNodeId;
            return (
              <div
                key={n.id}
                onClick={() => setSelectedNodeId(n.id)}
                style={{
                  fontFamily: "var(--mf-mono)",
                  fontSize: 12,
                  padding: "6px 8px",
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: isSelected ? "#262626" : "transparent",
                  color: isSelected ? "#fff" : "#9a9a9a",
                  transition: "all 0.15s",
                }}
              >
                <span>{n.label}</span>
                {isSelected && (
                  <span style={{ fontSize: "0.625rem", color: "#10b981" }}>focus</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Center: Interactive Workspace Canvas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Studio Tab bar switcher */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {(
              [
                { id: "architecture", label: "Architecture Map" },
                { id: "flow", label: "Code Flow" },
                { id: "drift", label: "Drift Timeline" },
                { id: "doc", label: "Onboarding Doc" },
              ] as const
            ).map((t) => {
              const active = frameTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFrameTab(t.id)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 999,
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "0.6875rem",
                    border: "1px solid",
                    borderColor: active ? "#ffffff" : "rgba(255,255,255,0.12)",
                    background: active ? "#ffffff" : "transparent",
                    color: active ? "#000000" : "rgba(255,255,255,0.6)",
                    cursor: "pointer",
                    fontWeight: active ? 600 : 400,
                    transition: "all 0.2s",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Interactive Tab Content View */}
          <div
            style={{
              flex: 1,
              minHeight: 280,
              position: "relative",
              borderRadius: 12,
              overflow: "hidden",
              background: "#060608",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {frameTab === "architecture" && (
              <>
                <MiniGraph selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
                <div
                  style={{
                    position: "absolute",
                    bottom: 12,
                    left: 14,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    zIndex: 10,
                  }}
                >
                  <span className="mf-studio-stat-pill">
                    <span style={{ color: "rgba(255, 255, 255, 0.65)", fontWeight: 400 }}>
                      Selected:
                    </span>
                    <strong style={{ color: "#ffffff", fontWeight: 700 }}>
                      {activeNode.label}
                    </strong>
                  </span>
                  <span className="mf-studio-stat-pill">
                    <span style={{ color: "rgba(255, 255, 255, 0.65)", fontWeight: 400 }}>
                      Coupling:
                    </span>
                    <strong style={{ color: "#38bdf8", fontWeight: 700 }}>
                      {activeNode.coupling}
                    </strong>
                  </span>
                  <span className="mf-studio-stat-pill">
                    <span style={{ color: "rgba(255, 255, 255, 0.65)", fontWeight: 400 }}>
                      Complexity:
                    </span>
                    <strong style={{ color: "#10b981", fontWeight: 700 }}>
                      {activeNode.complexity}
                    </strong>
                  </span>
                </div>
              </>
            )}

            {frameTab === "flow" && (
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <span
                  className="mf-mono"
                  style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.5)" }}
                >
                  EXECUTION FLOW TRACER // INCOMING HTTP
                </span>
                {[
                  {
                    step: "01",
                    func: "server.listen()",
                    file: "server.ts:18",
                    note: "Binds port, attaches middleware",
                  },
                  {
                    step: "02",
                    func: "router.dispatch(req)",
                    file: "router.ts:54",
                    note: "Matches pathname to AppRouter route",
                  },
                  {
                    step: "03",
                    func: "renderToReadableStream()",
                    file: "app-render.tsx:92",
                    note: "Renders server component tree",
                  },
                  {
                    step: "04",
                    func: "streamResponse(sink)",
                    file: "stream.ts:31",
                    note: "Flushes chunked HTML to client socket",
                  },
                ].map((s) => (
                  <div
                    key={s.step}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <span className="mf-mono" style={{ color: "#ffffff", fontWeight: 600 }}>
                      {s.step}
                    </span>
                    <span className="mf-mono" style={{ color: "#38bdf8", fontSize: "0.75rem" }}>
                      {s.func}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}>
                      {s.note}
                    </span>
                    <span
                      className="mf-mono"
                      style={{
                        marginLeft: "auto",
                        fontSize: "0.625rem",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      {s.file}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {frameTab === "drift" && (
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <span
                  className="mf-mono"
                  style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.5)" }}
                >
                  COMMIT DRIFT &amp; BLAST RADIUS
                </span>
                <div
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    padding: 14,
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div
                    style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}
                  >
                    <span className="mf-mono" style={{ color: "#ffffff" }}>
                      sha: e4f82a1 · refactor: decouple router handler
                    </span>
                    <span
                      className="mf-pill"
                      style={{ color: "#10b981", borderColor: "rgba(16,185,129,0.4)" }}
                    >
                      RISK: LOW
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "rgba(255,255,255,0.7)",
                      lineHeight: 1.5,
                    }}
                  >
                    3 files touched, 42 insertions, 12 deletions. 0 cyclic dependencies introduced.
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                    <span className="mf-pill" style={{ fontSize: "0.625rem" }}>
                      router.ts (+24)
                    </span>
                    <span className="mf-pill" style={{ fontSize: "0.625rem" }}>
                      server.ts (+18)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {frameTab === "doc" && (
              <div
                style={{
                  padding: 20,
                  maxHeight: 270,
                  overflowY: "auto",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  color: "rgba(255,255,255,0.8)",
                  lineHeight: 1.6,
                }}
              >
                <div
                  style={{
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    marginBottom: 8,
                  }}
                >
                  # Architectural Onboarding Overview
                </div>
                <p style={{ color: "rgba(255,255,255,0.6)", margin: "0 0 12px" }}>
                  This service is organized into a modular pipeline centered around
                  `app-render.tsx`. Inbound connections enter through `server.ts` and dispatch
                  through `router.ts`.
                </p>
                <div style={{ color: "#38bdf8", fontWeight: 600, margin: "12px 0 4px" }}>
                  ## Fragile Junctions
                </div>
                <p style={{ color: "rgba(255,255,255,0.6)", margin: 0 }}>
                  High fan-out detected on `router.ts` (coupled with 6 downstream handlers).
                  Modifications require updating integration tests in `tests/test_router.py`.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Cited Copilot Box */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="mf-mono" style={{ color: "#8a8a8a", marginBottom: 12 }}>
              Ask DevLens Copilot
            </div>
            <div
              style={{
                background: "#171717",
                borderRadius: 10,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.45,
                marginBottom: 12,
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {copilotData.q}
            </div>
            <div
              style={{
                border: "1px solid rgba(255,255,255,.15)",
                borderRadius: 10,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.5,
                color: "#d4d4d4",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              {copilotData.a}
              <div
                className="mf-mono"
                style={{ marginTop: 10, color: "#38bdf8", fontSize: "0.6875rem" }}
              >
                ↳ {copilotData.sources}
              </div>
            </div>
          </div>

          <div
            style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}
          >
            <span
              className="mf-mono"
              style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.4)" }}
            >
              Click nodes or files on left to spotlight
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const [repo, setRepo] = useState("");

  const go = (value: string) => {
    const normalized = normalizeRepoUrl(value);
    if (!normalized) {
      navigate({ to: "/dashboard" });
      return;
    }
    navigate({ to: "/dashboard", search: { repo: normalized } });
  };

  return (
    <SiteLayout>
      {/* Hero Section */}
      <section className="mf-hero" data-theme="light">
        <div className="mf-hero-grid-bg" />
        <div className="mf-wrap">
          <motion.div
            className="mf-hero-top"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Pill live>Tree-sitter AST Graph + Cited Copilot</Pill>
          </motion.div>

          <motion.h1
            className="mf-mega"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            See the{" "}
            <span className="mf-serif-i">
              <MorphText
                words={["shape", "flows", "graph", "logic", "depth"]}
                morphTime={1.1}
                holdTime={1.8}
                strength={8}
              />
            </span>
            <br />
            of any codebase.
          </motion.h1>

          <div className="mf-hero-foot">
            <motion.div
              style={{ flex: "1 1 540px" }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="mf-lead" style={{ marginBottom: 28 }}>
                DevLens turns any GitHub repository into an interactive architecture map, traceable
                code flows, and a cited copilot that shows its work — in under eight seconds.
              </p>

              <form
                className="mf-ingest"
                onSubmit={(e) => {
                  e.preventDefault();
                  go(repo);
                }}
              >
                <span className="mf-mono mf-muted">github.com/</span>
                <input
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="owner/repo or full URL"
                  aria-label="Repository"
                  spellCheck={false}
                />
                <motion.button
                  className="mf-btn"
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  Analyze <span className="mf-arrow">↗</span>
                </motion.button>
              </form>

              <div className="mf-chips">
                <Link
                  to="/dashboard"
                  search={{ previewLoading: true }}
                  className="mf-pill mf-chip"
                  style={{
                    background: "rgba(16, 185, 129, 0.14)",
                    borderColor: "#10b981",
                    color: "#10b981",
                    fontWeight: 600,
                  }}
                  title="Temporary button to view and fix the loading screen"
                >
                  <span>⚡ Preview Loading Screen</span>
                </Link>

                {TRY.map((t) => (
                  <motion.button
                    key={t.label}
                    type="button"
                    className="mf-pill mf-chip"
                    whileHover={{ y: -2, scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    onClick={() => go(t.label)}
                  >
                    <span>{t.label}</span>
                    <span style={{ opacity: 0.5, fontSize: "0.625rem" }}>({t.tag})</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            <motion.div
              style={{ textAlign: "right" }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.22 }}
            >
              <div className="mf-big-stat">&lt;8s</div>
              <div className="mf-mono mf-muted" style={{ marginTop: 10 }}>
                Median time to full AST graph
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Interactive Product Preview Section */}
      <section
        className="mf-section mf-dark mf-preview-section"
        data-theme="dark"
        style={{
          paddingBlock: "clamp(56px, 7vw, 104px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ width: "100%", maxWidth: "100%", paddingInline: "clamp(16px, 3.5vw, 48px)" }}>
          <Reveal>
            <ProductFrame />
          </Reveal>
        </div>
      </section>

      <Marquee />

      {/* Features Index Section */}
      <section className="mf-section" data-theme="light">
        <div className="mf-wrap">
          <div className="mf-sec-head">
            <Reveal>
              <h2 className="mf-h1" style={{ maxWidth: "10em" }}>
                Five lenses on one repository.
              </h2>
            </Reveal>
            <Link to="/features" className="mf-btn ghost">
              Explore capabilities <span className="mf-arrow">↗</span>
            </Link>
          </div>

          <div>
            {FEATURES.map((f, idx) => (
              <motion.div
                key={f.n}
                whileHover={{ x: 6 }}
                transition={{ type: "spring", stiffness: 400, damping: 26 }}
              >
                <Link to="/features" className="mf-row">
                  <span className="mf-num">0{idx + 1}</span>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                    <span className="mf-row-title">{f.t}</span>
                    <span
                      className="mf-pill"
                      style={{
                        padding: "3px 9px",
                        fontSize: "0.625rem",
                        letterSpacing: "0.06em",
                        transition: "all 0.25s ease",
                      }}
                    >
                      {f.tag}
                    </span>
                  </div>
                  <span className="mf-body">{f.d}</span>
                  <span className="mf-arrow" style={{ fontSize: 24 }}>
                    ↗
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section (Framer StatsSection Feature) */}
      <section className="mf-section" data-theme="light" style={{ paddingTop: 0 }}>
        <div className="mf-wrap">
          <Reveal>
            <StatsSection />
          </Reveal>
        </div>
      </section>

      {/* Process / Pipeline */}
      <section className="mf-section mf-dark" data-theme="dark">
        <div className="mf-wrap">
          <div className="mf-sec-head">
            <Reveal>
              <Pill>Pipeline</Pill>
            </Reveal>
            <Reveal>
              <h2 className="mf-h1" style={{ maxWidth: "10em" }}>
                From repository URL to full comprehension in seconds.
              </h2>
            </Reveal>
          </div>

          {STEPS.map((s, i) => (
            <Reveal key={s.t}>
              <motion.div
                className="mf-step"
                whileHover={{ x: 6 }}
                transition={{ type: "spring", stiffness: 400, damping: 26 }}
              >
                <span className="mf-step-n">0{i + 1}</span>
                <h3 className="mf-h2">{s.t}</h3>
                <p className="mf-lead">{s.d}</p>
              </motion.div>
            </Reveal>
          ))}

          <div style={{ marginTop: 40 }}>
            <Link to="/how-it-works" className="mf-btn inv">
              Inspect pipeline architecture <span className="mf-arrow">↗</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section (Framer FAQ Feature) */}
      <section className="mf-section" data-theme="light">
        <div className="mf-wrap">
          <Reveal>
            <FAQSection />
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}
