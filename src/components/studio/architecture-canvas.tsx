import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import type { GraphData, GraphNode } from "./studio-types";
import { CodeViewerDrawer } from "./code-viewer-drawer";

interface ArchitectureCanvasProps {
  graphData?: GraphData | null;
  sessionId?: string;
  activeFile?: string | null;
  onSelectNode: (nodeId: string, path: string) => void;
  onAskCopilotAboutFile: (path: string) => void;
  theme?: "dark" | "light";
}

export function ArchitectureCanvas({
  graphData,
  sessionId,
  activeFile,
  onSelectNode,
  onAskCopilotAboutFile,
  theme = "dark",
}: ArchitectureCanvasProps) {
  const isLight = theme === "light";
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [inspectingNode, setInspectingNode] = useState<GraphNode | null>(null);
  const [blastRadiusMode, setBlastRadiusMode] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "entry" | "complexity" | "coupling">("all");
  const [layoutMode, setLayoutMode] = useState<"lanes" | "radial">("lanes");
  const [hideTests, setHideTests] = useState<boolean>(true);

  // Real graph only: an empty graph renders an explicit empty state (see below)
  const nodes: GraphNode[] = useMemo(() => graphData?.nodes ?? [], [graphData]);
  const edges: [string, string][] = useMemo(() => graphData?.edges ?? [], [graphData]);

  // Test file classifier (identifies test suites and test fixtures)
  const isTestFile = useCallback((node: GraphNode): boolean => {
    const p = (node.path || node.label || "").toLowerCase();
    return (
      p.includes(".test.") ||
      p.includes(".spec.") ||
      p.includes("/__tests__/") ||
      p.includes("__tests__") ||
      p.endsWith(".test") ||
      p.endsWith("-test") ||
      p.includes(".test-")
    );
  }, []);

  const testCount = useMemo(() => nodes.filter(isTestFile).length, [nodes, isTestFile]);

  // Filtered nodes respecting test suppression and category filter
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (hideTests && isTestFile(node)) return false;
      if (filterMode === "entry" && !node.is_entry) return false;
      if (filterMode === "complexity" && (node.complexity ?? 0) < 20) return false;
      if (filterMode === "coupling" && (node.coupling ?? 0) < 20) return false;
      return true;
    });
  }, [nodes, hideTests, isTestFile, filterMode]);

  const filteredNodeIdSet = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return edges.filter(([u, v]) => filteredNodeIdSet.has(u) && filteredNodeIdSet.has(v));
  }, [edges, filteredNodeIdSet]);

  // Coordinate scaler: converts backend percentage coordinates (5-95%) into canvas pixel space
  const toPixelX = useCallback((x?: number) => {
    if (x === undefined) return 200;
    return x <= 100 ? (x / 100) * 1100 + 60 : x;
  }, []);

  const toPixelY = useCallback((y?: number) => {
    if (y === undefined) return 200;
    return y <= 100 ? (y / 100) * 750 + 60 : y;
  }, []);

  // Lane definitions and classifier for Pipeline Architecture view
  type LaneId = "ingress" | "pages" | "components" | "services";

  const LANES = useMemo<
    Array<{ id: LaneId; number: string; label: string; x: number }>
  >(
    () => [
      { id: "ingress", number: "01", label: "EDGE INGRESS", x: 140 },
      { id: "pages", number: "02", label: "PAGES & ROUTES", x: 500 },
      { id: "components", number: "03", label: "UI COMPONENTS", x: 860 },
      { id: "services", number: "04", label: "SERVICES & DATA", x: 1220 },
    ],
    [],
  );

  const getLaneId = useCallback((node: GraphNode): LaneId => {
    const p = (node.path || node.label || "").toLowerCase();
    if (
      node.is_entry ||
      p.includes("server") ||
      p.includes("main.") ||
      p.includes("app.") ||
      p.includes("index.html") ||
      p.includes("cli.") ||
      p.includes("proxy") ||
      p.includes("ingress") ||
      p.startsWith("src/app.") ||
      p.startsWith("src/main.")
    ) {
      return "ingress";
    }
    if (
      p.includes("pages/") ||
      p.includes("routes/") ||
      p.includes("views/") ||
      p.includes("screens/") ||
      p.includes("page.") ||
      p.includes("page.tsx") ||
      p.includes("router")
    ) {
      return "pages";
    }
    if (
      p.includes("components/") ||
      p.includes("ui/") ||
      p.includes("widgets/") ||
      p.includes("layouts/") ||
      p.includes("section") ||
      p.includes("card") ||
      p.includes("modal") ||
      p.includes("navbar") ||
      p.includes("footer") ||
      p.includes("hero") ||
      p.includes("drawer")
    ) {
      return "components";
    }
    return "services";
  }, []);

  // Lane Layout calculation with clean vertical distribution (zero label collision)
  const { lanesPositions, laneBuckets, lanesHeight } = useMemo(() => {
    const posMap = new Map<string, { x: number; y: number }>();
    const buckets: Record<LaneId, GraphNode[]> = {
      ingress: [],
      pages: [],
      components: [],
      services: [],
    };

    filteredNodes.forEach((n) => {
      buckets[getLaneId(n)].push(n);
    });

    let maxLen = 0;
    LANES.forEach((lane) => {
      const bucket = buckets[lane.id];
      bucket.sort((a, b) => {
        if (a.is_entry && !b.is_entry) return -1;
        if (!a.is_entry && b.is_entry) return 1;
        return (b.coupling ?? 0) + (b.complexity ?? 0) - ((a.coupling ?? 0) + (a.complexity ?? 0));
      });
      if (bucket.length > maxLen) maxLen = bucket.length;

      bucket.forEach((node, idx) => {
        posMap.set(node.id, {
          x: lane.x + 36,
          y: 110 + idx * 52,
        });
      });
    });

    const totalHeight = Math.max(760, 150 + maxLen * 52);
    return { lanesPositions: posMap, laneBuckets: buckets, lanesHeight: totalHeight };
  }, [filteredNodes, getLaneId, LANES]);

  // Radial layout calculation with Verlet collision relaxation pass
  const radialPositions = useMemo(() => {
    const posMap = new Map<string, { x: number; y: number }>();
    filteredNodes.forEach((n) => {
      posMap.set(n.id, { x: toPixelX(n.x), y: toPixelY(n.y) });
    });

    const minDist = 62;
    const iterations = 35;
    const list = filteredNodes;

    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < list.length; i++) {
        const u = list[i];
        const p1 = posMap.get(u.id);
        if (!p1) continue;
        for (let j = i + 1; j < list.length; j++) {
          const v = list[j];
          const p2 = posMap.get(v.id);
          if (!p2) continue;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.hypot(dx, dy);
          if (dist < minDist) {
            const angle = dist > 0.001 ? Math.atan2(dy, dx) : i * 1.618;
            const overlap = (minDist - Math.max(dist, 0.001)) * 0.5;
            p1.x -= Math.cos(angle) * overlap;
            p1.y -= Math.sin(angle) * overlap;
            p2.x += Math.cos(angle) * overlap;
            p2.y += Math.sin(angle) * overlap;
          }
        }
      }
    }

    return posMap;
  }, [filteredNodes, toPixelX, toPixelY]);

  // Active positions depending on selected layout mode
  const nodePositions = useMemo(() => {
    return layoutMode === "lanes" ? lanesPositions : radialPositions;
  }, [layoutMode, lanesPositions, radialPositions]);

  // Radial centroid for outward label orientation
  const radialCenterX = useMemo(() => {
    if (filteredNodes.length === 0) return 600;
    let sum = 0;
    let count = 0;
    filteredNodes.forEach((n) => {
      const pos = radialPositions.get(n.id);
      if (pos) {
        sum += pos.x;
        count++;
      }
    });
    return count > 0 ? sum / count : 600;
  }, [filteredNodes, radialPositions]);

  // Center canvas on a specific node
  const centerNode = useCallback(
    (node: GraphNode) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const pos = nodePositions.get(node.id) || { x: toPixelX(node.x), y: toPixelY(node.y) };
      const targetX = rect.width / 2 - pos.x * zoom;
      const targetY = rect.height / 2 - pos.y * zoom;
      setPan({ x: targetX, y: targetY });
    },
    [zoom, nodePositions, toPixelX, toPixelY],
  );

  // Sync active file from explorer or copilot citation
  useEffect(() => {
    if (!activeFile) return;
    const cleanPath = activeFile.split(":")[0].trim();
    const matched = nodes.find(
      (n) =>
        n.path === cleanPath ||
        n.label === cleanPath ||
        cleanPath.endsWith("/" + n.label) ||
        (n.path && n.path.endsWith(cleanPath)),
    );
    if (matched) {
      setSelectedNodeId(matched.id);
      centerNode(matched);
    }
  }, [activeFile, nodes, centerNode]);

  // Global keyboard shortcuts (Escape to close inspector/drawer, I to toggle inspector)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") {
        if (inspectingNode) {
          setInspectingNode(null);
        } else if (isInspectorOpen) {
          setIsInspectorOpen(false);
        } else if (selectedNodeId) {
          setSelectedNodeId(null);
        }
      } else if (e.key === "i" || e.key === "I") {
        if (selectedNodeId) {
          setIsInspectorOpen((v) => !v);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inspectingNode, isInspectorOpen, selectedNodeId]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  // Transitive blast radius analysis
  const blastRadiusData = useMemo(() => {
    if (!selectedNodeId) {
      return {
        epicenterId: null,
        directCallers: new Set<string>(),
        transitiveCallers: new Set<string>(),
        directCallees: new Set<string>(),
        impactedNodeIds: new Set<string>(),
        blastEdges: new Set<string>(),
      };
    }

    const directCallers = new Set<string>();
    const transitiveCallers = new Set<string>();
    const directCallees = new Set<string>();
    const blastEdges = new Set<string>();

    const reverseMap = new Map<string, string[]>();
    const forwardMap = new Map<string, string[]>();

    edges.forEach(([u, v]) => {
      if (!reverseMap.has(v)) reverseMap.set(v, []);
      reverseMap.get(v)!.push(u);

      if (!forwardMap.has(u)) forwardMap.set(u, []);
      forwardMap.get(u)!.push(v);
    });

    // 1. Direct callers (Tier 1)
    const tier1 = reverseMap.get(selectedNodeId) || [];
    tier1.forEach((caller) => {
      directCallers.add(caller);
      blastEdges.add(`${caller}->${selectedNodeId}`);
      blastEdges.add(`${selectedNodeId}->${caller}`);
    });

    // 2. Transitive callers (Tier 2+) using BFS up the dependency tree
    const queue = [...tier1];
    const visited = new Set<string>([selectedNodeId, ...tier1]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const parents = reverseMap.get(current) || [];
      parents.forEach((parent) => {
        blastEdges.add(`${parent}->${current}`);
        blastEdges.add(`${current}->${parent}`);
        if (!visited.has(parent)) {
          visited.add(parent);
          transitiveCallers.add(parent);
          queue.push(parent);
        }
      });
    }

    // 3. Direct callees (outgoing dependencies)
    const callees = forwardMap.get(selectedNodeId) || [];
    callees.forEach((callee) => {
      directCallees.add(callee);
      blastEdges.add(`${selectedNodeId}->${callee}`);
      blastEdges.add(`${callee}->${selectedNodeId}`);
    });

    const impactedNodeIds = new Set<string>([
      selectedNodeId,
      ...directCallers,
      ...transitiveCallers,
      ...directCallees,
    ]);

    return {
      epicenterId: selectedNodeId,
      directCallers,
      transitiveCallers,
      directCallees,
      impactedNodeIds,
      blastEdges,
    };
  }, [selectedNodeId, edges]);

  // Keep connectedNodeIds for inspector compatibility
  const connectedNodeIds = useMemo(() => {
    return blastRadiusData.impactedNodeIds;
  }, [blastRadiusData]);

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
    if (
      (e.target as HTMLElement).tagName.toLowerCase() === "circle" ||
      (e.target as HTMLElement).tagName.toLowerCase() === "text"
    ) {
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

  // Touch pan & pinch zoom tracking
  const touchStartRef = useRef<{ dist: number; panX: number; panY: number; midX: number; midY: number } | null>(null);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        touchStartRef.current = { dist, panX: pan.x, panY: pan.y, midX, midY };
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        dragStart.current = { x: t.clientX - pan.x, y: t.clientY - pan.y };
        setIsDragging(true);
      }
    },
    [pan],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && touchStartRef.current) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const newMidX = (t1.clientX + t2.clientX) / 2;
        const newMidY = (t1.clientY + t2.clientY) / 2;

        const scale = newDist / touchStartRef.current.dist;
        setZoom((z) => Math.min(2.5, Math.max(0.4, +(z * (1 + (scale - 1) * 0.5)).toFixed(3))));

        const dx = newMidX - touchStartRef.current.midX;
        const dy = newMidY - touchStartRef.current.midY;
        setPan({
          x: +(touchStartRef.current.panX + dx).toFixed(2),
          y: +(touchStartRef.current.panY + dy).toFixed(2),
        });
      } else if (e.touches.length === 1 && isDragging) {
        const t = e.touches[0];
        setPan({
          x: +(t.clientX - dragStart.current.x).toFixed(2),
          y: +(t.clientY - dragStart.current.y).toFixed(2),
        });
      }
    },
    [isDragging],
  );

  const onTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    setIsDragging(false);
  }, []);

  // Hardware-accelerated 60fps 2-finger trackpad scroll & cursor-centered pinch zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number | null = null;
    let pendingDx = 0;
    let pendingDy = 0;
    let pendingZoomFactor = 1;
    let zoomOrigin = { x: 0, y: 0 };
    let hasZoom = false;

    const flushUpdates = () => {
      if (hasZoom) {
        setZoom((currZoom) => {
          const newZoom = Math.min(2.5, Math.max(0.4, +(currZoom * pendingZoomFactor).toFixed(3)));
          const scaleChange = newZoom / currZoom;
          setPan((currPan) => ({
            x: +(zoomOrigin.x - (zoomOrigin.x - currPan.x) * scaleChange).toFixed(2),
            y: +(zoomOrigin.y - (zoomOrigin.y - currPan.y) * scaleChange).toFixed(2),
          }));
          return newZoom;
        });
        hasZoom = false;
        pendingZoomFactor = 1;
      }
      if (pendingDx !== 0 || pendingDy !== 0) {
        setPan((currPan) => ({
          x: +(currPan.x - pendingDx).toFixed(2),
          y: +(currPan.y - pendingDy).toFixed(2),
        }));
        pendingDx = 0;
        pendingDy = 0;
      }
      rafId = null;
    };

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom on trackpad (or Ctrl + mouse wheel)
        const factor = Math.exp(-e.deltaY * 0.008);
        hasZoom = true;
        pendingZoomFactor *= factor;
        zoomOrigin = { x: cursorX, y: cursorY };
      } else {
        // Smooth 2-finger scroll on trackpad or mouse wheel pan
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        pendingDx += dx;
        pendingDy += dy;
      }

      if (!rafId) {
        rafId = requestAnimationFrame(flushUpdates);
      }
    };

    el.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleNativeWheel);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const resetView = useCallback(() => {
    if (layoutMode === "lanes") {
      setZoom(0.85);
      setPan({ x: 40, y: 20 });
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [layoutMode]);

  const hoverNode = useMemo(
    () => (hoverNodeId ? filteredNodes.find((n) => n.id === hoverNodeId) ?? null : null),
    [filteredNodes, hoverNodeId],
  );

  if (nodes.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: isLight ? "#f8f8fa" : "#08080a",
          display: "grid",
          placeItems: "center",
          color: isLight ? "rgba(9, 9, 11, 0.6)" : "rgba(255, 255, 255, 0.6)",
          fontFamily: "var(--mf-mono, monospace)",
          fontSize: "0.8125rem",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div
            style={{
              color: isLight ? "#09090b" : "#ffffff",
              fontWeight: 600,
              marginBottom: 8,
              fontSize: "0.9375rem",
            }}
          >
            No Architecture Graph Available
          </div>
          <p
            style={{
              margin: 0,
              lineHeight: 1.5,
              color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.45)",
            }}
          >
            No indexed source files or dependencies were detected for this repository. Ingestion may
            still be in progress or the repository contains only non-code assets.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: isLight ? "#f8f8fa" : "#08080a",
        overflow: "hidden",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        touchAction: "none",
        transition: "background-color 0.2s ease",
      }}
    >
      {/* Background Architectural Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: isLight
            ? "radial-gradient(rgba(0, 0, 0, 0.12) 1px, transparent 1px)"
            : "radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          pointerEvents: "none",
          transform: `translate(${pan.x % 28}px, ${pan.y % 28}px)`,
        }}
      />

      {/* Top Left Canvas Filter & Mode HUD */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: isLight ? "rgba(255, 255, 255, 0.95)" : "rgba(18, 18, 22, 0.85)",
          backdropFilter: "blur(12px)",
          border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.14)"}`,
          borderRadius: 999,
          padding: "4px",
          zIndex: 20,
          fontFamily: "var(--mf-mono, monospace)",
          fontSize: "0.6875rem",
          boxShadow: isLight ? "0 2px 10px rgba(0, 0, 0, 0.06)" : "0 4px 16px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Layout Mode Switcher */}
        <div style={{ display: "flex", gap: 2 }}>
          <button
            type="button"
            onClick={() => setLayoutMode("lanes")}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "none",
              background: layoutMode === "lanes" ? (isLight ? "#09090b" : "#ffffff") : "transparent",
              color: layoutMode === "lanes"
                ? isLight
                  ? "#ffffff"
                  : "#000000"
                : isLight
                ? "rgba(9, 9, 11, 0.7)"
                : "rgba(255, 255, 255, 0.6)",
              fontWeight: layoutMode === "lanes" ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
            title="Lanes View: Structured architecture flow with zero text collisions"
          >
            <span>☷</span> Lanes
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode("radial")}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "none",
              background: layoutMode === "radial" ? (isLight ? "#09090b" : "#ffffff") : "transparent",
              color: layoutMode === "radial"
                ? isLight
                  ? "#ffffff"
                  : "#000000"
                : isLight
                ? "rgba(9, 9, 11, 0.7)"
                : "rgba(255, 255, 255, 0.6)",
              fontWeight: layoutMode === "radial" ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
            title="Radial View: Concentric force relaxation layout"
          >
            <span>◉</span> Radial
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 16,
            background: isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.14)",
            margin: "0 2px",
          }}
        />

        {/* Filter Mode Pills */}
        {[
          { id: "all", label: "All Nodes" },
          { id: "entry", label: "Entry Points" },
          { id: "complexity", label: "Complexity > 20" },
          { id: "coupling", label: "Hotspots (> 20)" },
        ].map((f) => {
          const isActive = filterMode === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterMode(f.id as any)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "none",
                background: isActive ? (isLight ? "#09090b" : "#ffffff") : "transparent",
                color: isActive
                  ? isLight
                    ? "#ffffff"
                    : "#000000"
                  : isLight
                  ? "rgba(9, 9, 11, 0.7)"
                  : "rgba(255, 255, 255, 0.6)",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {f.label}
            </button>
          );
        })}

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 16,
            background: isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.14)",
            margin: "0 2px",
          }}
        />

        {/* Hide Tests Toggle Pill */}
        <button
          type="button"
          onClick={() => setHideTests((prev) => !prev)}
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: `1px solid ${
              hideTests
                ? isLight
                  ? "rgba(0, 0, 0, 0.2)"
                  : "rgba(255, 255, 255, 0.25)"
                : "transparent"
            }`,
            background: hideTests
              ? isLight
                ? "rgba(0, 0, 0, 0.06)"
                : "rgba(255, 255, 255, 0.08)"
              : "transparent",
            color: hideTests
              ? isLight
                ? "#09090b"
                : "#ffffff"
              : isLight
              ? "rgba(9, 9, 11, 0.5)"
              : "rgba(255, 255, 255, 0.45)",
            fontWeight: hideTests ? 600 : 400,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            transition: "all 0.15s",
          }}
          title={hideTests ? "Test suites hidden. Click to show." : "Click to suppress test files."}
        >
          <span>{hideTests ? "⊘" : "○"}</span>
          <span>{hideTests ? `Hide Tests (${testCount})` : "Show Tests"}</span>
        </button>
      </div>

      {/* SVG Canvas for Lanes, Edges & Nodes */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Lane Column Backdrop Cards (Lanes View only) */}
          {layoutMode === "lanes" && (
            <g className="lane-headers" pointerEvents="none">
              {LANES.map((lane) => {
                const bucket = laneBuckets[lane.id];
                return (
                  <g key={lane.id}>
                    <rect
                      x={lane.x - 16}
                      y={48}
                      width={310}
                      height={lanesHeight}
                      rx={12}
                      fill={isLight ? "rgba(0, 0, 0, 0.015)" : "rgba(255, 255, 255, 0.012)"}
                      stroke={isLight ? "rgba(0, 0, 0, 0.07)" : "rgba(255, 255, 255, 0.07)"}
                      strokeDasharray="4 4"
                    />
                    <text
                      x={lane.x}
                      y={80}
                      fill={isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.45)"}
                      fontSize="9.5"
                      fontFamily="var(--mf-mono, monospace)"
                      letterSpacing="0.08em"
                      fontWeight={600}
                    >
                      {lane.number} / {lane.label}
                    </text>
                    <text
                      x={lane.x + 280}
                      y={80}
                      textAnchor="end"
                      fill={isLight ? "rgba(9, 9, 11, 0.35)" : "rgba(255, 255, 255, 0.3)"}
                      fontSize="9"
                      fontFamily="var(--mf-mono, monospace)"
                      fontWeight={500}
                    >
                      {bucket.length}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Edges */}
          {filteredEdges.map(([u, v], i) => {
            const sourcePos = nodePositions.get(u);
            const targetPos = nodePositions.get(v);
            if (!sourcePos || !targetPos) return null;

            const isBlastEdge =
              blastRadiusMode &&
              (blastRadiusData.blastEdges.has(`${u}->${v}`) ||
                blastRadiusData.blastEdges.has(`${v}->${u}`));
            const isHighlighted =
              isBlastEdge ||
              (selectedNodeId && (u === selectedNodeId || v === selectedNodeId));
            const isDimmed = blastRadiusMode ? !isBlastEdge : selectedNodeId && !isHighlighted;

            const sx = sourcePos.x;
            const sy = sourcePos.y;
            const tx = targetPos.x;
            const ty = targetPos.y;

            if (layoutMode === "lanes") {
              const dx = tx - sx;
              const p1x = sx + dx * 0.45;
              const p2x = tx - dx * 0.45;
              const pathD = `M ${sx} ${sy} C ${p1x} ${sy}, ${p2x} ${ty}, ${tx} ${ty}`;

              return (
                <path
                  key={`edge-${i}`}
                  d={pathD}
                  fill="none"
                  stroke={
                    isBlastEdge
                      ? "#ef4444"
                      : isHighlighted
                      ? isLight
                        ? "#09090b"
                        : "#ffffff"
                      : isDimmed
                      ? isLight
                        ? "rgba(0, 0, 0, 0.03)"
                        : "rgba(255, 255, 255, 0.03)"
                      : isLight
                      ? "rgba(0, 0, 0, 0.16)"
                      : "rgba(255, 255, 255, 0.18)"
                  }
                  strokeWidth={isBlastEdge ? 2.5 : isHighlighted ? 2 : 1}
                  strokeDasharray={isBlastEdge || isHighlighted ? undefined : "3 3"}
                />
              );
            }

            return (
              <line
                key={`edge-${i}`}
                x1={sx}
                y1={sy}
                x2={tx}
                y2={ty}
                stroke={
                  isBlastEdge
                    ? "#ef4444"
                    : isHighlighted
                    ? isLight
                      ? "#09090b"
                      : "#ffffff"
                    : isDimmed
                    ? isLight
                      ? "rgba(0, 0, 0, 0.03)"
                      : "rgba(255, 255, 255, 0.03)"
                    : isLight
                    ? "rgba(0, 0, 0, 0.18)"
                    : "rgba(255, 255, 255, 0.2)"
                }
                strokeWidth={isBlastEdge ? 2.5 : isHighlighted ? 2 : 1}
                strokeDasharray={isBlastEdge || isHighlighted ? undefined : "3 3"}
              />
            );
          })}

          {/* Nodes */}
          {filteredNodes.map((node) => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;

            const isSelected = selectedNodeId === node.id;
            const isEpicenter = blastRadiusMode && selectedNodeId === node.id;
            const isDirectCaller = blastRadiusMode && blastRadiusData.directCallers.has(node.id);
            const isTransitiveCaller =
              blastRadiusMode && blastRadiusData.transitiveCallers.has(node.id);
            const isDirectCallee = blastRadiusMode && blastRadiusData.directCallees.has(node.id);
            const isBlastImpacted =
              isEpicenter || isDirectCaller || isTransitiveCaller || isDirectCallee;

            const isConnected = connectedNodeIds.has(node.id);
            const isDimmed = blastRadiusMode
              ? !isBlastImpacted
              : selectedNodeId && !isSelected && !isConnected;
            const isHovered = hoverNodeId === node.id;
            const radius = node.is_entry ? 14 : isSelected || isEpicenter ? 13 : 9;

            const isLeftSide = pos.x < radialCenterX;
            const labelAnchor = layoutMode === "lanes" ? "start" : isLeftSide ? "end" : "start";
            const labelX =
              layoutMode === "lanes" ? radius + 10 : isLeftSide ? -radius - 8 : radius + 8;

            const shouldShowLabel =
              layoutMode === "lanes" ||
              zoom >= 1.15 ||
              isSelected ||
              isEpicenter ||
              isDirectCaller ||
              isHovered ||
              isConnected ||
              node.is_entry ||
              (node.coupling ?? 0) >= 15 ||
              (node.complexity ?? 0) >= 15;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
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
                {/* Blast Radius Epicenter Pulsing Ring */}
                {isEpicenter && (
                  <>
                    <circle
                      r={radius + 14}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      opacity={0.9}
                    />
                    <circle
                      r={radius + 7}
                      fill="rgba(239, 68, 68, 0.18)"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                    />
                  </>
                )}

                {/* Direct Caller Halo */}
                {isDirectCaller && (
                  <circle
                    r={radius + 6}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity={0.85}
                  />
                )}

                {/* Transitive Caller Halo */}
                {isTransitiveCaller && (
                  <circle
                    r={radius + 5}
                    fill="none"
                    stroke="#eab308"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    opacity={0.7}
                  />
                )}

                {/* Focus Indicator (Standard Selection) */}
                {isSelected && !isEpicenter && (
                  <circle
                    r={radius + 8}
                    fill="none"
                    stroke={isLight ? "#09090b" : "#ffffff"}
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                    opacity={0.85}
                  />
                )}

                {/* Outer focus halo */}
                {(isSelected || isHovered) && !isEpicenter && (
                  <circle
                    r={radius + 8}
                    fill="none"
                    stroke={isLight ? "#09090b" : "#ffffff"}
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    opacity={0.7}
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r={radius}
                  fill={
                    isEpicenter
                      ? "#ef4444"
                      : isDirectCaller
                      ? isLight
                        ? "#ffffff"
                        : "#1c1917"
                      : isTransitiveCaller
                      ? isLight
                        ? "#ffffff"
                        : "#1c1917"
                      : isDirectCallee
                      ? isLight
                        ? "#ffffff"
                        : "#082f49"
                      : isSelected
                      ? isLight
                        ? "#09090b"
                        : "#ffffff"
                      : node.is_entry
                      ? isLight
                        ? "#09090b"
                        : "#ffffff"
                      : isLight
                      ? "#ffffff"
                      : "#111114"
                  }
                  stroke={
                    isEpicenter
                      ? "#ffffff"
                      : isDirectCaller
                      ? "#f97316"
                      : isTransitiveCaller
                      ? "#eab308"
                      : isDirectCallee
                      ? "#38bdf8"
                      : isLight
                      ? "#09090b"
                      : "#ffffff"
                  }
                  strokeWidth={
                    isEpicenter || isDirectCaller
                      ? 2.5
                      : isTransitiveCaller
                      ? 2
                      : node.is_entry || isSelected
                      ? 2.5
                      : 1.5
                  }
                  opacity={isDimmed ? 0.12 : 1}
                  style={{ transition: "all 0.15s" }}
                />

                {/* Node Label with Anti-Collision Stroke Halo */}
                {shouldShowLabel && (
                  <text
                    x={labelX}
                    y={4}
                    textAnchor={labelAnchor}
                    fill={
                      isEpicenter
                        ? "#ef4444"
                        : isDirectCaller
                        ? isLight
                          ? "#c2410c"
                          : "#fb923c"
                        : isTransitiveCaller
                        ? isLight
                          ? "#a16207"
                          : "#facc15"
                        : isDirectCallee
                        ? isLight
                          ? "#0284c7"
                          : "#38bdf8"
                        : isSelected
                        ? isLight
                          ? "#09090b"
                          : "#ffffff"
                        : isDimmed
                        ? isLight
                          ? "rgba(9, 9, 11, 0.2)"
                          : "rgba(255, 255, 255, 0.25)"
                        : isLight
                        ? "#09090b"
                        : "rgba(255, 255, 255, 0.9)"
                    }
                    fontSize="11"
                    fontFamily="var(--mf-mono, monospace)"
                    fontWeight={isEpicenter || isDirectCaller || isSelected || node.is_entry ? 600 : 400}
                    letterSpacing="-0.01em"
                    style={{
                      paintOrder: "stroke fill",
                      stroke: isLight ? "#f8f8fa" : "#08080a",
                      strokeWidth: "3.5px",
                      strokeLinejoin: "round",
                      pointerEvents: "none",
                    }}
                  >
                    {node.label}
                    {isEpicenter && " [EPICENTER]"}
                    {isDirectCaller && " (Tier 1)"}
                    {isTransitiveCaller && " (Tier 2)"}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Interactive Node Hover Tooltip (zero-click context) */}
      {hoverNode && !isInspectorOpen && (() => {
        const hPos = nodePositions.get(hoverNode.id);
        if (!hPos) return null;
        const screenX = hPos.x * zoom + pan.x;
        const screenY = hPos.y * zoom + pan.y;
        return (
          <div
            style={{
              position: "absolute",
              left: Math.max(16, Math.min(screenX + 16, (containerRef.current?.clientWidth ?? 900) - 260)),
              top: Math.max(16, screenY - 45),
              pointerEvents: "none",
              background: isLight ? "rgba(255, 255, 255, 0.97)" : "rgba(18, 18, 22, 0.95)",
              backdropFilter: "blur(14px)",
              border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.14)" : "rgba(255, 255, 255, 0.18)"}`,
              borderRadius: 8,
              padding: "8px 12px",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              zIndex: 25,
              boxShadow: isLight ? "0 6px 20px rgba(0, 0, 0, 0.08)" : "0 8px 24px rgba(0, 0, 0, 0.6)",
              color: isLight ? "#09090b" : "#ffffff",
              maxWidth: 250,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: "0.75rem", marginBottom: 2 }}>{hoverNode.label}</div>
            <div
              style={{
                color: isLight ? "rgba(9, 9, 11, 0.55)" : "rgba(255, 255, 255, 0.55)",
                fontSize: "0.625rem",
                wordBreak: "break-all",
                marginBottom: 6,
              }}
            >
              {hoverNode.path}
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                fontSize: "0.625rem",
                borderTop: `1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)"}`,
                paddingTop: 5,
              }}
            >
              <span>Complexity: <strong>{hoverNode.complexity ?? 1}</strong></span>
              <span>Coupling: <strong>{hoverNode.coupling ?? 0}</strong></span>
            </div>
          </div>
        );
      })()}

      {/* Floating Canvas Controls Toolbar */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          display: "flex",
          gap: 6,
          background: isLight ? "rgba(255, 255, 255, 0.95)" : "rgba(18, 18, 22, 0.85)",
          backdropFilter: "blur(12px)",
          border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.14)"}`,
          borderRadius: 999,
          padding: "4px 8px",
          zIndex: 20,
          boxShadow: isLight ? "0 2px 10px rgba(0, 0, 0, 0.06)" : "0 4px 16px rgba(0, 0, 0, 0.4)",
        }}
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(+(z + 0.15).toFixed(2), 2.5))}
          style={{
            background: "transparent",
            border: "none",
            color: isLight ? "#09090b" : "#ffffff",
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
          onClick={() => setZoom((z) => Math.max(+(z - 0.15).toFixed(2), 0.4))}
          style={{
            background: "transparent",
            border: "none",
            color: isLight ? "#09090b" : "#ffffff",
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
            color: isLight ? "rgba(9, 9, 11, 0.7)" : "rgba(255, 255, 255, 0.7)",
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
            color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.4)",
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Canvas Interaction Guide */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        <span
          className="mf-mono"
          style={{
            fontSize: "0.625rem",
            color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.4)",
            letterSpacing: "0.03em",
          }}
        >
          2-Finger scroll to pan · Pinch to zoom
        </span>
      </div>

      {/* Sleek Non-intrusive Selected Node Pill */}
      {selectedNode && !isInspectorOpen && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: isLight ? "rgba(255, 255, 255, 0.96)" : "rgba(18, 18, 22, 0.9)",
            backdropFilter: "blur(12px)",
            border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.14)" : "rgba(255, 255, 255, 0.18)"}`,
            borderRadius: 999,
            padding: "4px 6px 4px 12px",
            boxShadow: isLight
              ? "0 4px 20px rgba(0, 0, 0, 0.08)"
              : "0 8px 24px rgba(0, 0, 0, 0.5)",
            zIndex: 30,
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            color: isLight ? "#09090b" : "#ffffff",
          }}
        >
          <span style={{ color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.45)" }}>
            NODE:
          </span>
          <span
            style={{
              fontWeight: 600,
              maxWidth: 180,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selectedNode.label}
          </span>
          <button
            type="button"
            onClick={() => setIsInspectorOpen(true)}
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              border: `1px solid ${isLight ? "#09090b" : "#ffffff"}`,
              background: isLight ? "#09090b" : "#ffffff",
              color: isLight ? "#ffffff" : "#09090b",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              transition: "all 0.15s",
            }}
            title="Open Inspector Panel (or press I)"
          >
            Inspect ↗
          </button>
          <button
            type="button"
            onClick={() => setSelectedNodeId(null)}
            style={{
              background: "transparent",
              border: "none",
              color: isLight ? "rgba(9, 9, 11, 0.4)" : "rgba(255, 255, 255, 0.4)",
              cursor: "pointer",
              padding: "2px 6px",
              fontSize: "0.8125rem",
            }}
            title="Deselect node"
          >
            ✕
          </button>
        </div>
      )}

      {/* Floating Node Inspector Card (only open when user explicitly requests) */}
      {selectedNode && isInspectorOpen && (
        <div
          className="devlens-scroll"
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            width: 320,
            maxHeight: "calc(100% - 40px)",
            overflowY: "auto",
            background: isLight ? "#ffffff" : "#121215",
            border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.16)"}`,
            borderRadius: 14,
            padding: "20px",
            boxShadow: isLight
              ? "0 20px 48px rgba(0, 0, 0, 0.12)"
              : "0 20px 48px rgba(0, 0, 0, 0.7)",
            zIndex: 30,
            color: isLight ? "#09090b" : "#ffffff",
            fontFamily: "var(--mf-font, 'Geist', sans-serif)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 12,
            }}
          >
            <div>
              <span
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.625rem",
                  textTransform: "uppercase",
                  color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.4)",
                  letterSpacing: "0.08em",
                }}
              >
                Node Inspector
              </span>
              <h3
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 500,
                  margin: "4px 0",
                  letterSpacing: "-0.02em",
                  color: isLight ? "#09090b" : "#ffffff",
                }}
              >
                {selectedNode.label}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsInspectorOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: isLight ? "rgba(9, 9, 11, 0.45)" : "rgba(255, 255, 255, 0.4)",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
              title="Close Inspector (Esc)"
            >
              ✕
            </button>
          </div>

          <div
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              color: isLight ? "rgba(9, 9, 11, 0.6)" : "rgba(255, 255, 255, 0.6)",
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
              background: isLight ? "#f4f4f7" : "rgba(255, 255, 255, 0.04)",
              borderRadius: 8,
              padding: "12px",
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.625rem",
                  color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.4)",
                }}
              >
                Complexity
              </div>
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: isLight ? "#09090b" : "#ffffff",
                }}
              >
                {selectedNode.complexity ?? 14}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.625rem",
                  color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.4)",
                }}
              >
                Coupling Score
              </div>
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: isLight ? "#09090b" : "#ffffff",
                }}
              >
                {selectedNode.coupling ?? 22}
              </div>
            </div>
          </div>

          {/* Blast Radius Warning */}
          <div
            style={{
              borderLeft: isLight ? "2px solid #09090b" : "2px solid #ffffff",
              paddingLeft: 10,
              marginBottom: 16,
              fontSize: "0.75rem",
              lineHeight: 1.45,
              color: isLight ? "rgba(9, 9, 11, 0.75)" : "rgba(255, 255, 255, 0.75)",
            }}
          >
            Modifying this file impacts{" "}
            <strong style={{ color: isLight ? "#09090b" : "#ffffff" }}>
              {Math.max(connectedNodeIds.size - 1, 1)} dependent modules
            </strong>
            .
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
                border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.14)" : "rgba(255, 255, 255, 0.16)"}`,
                background: isLight ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.06)",
                color: isLight ? "#09090b" : "#ffffff",
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
                border: `1px solid ${isLight ? "#09090b" : "#ffffff"}`,
                background: isLight ? "#09090b" : "#ffffff",
                color: isLight ? "#ffffff" : "#000000",
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
              onClick={() => {
                setBlastRadiusMode(true);
                if (selectedNode) centerNode(selectedNode);
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 999,
                border: `1px solid ${isLight ? "rgba(239, 68, 68, 0.4)" : "rgba(239, 68, 68, 0.5)"}`,
                background: isLight ? "rgba(239, 68, 68, 0.08)" : "rgba(239, 68, 68, 0.12)",
                color: isLight ? "#dc2626" : "#fca5a5",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Simulate Blast Radius 💥
            </button>

            <button
              type="button"
              onClick={() =>
                onAskCopilotAboutFile(
                  `Provide an architectural analysis of ${selectedNode.path}, including its core responsibility and dependents.`,
                )
              }
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 999,
                border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)"}`,
                background: "transparent",
                color: isLight ? "rgba(9, 9, 11, 0.7)" : "rgba(255, 255, 255, 0.7)",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                cursor: "pointer",
              }}
            >
              Query file references ↗
            </button>

            {/* Quick Agent Actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 }}>
              <button
                type="button"
                onClick={() =>
                  onAskCopilotAboutFile(
                    `Generate a comprehensive unit test suite with edge cases for ${selectedNode.path}`,
                  )
                }
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.12)"}`,
                  background: isLight ? "rgba(0, 0, 0, 0.03)" : "rgba(255, 255, 255, 0.03)",
                  color: isLight ? "rgba(9, 9, 11, 0.8)" : "rgba(255, 255, 255, 0.8)",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.625rem",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                Generate Tests
              </button>
              <button
                type="button"
                onClick={() =>
                  onAskCopilotAboutFile(
                    `Audit ${selectedNode.path} for security vulnerabilities, injection risks, and authorization bypasses`,
                  )
                }
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.12)"}`,
                  background: isLight ? "rgba(0, 0, 0, 0.03)" : "rgba(255, 255, 255, 0.03)",
                  color: isLight ? "rgba(9, 9, 11, 0.8)" : "rgba(255, 255, 255, 0.8)",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.625rem",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                Security Audit
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
            background: isLight ? "rgba(255, 255, 255, 0.98)" : "#111114",
            border: `1px solid ${isLight ? "rgba(239, 68, 68, 0.6)" : "#ef4444"}`,
            boxShadow: isLight
              ? "0 16px 40px rgba(239, 68, 68, 0.15), 0 4px 16px rgba(0, 0, 0, 0.08)"
              : "0 16px 40px rgba(0,0,0,0.85), 0 0 24px rgba(239, 68, 68, 0.3)",
            borderRadius: 999,
            padding: "8px 22px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            zIndex: 40,
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.75rem",
            color: isLight ? "#09090b" : "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#ef4444",
                boxShadow: "0 0 10px #ef4444",
              }}
            />
            <span style={{ fontWeight: 600 }}>BLAST RADIUS ACTIVE ·</span>
            <span style={{ color: "#ef4444", fontWeight: 700 }}>
              {selectedNode.label}
            </span>
          </div>

          <div style={{ color: isLight ? "rgba(9, 9, 11, 0.75)" : "rgba(255,255,255,0.75)" }}>
            Impact:{" "}
            <strong style={{ color: "#ef4444" }}>
              {blastRadiusData.directCallers.size} direct
            </strong>
            {blastRadiusData.transitiveCallers.size > 0 && (
              <>
                ,{" "}
                <strong style={{ color: isLight ? "#a16207" : "#facc15" }}>
                  {blastRadiusData.transitiveCallers.size} cascading
                </strong>
              </>
            )}{" "}
            dependents ({Math.max(blastRadiusData.impactedNodeIds.size - 1, 0)} total)
          </div>

          <button
            type="button"
            onClick={() =>
              onAskCopilotAboutFile(
                `Simulate refactoring ${selectedNode.path}. It directly affects ${blastRadiusData.directCallers.size} caller(s) and has ${blastRadiusData.transitiveCallers.size} cascading dependent(s). Provide a safe step-by-step decoupling plan to avoid breaking dependents.`,
              )
            }
            style={{
              padding: "5px 14px",
              borderRadius: 999,
              background: isLight ? "#09090b" : "#ffffff",
              color: isLight ? "#ffffff" : "#000000",
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
              color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255,255,255,0.5)",
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
            const target = nodes.find((n) => n.id === nodeId);
            if (target) {
              centerNode(target);
            }
          }}
          onAskCopilot={(prompt) => {
            onAskCopilotAboutFile(prompt);
          }}
          theme={theme}
        />
      )}
    </div>
  );
}
