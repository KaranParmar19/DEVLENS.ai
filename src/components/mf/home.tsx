import { useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  Terminal,
  ArrowUpRight,
} from "lucide-react";
import { Pill, Reveal, SiteLayout } from "./site-layout";
import { StatsSection } from "@/components/ui/stats-section";
import { PolaroidLineCarousel } from "@/components/ui/polaroid-carousel";
import { FAQSection } from "@/components/ui/faq-section";
import { MorphText } from "@/components/ui/morph-text";
import { PlumblinePipeline } from "@/components/ui/plumbline";
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
    t: "Dependency graph",
    d: "See every file and module import in one interactive graph, with coupling and complexity scores per file.",
    tag: "AST graph",
  },
  {
    n: "02",
    t: "Request flow tracer",
    d: "Follow an HTTP route or worker job from the entry handler down to the database query, one function call at a time.",
    tag: "Call path",
  },
  {
    n: "03",
    t: "Commit impact timeline",
    d: "Check recent commits to see which downstream modules were affected and whether new circular imports were introduced.",
    tag: "Git history",
  },
  {
    n: "04",
    t: "Codebase Q&A",
    d: "Ask how a feature works in plain English. Every answer points to the exact file and line numbers in your repository.",
    tag: "Line links",
  },
  {
    n: "05",
    t: "Onboarding guide",
    d: "Generate a readable summary of the folder layout, main entry points, and fragile files for new teammates.",
    tag: "Overview",
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
interface DemoGraphNode {
  id: number;
  label: string;
  x: number;
  y: number;
  coupling: number;
  complexity: number;
  sinks: number;
  loc: number;
  zone: "ingress" | "router" | "render" | "data";
  role: string;
  tag: string;
}

const GRAPH_NODES: DemoGraphNode[] = [
  {
    id: 0,
    label: "server.ts",
    x: 145,
    y: 130,
    coupling: 0.92,
    complexity: 12,
    sinks: 18,
    loc: 145,
    zone: "ingress",
    role: "HTTP Ingress Listener",
    tag: "ENTRYPOINT",
  },
  {
    id: 1,
    label: "router.ts",
    x: 405,
    y: 130,
    coupling: 0.88,
    complexity: 16,
    sinks: 14,
    loc: 284,
    zone: "router",
    role: "API Dispatch Kernel",
    tag: "HIGH FAN-OUT",
  },
  {
    id: 2,
    label: "middleware.ts",
    x: 145,
    y: 280,
    coupling: 0.65,
    complexity: 8,
    sinks: 12,
    loc: 98,
    zone: "ingress",
    role: "Pipeline & Security Interceptor",
    tag: "INTERCEPTOR",
  },
  {
    id: 3,
    label: "app-render.tsx",
    x: 665,
    y: 130,
    coupling: 0.95,
    complexity: 22,
    sinks: 11,
    loc: 410,
    zone: "render",
    role: "RSC Streaming Engine",
    tag: "CRITICAL CORE",
  },
  {
    id: 4,
    label: "context.ts",
    x: 405,
    y: 280,
    coupling: 0.45,
    complexity: 6,
    sinks: 6,
    loc: 64,
    zone: "router",
    role: "Async Request Context",
    tag: "STATE",
  },
  {
    id: 5,
    label: "response.ts",
    x: 665,
    y: 430,
    coupling: 0.52,
    complexity: 9,
    sinks: 5,
    loc: 92,
    zone: "render",
    role: "HTTP Response Formatter",
    tag: "SERIALIZER",
  },
  {
    id: 6,
    label: "stream.ts",
    x: 665,
    y: 280,
    coupling: 0.74,
    complexity: 14,
    sinks: 8,
    loc: 185,
    zone: "render",
    role: "Chunked Stream Pipeline",
    tag: "TRANSPORT",
  },
  {
    id: 7,
    label: "db.ts",
    x: 890,
    y: 195,
    coupling: 0.82,
    complexity: 11,
    sinks: 4,
    loc: 215,
    zone: "data",
    role: "Postgres Connection Pool",
    tag: "DATABASE",
  },
  {
    id: 8,
    label: "auth.ts",
    x: 145,
    y: 430,
    coupling: 0.61,
    complexity: 7,
    sinks: 9,
    loc: 112,
    zone: "ingress",
    role: "JWT Verification & Crypt",
    tag: "SECURITY",
  },
  {
    id: 9,
    label: "session.ts",
    x: 405,
    y: 430,
    coupling: 0.55,
    complexity: 8,
    sinks: 8,
    loc: 130,
    zone: "router",
    role: "Cookie Session Hydrator",
    tag: "AUTH SINK",
  },
  {
    id: 10,
    label: "cache.ts",
    x: 890,
    y: 365,
    coupling: 0.48,
    complexity: 5,
    sinks: 3,
    loc: 84,
    zone: "data",
    role: "Redis Distributed KV",
    tag: "CACHE",
  },
];

const GRAPH_EDGES: [number, number][] = [
  [0, 1], // server -> router
  [0, 2], // server -> middleware
  [2, 1], // middleware -> router
  [2, 8], // middleware -> auth
  [8, 9], // auth -> session
  [1, 3], // router -> app-render
  [1, 4], // router -> context
  [9, 4], // session -> context
  [4, 3], // context -> app-render
  [4, 6], // context -> stream
  [3, 5], // app-render -> response
  [3, 6], // app-render -> stream
  [3, 7], // app-render -> db
  [6, 5], // stream -> response
  [7, 10], // db -> cache
  [4, 10], // context -> cache
];

const ARCH_ZONES = [
  { id: "ingress", label: "01 / EDGE INGRESS", x: 40, y: 35, width: 215, height: 490 },
  { id: "router", label: "02 / RUNTIME ROUTING", x: 295, y: 35, width: 220, height: 490 },
  { id: "render", label: "03 / STREAM PIPELINE", x: 555, y: 35, width: 220, height: 490 },
  { id: "data", label: "04 / PERSISTENCE", x: 815, y: 35, width: 150, height: 490 },
];

function MiniGraph({
  selectedNodeId,
  onSelectNode,
  blastMode,
  zoom,
  pan,
  isDragging,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onWheel,
}: {
  selectedNodeId: number;
  onSelectNode: (id: number) => void;
  blastMode: boolean;
  zoom: number;
  pan: { x: number; y: number };
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onWheel: (e: React.WheelEvent) => void;
}) {
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);

  // Direct connected edges
  const connectedEdges = GRAPH_EDGES.filter(
    ([a, b]) => a === selectedNodeId || b === selectedNodeId,
  );
  const connectedNodeIds = new Set(connectedEdges.flatMap(([a, b]) => [a, b]));

  // Downstream sinks (blast radius cascade)
  const downstreamSinks = new Set<number>();
  if (blastMode) {
    const queue = [selectedNodeId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      GRAPH_EDGES.forEach(([u, v]) => {
        if (u === curr && !downstreamSinks.has(v)) {
          downstreamSinks.add(v);
          queue.push(v);
        }
      });
    }
  }

  const hoveredNode = hoveredNodeId !== null ? GRAPH_NODES[hoveredNodeId] : null;

  return (
    <svg
      viewBox="0 0 1000 560"
      width="100%"
      height="100%"
      role="img"
      aria-label="Interactive Architecture Intelligence Dependency Graph"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        display: "block",
      }}
    >
      <defs>
        {/* Subtle grid pattern */}
        <pattern id="mini-graph-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.8" fill="rgba(255,255,255,0.07)" />
        </pattern>

        {/* Directional arrowhead markers */}
        <marker
          id="arrow-white"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#ffffff" />
        </marker>
        <marker
          id="arrow-amber"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#f59e0b" />
        </marker>
        <marker
          id="arrow-idle"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 2 L 7 5 L 0 8 z" fill="rgba(255,255,255,0.2)" />
        </marker>
      </defs>

      {/* Background Dot Grid */}
      <rect width="100%" height="100%" fill="url(#mini-graph-grid)" />

      {/* Scalable & Pannable Scene */}
      <g
        transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
        style={{
          transformOrigin: "500px 280px",
          transition: isDragging ? "none" : "transform 0.15s ease-out",
        }}
      >
        {/* Architectural Module Clusters / Zone Boundaries */}
        {ARCH_ZONES.map((zone) => (
          <g key={zone.id}>
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.width}
              height={zone.height}
              rx="12"
              fill="rgba(255,255,255,0.012)"
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="4 4"
            />
            <text
              x={zone.x + 14}
              y={zone.y + 22}
              fill="rgba(255,255,255,0.3)"
              fontSize="9"
              fontFamily="var(--mf-mono, monospace)"
              letterSpacing="0.08em"
              fontWeight="600"
            >
              {zone.label}
            </text>
          </g>
        ))}

        {/* Directed Topological Edges with Smooth Bezier Curves */}
        {GRAPH_EDGES.map(([a, b], i) => {
          const source = GRAPH_NODES[a];
          const target = GRAPH_NODES[b];
          const isSourceSelected = a === selectedNodeId;
          const isTargetSelected = b === selectedNodeId;
          const isConnected = isSourceSelected || isTargetSelected;
          const isBlastPath = blastMode && (a === selectedNodeId || downstreamSinks.has(a)) && downstreamSinks.has(b);

          // Smooth cubic bezier curve
          const dx = Math.abs(target.x - source.x) * 0.45;
          const pathD = `M ${source.x} ${source.y} C ${source.x + dx} ${source.y}, ${target.x - dx} ${target.y}, ${target.x} ${target.y}`;

          if (isBlastPath) {
            return (
              <g key={`edge-${i}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  markerEnd="url(#arrow-amber)"
                />
              </g>
            );
          }

          if (isConnected) {
            return (
              <g key={`edge-${i}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  markerEnd="url(#arrow-white)"
                />
              </g>
            );
          }

          return (
            <path
              key={`edge-${i}`}
              d={pathD}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
              strokeDasharray="3 3"
              markerEnd="url(#arrow-idle)"
            />
          );
        })}

        {/* Graph Nodes */}
        {GRAPH_NODES.map((n) => {
          const isSelected = n.id === selectedNodeId;
          const isConnected = connectedNodeIds.has(n.id);
          const isBlastSink = blastMode && downstreamSinks.has(n.id);
          const isHovered = hoveredNodeId === n.id;

          return (
            <g
              key={n.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(n.id);
              }}
              onMouseEnter={() => setHoveredNodeId(n.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Selected Node: Clean architectural focus ring (no glowing halo) */}
              {isSelected && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r="13"
                  fill="none"
                  stroke={blastMode ? "#f59e0b" : "#ffffff"}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              )}

              {/* Blast sink outline */}
              {isBlastSink && !isSelected && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r="11"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}

              {/* Core Node Circle */}
              <circle
                cx={n.x}
                cy={n.y}
                r={isSelected ? 6.5 : isHovered ? 6 : 5}
                fill={isSelected ? (blastMode ? "#f59e0b" : "#ffffff") : isConnected ? "#ffffff" : "#0d0e14"}
                stroke={isSelected ? "#ffffff" : isConnected ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)"}
                strokeWidth={isSelected ? 2 : 1.2}
                style={{ transition: "all 0.15s ease-out" }}
              />

              {/* Inner depth dot */}
              <circle
                cx={n.x}
                cy={n.y}
                r={isSelected ? 2.5 : 2}
                fill={isSelected ? "#09090b" : isConnected ? "#09090b" : "rgba(255,255,255,0.4)"}
              />

              {/* Monospace Pill Badge for Node Label */}
              <g transform={`translate(${n.x - 48}, ${n.y + 12})`}>
                <rect
                  width="96"
                  height="22"
                  rx="5"
                  fill="#09090b"
                  stroke={
                    isSelected
                      ? (blastMode ? "#f59e0b" : "#ffffff")
                      : isHovered
                        ? "rgba(255,255,255,0.6)"
                        : isConnected || isBlastSink
                          ? "rgba(255,255,255,0.3)"
                          : "rgba(255,255,255,0.12)"
                  }
                  strokeWidth={isSelected || isHovered ? 1.2 : 1}
                  style={{ transition: "stroke 0.15s ease" }}
                />
                {/* Subtle neutral indicator dot */}
                <circle
                  cx="12"
                  cy="11"
                  r="2"
                  fill={
                    isSelected
                      ? (blastMode ? "#f59e0b" : "#ffffff")
                      : isConnected || isBlastSink
                        ? "rgba(255,255,255,0.6)"
                        : "rgba(255,255,255,0.25)"
                  }
                />
                {/* File label */}
                <text
                  x="20"
                  y="14.5"
                  fill={isSelected ? "#ffffff" : isConnected || isBlastSink ? "#f4f4f5" : "rgba(255,255,255,0.65)"}
                  fontSize="9.5"
                  fontFamily="var(--mf-mono, monospace)"
                  fontWeight={isSelected ? 600 : 400}
                >
                  {n.label}
                </text>
              </g>

              {/* In Blast Mode only: Clean minimal sink indicator tag */}
              {isBlastSink && !isSelected && (
                <g transform={`translate(${n.x - 20}, ${n.y - 24})`}>
                  <rect
                    width="40"
                    height="13"
                    rx="3"
                    fill="rgba(245, 158, 11, 0.15)"
                    stroke="#f59e0b"
                    strokeWidth="0.8"
                  />
                  <text
                    x="20"
                    y="9.5"
                    textAnchor="middle"
                    fill="#f59e0b"
                    fontSize="7"
                    fontWeight="600"
                    fontFamily="var(--mf-mono, monospace)"
                  >
                    SINK
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Hover Tooltip Overlay in SVG */}
        {hoveredNode && hoveredNode.id !== selectedNodeId && (
          <g
            transform={`translate(${Math.min(760, hoveredNode.x + 20)}, ${Math.max(45, hoveredNode.y - 45)})`}
            style={{ pointerEvents: "none" }}
          >
            <rect
              width="180"
              height="72"
              rx="8"
              fill="rgba(10, 11, 16, 0.96)"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1"
            />
            <text x="12" y="18" fill="#ffffff" fontWeight="600" fontSize="10" fontFamily="var(--mf-mono)">
              {hoveredNode.label}
            </text>
            <text x="12" y="32" fill="rgba(255,255,255,0.7)" fontSize="8" fontFamily="var(--mf-mono)">
              {hoveredNode.role}
            </text>
            <text x="12" y="48" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="var(--mf-mono)">
              Coupling: {hoveredNode.coupling} · Complexity: {hoveredNode.complexity}
            </text>
            <text x="12" y="62" fill="#ffffff" fontSize="8" fontFamily="var(--mf-mono)">
              Blast Radius: +{hoveredNode.sinks} downstream sinks
            </text>
          </g>
        )}
      </g>
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
  2: {
    q: "What does middleware.ts intercept?",
    a: "middleware.ts applies security headers, validates CORS preflights, and forwards auth credentials to auth.ts before requests hit the router.",
    sources: "middleware.ts:14-68 · auth.ts:22",
  },
  3: {
    q: "What is the blast radius of app-render.tsx?",
    a: "Modifying app-render.tsx impacts 8 downstream rendering sinks including stream.ts, response.ts, and db.ts. Cyclomatic complexity is 22.",
    sources: "app-render.tsx:44-180 · stream.ts",
  },
  4: {
    q: "How is context.ts populated across async boundaries?",
    a: "context.ts leverages Node AsyncLocalStorage to propagate request-scoped traces, user IDs, and telemetry spans from session.ts into app-render.tsx.",
    sources: "context.ts:8-52 · session.ts:31",
  },
  5: {
    q: "What protocols does response.ts support?",
    a: "response.ts formats standard HTTP/1.1 and HTTP/2 stream responses, setting content-type headers, cache headers, and chunked transfer encodings.",
    sources: "response.ts:1-74 · stream.ts:40",
  },
  6: {
    q: "How does stream.ts handle client backpressure?",
    a: "stream.ts creates a ReadableStream pipe to the client socket, pausing RSC chunk serialization when high water mark is exceeded.",
    sources: "stream.ts:18-95 · response.ts:12",
  },
  7: {
    q: "Where is the database connection pool defined?",
    a: "db.ts manages the Postgres connection pool with keep-alive timeouts and integrates with cache.ts for read-through query memoization.",
    sources: "db.ts:10-85 · cache.ts:14",
  },
  8: {
    q: "How are JWT tokens verified in auth.ts?",
    a: "auth.ts validates Ed25519 signatures, checks expiry timestamps, and hydrates user claims into session.ts. Invalids return 401 Unauthorized.",
    sources: "auth.ts:24-102 · session.ts:18",
  },
  9: {
    q: "What is stored in session.ts?",
    a: "session.ts decrypts signed session cookies and stores ephemeral user identity, permissions, and organization tenant ID for context.ts.",
    sources: "session.ts:12-78 · context.ts:19",
  },
  10: {
    q: "How does cache.ts handle cache invalidation?",
    a: "cache.ts utilizes Redis tagged keys with 300s TTL. DB write mutations trigger selective cache key invalidation across the cluster.",
    sources: "cache.ts:5-62 · db.ts:48",
  },
};

function ProductFrame() {
  const [frameTab, setFrameTab] = useState<"architecture" | "flow" | "drift" | "doc">(
    "architecture",
  );
  const [selectedNodeId, setSelectedNodeId] = useState(1);
  const [blastMode, setBlastMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const activeNode = GRAPH_NODES.find((n) => n.id === selectedNodeId) ?? GRAPH_NODES[1];
  const copilotData = COPILOT_PREVIEWS[selectedNodeId] ?? COPILOT_PREVIEWS[1];

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement | SVGElement;
      if (
        target.tagName === "svg" ||
        target.tagName === "rect" ||
        target.tagName === "pattern"
      ) {
        setIsDragging(true);
        dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPan({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom((z) => Math.min(1.7, Math.max(0.7, +(z + delta).toFixed(2))));
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(1.7, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.7, +(z - 0.15).toFixed(2)));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

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
          <span className="mf-mono">devlens · vercel/next.js · main</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="mf-pill"
            style={{
              padding: "3px 8px",
              fontSize: "0.68rem",
              color: "#ffffff",
              borderColor: "rgba(255,255,255,0.2)",
            }}
          >
            Indexed
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
              alignItems: "center",
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <span>Source Tree</span>
            <span
              style={{
                opacity: 0.6,
                background: "rgba(255,255,255,0.08)",
                padding: "1px 6px",
                borderRadius: 4,
              }}
            >
              {GRAPH_NODES.length} files
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              maxHeight: 460,
              overflowY: "auto",
            }}
          >
            {GRAPH_NODES.map((n) => {
              const isSelected = n.id === selectedNodeId;
              return (
                <div
                  key={n.id}
                  onClick={() => setSelectedNodeId(n.id)}
                  style={{
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: 12,
                    padding: "6px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: isSelected ? "rgba(255,255,255,0.08)" : "transparent",
                    border: isSelected
                      ? "1px solid rgba(255,255,255,0.18)"
                      : "1px solid transparent",
                    color: isSelected ? "#ffffff" : "#a1a1aa",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: isSelected ? "#ffffff" : "rgba(255,255,255,0.25)",
                        display: "inline-block",
                      }}
                    />
                    <span>{n.label}</span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      opacity: isSelected ? 0.75 : 0.35,
                      fontFamily: "var(--mf-mono)",
                    }}
                  >
                    {n.loc}L
                  </span>
                </div>
              );
            })}
          </div>
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
              minHeight: 480,
              position: "relative",
              borderRadius: 14,
              overflow: "hidden",
              background: "#08080b",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "inset 0 0 50px rgba(0,0,0,0.45)",
            }}
          >
            {frameTab === "architecture" && (
              <>
                {/* Top Canvas HUD & Controls */}
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 14,
                    right: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    zIndex: 10,
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      pointerEvents: "auto",
                    }}
                  >
                    <span
                      className="mf-mono"
                      style={{
                        fontSize: "0.6875rem",
                        color: "rgba(255,255,255,0.6)",
                        letterSpacing: "0.06em",
                        fontWeight: 500,
                        textTransform: "uppercase",
                      }}
                    >
                      Architecture Map · {GRAPH_NODES.length} Modules · {GRAPH_EDGES.length} Edges
                    </span>
                    {blastMode && (
                      <span
                        className="mf-mono"
                        style={{
                          fontSize: "0.625rem",
                          color: "#f59e0b",
                          background: "rgba(245, 158, 11, 0.12)",
                          border: "1px solid rgba(245, 158, 11, 0.3)",
                          padding: "2px 7px",
                          borderRadius: 4,
                          fontWeight: 500,
                        }}
                      >
                        Blast radius active
                      </span>
                    )}
                  </div>

                  {/* Canvas Controls */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      pointerEvents: "auto",
                    }}
                  >
                    <button
                      type="button"
                      className="devlens-canvas-btn"
                      onClick={handleZoomOut}
                      title="Zoom Out"
                    >
                      −
                    </button>
                    <span
                      className="devlens-canvas-btn"
                      style={{
                        cursor: "default",
                        minWidth: 44,
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      className="devlens-canvas-btn"
                      onClick={handleZoomIn}
                      title="Zoom In"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="devlens-canvas-btn"
                      onClick={handleResetZoom}
                      title="Reset Framing"
                    >
                      ⟲ Fit
                    </button>
                    <button
                      type="button"
                      className={`devlens-canvas-btn ${blastMode ? "active" : ""}`}
                      onClick={() => setBlastMode((b) => !b)}
                      style={{
                        marginLeft: 4,
                        background: blastMode ? "#f59e0b" : undefined,
                        color: blastMode ? "#000000" : undefined,
                        borderColor: blastMode ? "#f59e0b" : undefined,
                      }}
                      title="Toggle Blast Radius Calculation"
                    >
                      ⚡ Blast Radius
                    </button>
                  </div>
                </div>

                {/* SVG Graph Canvas */}
                <MiniGraph
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  blastMode={blastMode}
                  zoom={zoom}
                  pan={pan}
                  isDragging={isDragging}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onWheel={handleWheel}
                />

                {/* Bottom Left HUD Metadata Chips */}
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
                    <span style={{ color: "rgba(255, 255, 255, 0.5)", fontWeight: 400 }}>
                      Selected:
                    </span>
                    <strong style={{ color: "#ffffff", fontWeight: 700 }}>
                      {activeNode.label}
                    </strong>
                  </span>
                  <span className="mf-studio-stat-pill">
                    <span style={{ color: "rgba(255, 255, 255, 0.5)", fontWeight: 400 }}>
                      Coupling:
                    </span>
                    <strong
                      style={{
                        color: activeNode.coupling > 0.8 ? "#f59e0b" : "#ffffff",
                        fontWeight: 700,
                      }}
                    >
                      {activeNode.coupling} {activeNode.coupling > 0.8 ? "(High)" : ""}
                    </strong>
                  </span>
                  <span className="mf-studio-stat-pill">
                    <span style={{ color: "rgba(255, 255, 255, 0.5)", fontWeight: 400 }}>
                      Complexity:
                    </span>
                    <strong
                      style={{
                        color: activeNode.complexity > 15 ? "#f59e0b" : "#ffffff",
                        fontWeight: 700,
                      }}
                    >
                      {activeNode.complexity}
                    </strong>
                  </span>
                  <span className="mf-studio-stat-pill">
                    <span style={{ color: "rgba(255, 255, 255, 0.5)", fontWeight: 400 }}>
                      Downstream:
                    </span>
                    <strong style={{ color: "#ffffff", fontWeight: 700 }}>
                      +{activeNode.sinks} Sinks
                    </strong>
                  </span>
                </div>

                {/* Bottom Right Helper Hint */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 14,
                    right: 14,
                    zIndex: 10,
                    pointerEvents: "none",
                  }}
                >
                  <span
                    className="mf-mono"
                    style={{
                      fontSize: "0.625rem",
                      color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Drag to pan · Scroll to zoom · Click node to focus
                  </span>
                </div>
              </>
            )}

            {frameTab === "flow" && (
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <span
                  className="mf-mono"
                  style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}
                >
                  Incoming HTTP request trace
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
                  style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}
                >
                  Recent commit impact
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
                      style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.2)" }}
                    >
                      Low impact
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
            <div
              className="mf-mono"
              style={{
                color: "#8a8a8a",
                marginBottom: 12,
                fontSize: "0.6875rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              DevLens Copilot
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 13,
                lineHeight: 1.45,
                marginBottom: 12,
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.12)",
                fontFamily: "var(--mf-mono, monospace)",
              }}
            >
              {copilotData.q}
            </div>
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "14px",
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "#d4d4d8",
                background: "rgba(10,10,14,0.6)",
              }}
            >
              {copilotData.a}
              <div
                className="mf-mono"
                style={{
                  marginTop: 12,
                  color: "#ffffff",
                  fontSize: "0.6875rem",
                  padding: "4px 8px",
                  background: "rgba(255, 255, 255, 0.06)",
                  borderRadius: 6,
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  display: "inline-block",
                }}
              >
                ↳ {copilotData.sources}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span
              className="mf-mono"
              style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.4)" }}
            >
              Click any node in graph or file in tree
            </span>
            <span className="mf-mono" style={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.5)" }}>
              Target: {activeNode.label} ({activeNode.role})
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
            <MorphText
              words={["shape", "flows", "graph", "logic", "depth"]}
              morphTime={1.1}
              holdTime={1.8}
              strength={8}
            />
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
                Paste a GitHub URL to see how its files connect and how requests move through the
                code. Every answer links back to the exact file and line number.
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
                  Open repo
                </motion.button>
              </form>

              <div className="mf-chips">
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
                Five views on one repository.
              </h2>
            </Reveal>
            <Link to="/features" className="mf-btn ghost">
              See all features
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

      {/* Hanging Polaroid Line Carousel (Framer Feature) */}
      <section className="mf-section pl-section-wrap" data-theme="light" style={{ paddingTop: 0 }}>
        <div className="mf-wrap">
          <Reveal>
            <div className="pl-deck-header">
              <div className="pl-deck-eyebrow">
                <span className="pl-deck-label mf-mono">TECHNICAL SPECIFICATIONS</span>
              </div>
              <span className="pl-deck-hint mf-mono">
                Drag or click cards to explore
              </span>
            </div>
            <PolaroidLineCarousel />
          </Reveal>
        </div>
      </section>

      {/* Process / Pipeline (Scroll-Driven Plumbline Feature) */}
      <section className="mf-section mf-dark mf-pipeline-section" data-theme="dark">
        <div className="mf-wrap">
          <div className="mf-sec-head mf-pipeline-sec-head">
            <Reveal>
              <h2 className="mf-h1 mf-pipeline-h1">
                From GitHub URL<br />
                to interactive map<br />
                in three steps.
              </h2>
            </Reveal>
            <Reveal>
              <p className="mf-lead mf-pipeline-sublead">
                DevLens clones the repository into a temporary folder, parses its syntax trees with Tree-sitter, and links answers directly to source lines.
              </p>
            </Reveal>
          </div>

          <PlumblinePipeline />
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
