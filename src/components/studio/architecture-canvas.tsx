import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import type { GraphData, GraphNode } from "./studio-types";
import { CodeViewerDrawer } from "./code-viewer-drawer";

interface ArchitectureCanvasProps {
  graphData?: GraphData | null;
  sessionId?: string;
  activeFile?: string | null;
  onSelectNode: (nodeId: string, path: string) => void;
  onAskCopilotAboutFile: (path: string) => void;
}

export function ArchitectureCanvas({
  graphData,
  sessionId,
  activeFile,
  onSelectNode,
  onAskCopilotAboutFile,
}: ArchitectureCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [inspectingNode, setInspectingNode] = useState<GraphNode | null>(null);
  const [blastRadiusMode, setBlastRadiusMode] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "entry" | "complexity" | "coupling">("all");

  // Fallback default nodes if graphData is empty
  const nodes: GraphNode[] = useMemo(() => {
    if (graphData?.nodes && graphData.nodes.length > 0) {
      return graphData.nodes;
    }
    // High-fidelity fallback topology
    return [
      { id: "node-app", label: "App.tsx", path: "src/App.tsx", x: 260, y: 120, complexity: 12, coupling: 18, is_entry: true, line_count: 140, language: "TypeScript" },
      { id: "node-router", label: "Router.tsx", path: "src/router/Router.tsx", x: 420, y: 180, complexity: 24, coupling: 32, line_count: 280, language: "TypeScript" },
      { id: "node-auth", label: "AuthService.ts", path: "src/services/AuthService.ts", x: 220, y: 320, complexity: 18, coupling: 14, line_count: 195, language: "TypeScript" },
      { id: "node-api", label: "ApiClient.ts", path: "src/lib/ApiClient.ts", x: 580, y: 320, complexity: 15, coupling: 22, line_count: 160, language: "TypeScript" },
      { id: "node-state", label: "Store.ts", path: "src/store/Store.ts", x: 380, y: 440, complexity: 35, coupling: 42, line_count: 310, language: "TypeScript" },
      { id: "node-utils", label: "Formatters.ts", path: "src/utils/Formatters.ts", x: 740, y: 240, complexity: 6, coupling: 8, line_count: 85, language: "TypeScript" },
      { id: "node-db", label: "Database.ts", path: "src/db/Database.ts", x: 540, y: 520, complexity: 28, coupling: 26, line_count: 220, language: "TypeScript" },
    ];
  }, [graphData]);

  const edges: [string, string][] = useMemo(() => {
    if (graphData?.edges && graphData.edges.length > 0) {
      return graphData.edges;
    }
    return [
      ["node-app", "node-router"],
      ["node-router", "node-auth"],
      ["node-router", "node-api"],
      ["node-auth", "node-state"],
      ["node-api", "node-state"],
      ["node-api", "node-utils"],
      ["node-state", "node-db"],
    ];
  }, [graphData]);

  // Coordinate scaler: converts backend percentage coordinates (5-95%) into canvas pixel space
  const toPixelX = useCallback((x?: number) => {
    if (x === undefined) return 200;
    return x <= 100 ? (x / 100) * 1100 + 60 : x;
  }, []);

  const toPixelY = useCallback((y?: number) => {
    if (y === undefined) return 200;
    return y <= 100 ? (y / 100) * 750 + 60 : y;
  }, []);

  // Center canvas on a specific node
  const centerNode = useCallback((node: GraphNode) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const nx = toPixelX(node.x);
    const ny = toPixelY(node.y);
    const targetX = rect.width / 2 - nx * zoom;
    const targetY = rect.height / 2 - ny * zoom;
    setPan({ x: targetX, y: targetY });
  }, [zoom, toPixelX, toPixelY]);

  // Sync active file from explorer or copilot citation
  useEffect(() => {
    if (!activeFile) return;
    const cleanPath = activeFile.split(":")[0].trim();
    const matched = nodes.find(
      (n) =>
        n.path === cleanPath ||
        n.label === cleanPath ||
        cleanPath.endsWith("/" + n.label) ||
        (n.path && n.path.endsWith(cleanPath))
    );
    if (matched) {
      setSelectedNodeId(matched.id);
      centerNode(matched);
      setInspectingNode(matched);
    }
  }, [activeFile, nodes, centerNode]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  // Compute connected nodes for highlighted blast radius
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const set = new Set<string>([selectedNodeId]);
    edges.forEach(([u, v]) => {
      if (u === selectedNodeId) set.add(v);
      if (v === selectedNodeId) set.add(u);
    });
    return set;
  }, [selectedNodeId, edges]);

  // Compute incoming callers (fan-in) and outgoing dependencies (fan-out) for drawer
  const inspectingIncomingNodes = useMemo(() => {
    if (!inspectingNode) return [];
    const callerIds = edges.filter(([_, v]) => v === inspectingNode.id).map(([u]) => u);
    return nodes.filter((n) => callerIds.includes(n.id));
  }, [inspectingNode, edges, nodes]);

  const inspectingOutgoingNodes = useMemo(() => {
    if (!inspectingNode) return [];
    const calleeIds = edges.filter(([u]) => u === inspectingNode.id).map(([_, v]) => v);
    return nodes.filter((n) => calleeIds.includes(n.id));
  }, [inspectingNode, edges, nodes]);

  // Mouse pan handlers
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === "circle" || (e.target as HTMLElement).tagName.toLowerCase() === "text") {
      return;
    }
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };

  const onMouseUp = () => setIsDragging(false);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.min(Math.max(z * factor, 0.4), 2.5));
  };

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#08080a",
        overflow: "hidden",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
    >
      {/* Background Architectural Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          pointerEvents: "none",
          transform: `translate(${pan.x % 28}px, ${pan.y % 28}px)`,
        }}
      />

      {/* Top Left Canvas Filter HUD */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          display: "flex",
          gap: 6,
          background: "rgba(18, 18, 22, 0.85)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          borderRadius: 999,
          padding: "4px",
          zIndex: 20,
          fontFamily: "var(--mf-mono, monospace)",
          fontSize: "0.6875rem",
        }}
      >
        {[
          { id: "all", label: "All Nodes" },
          { id: "entry", label: "Entry Points" },
          { id: "complexity", label: "Complexity > 20" },
          { id: "coupling", label: "Hotspots (> 20)" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilterMode(f.id as any)}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "none",
              background: filterMode === f.id ? "#ffffff" : "transparent",
              color: filterMode === f.id ? "#000000" : "rgba(255,255,255,0.6)",
              fontWeight: filterMode === f.id ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* SVG Canvas for Edges & Nodes */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map(([u, v], i) => {
            const source = nodes.find((n) => n.id === u);
            const target = nodes.find((n) => n.id === v);
            if (!source || !target) return null;

            const isHighlighted =
              selectedNodeId && (u === selectedNodeId || v === selectedNodeId);
            const isDimmed = selectedNodeId && !isHighlighted;

            const sx = toPixelX(source.x);
            const sy = toPixelY(source.y);
            const tx = toPixelX(target.x);
            const ty = toPixelY(target.y);

            return (
              <line
                key={`edge-${i}`}
                x1={sx}
                y1={sy}
                x2={tx}
                y2={ty}
                stroke={isHighlighted ? "#ffffff" : isDimmed ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.22)"}
                strokeWidth={isHighlighted ? 2 : 1}
                strokeDasharray={isHighlighted ? undefined : "3 3"}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const matchesFilter =
              filterMode === "all" ||
              (filterMode === "entry" && node.is_entry) ||
              (filterMode === "complexity" && (node.complexity ?? 0) >= 20) ||
              (filterMode === "coupling" && (node.coupling ?? 0) >= 20);

            const isSelected = selectedNodeId === node.id;
            const isConnected = connectedNodeIds.has(node.id);
            const isDimmed = (selectedNodeId && !isSelected && !isConnected) || !matchesFilter;
            const isHovered = hoverNodeId === node.id;
            const nx = toPixelX(node.x);
            const ny = toPixelY(node.y);
            const radius = node.is_entry ? 14 : isSelected ? 12 : 9;

            return (
              <g
                key={node.id}
                transform={`translate(${nx}, ${ny})`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                  onSelectNode(node.id, node.path);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                  setInspectingNode(node);
                }}
                onMouseEnter={() => setHoverNodeId(node.id)}
                onMouseLeave={() => setHoverNodeId(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Concentric Animated Focus Ripple */}
                {isSelected && (
                  <circle
                    r={radius + 14}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity={0.8}
                  >
                    <animate
                      attributeName="r"
                      values={`${radius + 6};${radius + 20};${radius + 6}`}
                      dur="2.5s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.8;0.2;0.8"
                      dur="2.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Outer focus halo */}
                {(isSelected || isHovered) && (
                  <circle
                    r={radius + 8}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    opacity={0.7}
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r={radius}
                  fill={isSelected ? "#ffffff" : node.is_entry ? "#ffffff" : "#111114"}
                  stroke="#ffffff"
                  strokeWidth={node.is_entry || isSelected ? 2.5 : 1.5}
                  opacity={isDimmed ? 0.25 : 1}
                  style={{ transition: "all 0.15s" }}
                />

                {/* Node Label */}
                <text
                  x={radius + 8}
                  y={4}
                  fill={isSelected ? "#ffffff" : isDimmed ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.85)"}
                  fontSize="11"
                  fontFamily="var(--mf-mono, monospace)"
                  fontWeight={isSelected || node.is_entry ? 600 : 400}
                  letterSpacing="-0.01em"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Canvas Controls Toolbar */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          display: "flex",
          gap: 6,
          background: "rgba(18, 18, 22, 0.85)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          borderRadius: 999,
          padding: "4px 8px",
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
          style={{
            background: "transparent",
            border: "none",
            color: "#ffffff",
            padding: "4px 8px",
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
          style={{
            background: "transparent",
            border: "none",
            color: "#ffffff",
            padding: "4px 8px",
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
          title="Zoom Out"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetView}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255, 255, 255, 0.7)",
            padding: "4px 8px",
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
          title="Reset View"
        >
          Fit
        </button>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0 6px",
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            color: "rgba(255, 255, 255, 0.4)",
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Floating Node Inspector Card */}
      {selectedNode && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            width: 320,
            background: "#121215",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: 14,
            padding: "20px",
            boxShadow: "0 20px 48px rgba(0, 0, 0, 0.7)",
            zIndex: 30,
            color: "#ffffff",
            fontFamily: "var(--mf-font, 'Geist', sans-serif)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <span
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.625rem",
                  textTransform: "uppercase",
                  color: "rgba(255, 255, 255, 0.4)",
                  letterSpacing: "0.08em",
                }}
              >
                Node Inspector
              </span>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 500, margin: "4px 0", letterSpacing: "-0.02em" }}>
                {selectedNode.label}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255, 255, 255, 0.4)",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              color: "rgba(255, 255, 255, 0.6)",
              marginBottom: 16,
              wordBreak: "break-all",
            }}
          >
            {selectedNode.path}
          </div>

          {/* Metrics Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              background: "rgba(255, 255, 255, 0.04)",
              borderRadius: 8,
              padding: "12px",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.625rem", color: "rgba(255,255,255,0.4)" }}>
                Complexity
              </div>
              <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "1rem", fontWeight: 600 }}>
                {selectedNode.complexity ?? 14}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.625rem", color: "rgba(255,255,255,0.4)" }}>
                Coupling Score
              </div>
              <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "1rem", fontWeight: 600 }}>
                {selectedNode.coupling ?? 22}
              </div>
            </div>
          </div>

          {/* Blast Radius Warning */}
          <div
            style={{
              borderLeft: "2px solid #ffffff",
              paddingLeft: 10,
              marginBottom: 16,
              fontSize: "0.75rem",
              lineHeight: 1.45,
              color: "rgba(255, 255, 255, 0.75)",
            }}
          >
            Modifying this file impacts{" "}
            <strong style={{ color: "#ffffff" }}>
              {Math.max(connectedNodeIds.size - 1, 1)} dependent modules
            </strong>.
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              onClick={() => centerNode(selectedNode)}
              style={{
                width: "100%",
                padding: "7px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255, 255, 255, 0.16)",
                background: "rgba(255, 255, 255, 0.06)",
                color: "#ffffff",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              <span>⊙</span> Center Node in Viewport
            </button>

            <button
              type="button"
              onClick={() => setInspectingNode(selectedNode)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid #ffffff",
                background: "#ffffff",
                color: "#000000",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Inspect Source Code ↗
            </button>

            <button
              type="button"
              onClick={() => setBlastRadiusMode(true)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255, 255, 255, 0.2)",
                background: "rgba(255, 255, 255, 0.05)",
                color: "#ffffff",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Simulate Blast Radius 💥
            </button>

            <button
              type="button"
              onClick={() => onAskCopilotAboutFile(`Provide an architectural analysis of ${selectedNode.path}, including its core responsibility and dependents.`)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255, 255, 255, 0.12)",
                background: "transparent",
                color: "rgba(255, 255, 255, 0.7)",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                cursor: "pointer",
              }}
            >
              Ask Copilot about this file ↗
            </button>

            {/* Quick Agent Actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => onAskCopilotAboutFile(`Generate a comprehensive unit test suite with edge cases for ${selectedNode.path}`)}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background: "rgba(255, 255, 255, 0.03)",
                  color: "rgba(255, 255, 255, 0.8)",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.625rem",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                🧪 Generate Tests
              </button>
              <button
                type="button"
                onClick={() => onAskCopilotAboutFile(`Audit ${selectedNode.path} for security vulnerabilities, injection risks, and authorization bypasses`)}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background: "rgba(255, 255, 255, 0.03)",
                  color: "rgba(255, 255, 255, 0.8)",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.625rem",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                🛡️ Audit Security
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blast Radius Simulation HUD Banner */}
      {blastRadiusMode && selectedNode && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#111114",
            border: "1px solid #ffffff",
            boxShadow: "0 16px 40px rgba(0,0,0,0.8)",
            borderRadius: 999,
            padding: "8px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            zIndex: 40,
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffffff", animation: "mf-pulse 1s infinite" }} />
            <span>BLAST RADIUS ACTIVE //</span>
            <span style={{ color: "#ffffff", fontWeight: 600 }}>{selectedNode.label}</span>
          </div>

          <div style={{ color: "rgba(255,255,255,0.7)" }}>
            Impact: <strong style={{ color: "#ffffff" }}>{Math.max(connectedNodeIds.size - 1, 1)} direct dependents</strong>
          </div>

          <button
            type="button"
            onClick={() => onAskCopilotAboutFile(`Simulate refactoring ${selectedNode.path}. Provide a safe step-by-step decoupling plan to avoid breaking dependents.`)}
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              background: "#ffffff",
              color: "#000000",
              border: "none",
              fontFamily: "inherit",
              fontSize: "0.6875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Safe Refactor Plan ↗
          </button>

          <button
            type="button"
            onClick={() => setBlastRadiusMode(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
            title="Exit Simulation Mode"
          >
            ✕
          </button>
        </div>
      )}

      {/* Slide-over Code Viewer Drawer */}
      {inspectingNode && (
        <CodeViewerDrawer
          node={inspectingNode}
          sessionId={sessionId}
          incomingNodes={inspectingIncomingNodes}
          outgoingNodes={inspectingOutgoingNodes}
          onSelectNode={(nodeId, path) => {
            const next = nodes.find((n) => n.id === nodeId);
            if (next) {
              setSelectedNodeId(nodeId);
              setInspectingNode(next);
              centerNode(next);
              onSelectNode(nodeId, path);
            }
          }}
          onClose={() => setInspectingNode(null)}
          onSimulateBlastRadius={(nodeId) => {
            setSelectedNodeId(nodeId);
            setBlastRadiusMode(true);
            setInspectingNode(null);
          }}
          onAskCopilot={(prompt) => {
            onAskCopilotAboutFile(prompt);
          }}
        />
      )}
    </div>
  );
}
