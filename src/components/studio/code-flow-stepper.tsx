import { useState, useEffect, useCallback, useMemo } from "react";
import type { GraphData, GraphNode } from "./studio-types";

interface CodeFlowStepperProps {
  graphData?: GraphData | null;
  onAskCopilot: (prompt: string) => void;
  onSelectFile?: (filePath: string) => void;
  theme?: "dark" | "light";
}

interface FlowStep {
  id: string;
  stepNumber: string;
  stage: string;
  file: string;
  symbol: string;
  inputContract: string;
  outputContract: string;
  description: string;
  failureRisk: string;
}

interface FlowCategory {
  id: string;
  title: string;
  steps: FlowStep[];
}

function classifyStage(path: string, isEntry: boolean, index: number): string {
  const lower = path.toLowerCase();
  if (isEntry || index === 0) return "Application Ingress & Bootstrap";
  if (lower.includes("/route") || lower.includes("router") || lower.includes("/api/"))
    return "Route & Endpoint Dispatcher";
  if (lower.includes("/middleware")) return "Middleware & Security Interceptor";
  if (lower.includes("/controller")) return "Controller & Business Logic";
  if (lower.includes("/page") || lower.includes("/view") || lower.includes("/screen"))
    return "View & UI Page Orchestrator";
  if (
    lower.includes("/context") ||
    lower.includes("/store") ||
    lower.includes("/state") ||
    lower.includes("reducer")
  )
    return "State Management & Reactive Store";
  if (
    lower.includes("/service") ||
    lower.includes("/client") ||
    lower.includes("fetch") ||
    lower.includes("socket")
  )
    return "Service & Network Transport";
  if (
    lower.includes("/model") ||
    lower.includes("/schema") ||
    lower.includes("/entity") ||
    lower.includes("/db")
  )
    return "Data Model & Persistence Entity";
  if (lower.includes("/component")) return "Interactive Component & UI Render";
  if (lower.includes("/util") || lower.includes("/lib") || lower.includes("/helper"))
    return "Utility & Shared Computation Sink";
  const filename = path.split("/").pop() || path;
  return `${filename} Module Logic`;
}

function createStep(
  node: GraphNode,
  idx: number,
  flowId: string,
  _inDegree: number,
  _outDegree: number,
  callers: string[],
  deps: string[],
  isEntry: boolean,
): FlowStep {
  const stage = classifyStage(node.path, isEntry, idx);
  const callersList = callers.map((c) => c.split("/").pop()).filter(Boolean);
  const depsList = deps.map((d) => d.split("/").pop()).filter(Boolean);

  const inputContract =
    callers.length > 0
      ? `${callers.length} caller(s) [${callersList.slice(0, 3).join(", ")}${callersList.length > 3 ? "..." : ""}]`
      : "Root Ingress (HTTP Request / CLI / UI bootstrap)";

  const outputContract =
    deps.length > 0
      ? `${deps.length} outbound import(s) [${depsList.slice(0, 3).join(", ")}${depsList.length > 3 ? "..." : ""}]`
      : "Terminal Leaf (Self-contained / No downstream imports)";

  const lines = node.line_count ?? 0;
  const lang = node.language || "Source";
  const complexity = node.complexity ? Number(node.complexity).toFixed(1) : "1.0";
  const coupling = node.coupling ? `${(Number(node.coupling) * 100).toFixed(0)}%` : "0%";

  const description = `${node.label} (${node.path}) is written in ${lang} with ${lines} lines of code. Cyclomatic complexity: ${complexity}. Architectural coupling: ${coupling}. Connects directly to ${deps.length} downstream dependency module(s).`;

  let failureRisk =
    "Isolated leaf: 0 callers import this file in the AST graph; runtime issues are contained.";
  if (callers.length >= 5) {
    failureRisk = `Critical blast radius: ${callers.length} dependent modules import this file (${callersList.slice(0, 3).join(", ")}${callersList.length > 3 ? ", etc." : ""}). Regressions or breaking interface changes here propagate across the entire application.`;
  } else if (callers.length > 0) {
    failureRisk = `Moderate blast radius: Directly imported by ${callers.length} module(s) (${callersList.join(", ")}). Failure impacts these direct consumers.`;
  }

  return {
    id: `${flowId}-step-${idx + 1}`,
    stepNumber: String(idx + 1).padStart(2, "0"),
    stage,
    file: node.path,
    symbol: `${node.label} (${lines} LOC · ${lang})`,
    inputContract,
    outputContract,
    description,
    failureRisk,
  };
}

function buildRealFlows(graphData?: GraphData | null): FlowCategory[] {
  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return [];
  }

  const { nodes, edges = [] } = graphData;

  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) {
    nodeMap.set(n.path, n);
    nodeMap.set(n.id, n);
  }

  const outEdges = new Map<string, string[]>();
  const inEdges = new Map<string, string[]>();

  for (const [src, dst] of edges) {
    if (!outEdges.has(src)) outEdges.set(src, []);
    outEdges.get(src)!.push(dst);

    if (!inEdges.has(dst)) inEdges.set(dst, []);
    inEdges.get(dst)!.push(src);
  }

  const codeExts = new Set([
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".c",
    ".cpp",
    ".rb",
    ".php",
    ".vue",
    ".svelte",
  ]);

  const candidateEntries = nodes.filter((n) => {
    const ext = n.path.slice(n.path.lastIndexOf("."));
    if (!codeExts.has(ext)) return false;
    return (
      n.is_entry ||
      /(main|index|app|server|entry|cli|manage|wsgi|asgi)\.[a-z0-9]+$/i.test(n.path)
    );
  });

  candidateEntries.sort((a, b) => {
    if (a.is_entry && !b.is_entry) return -1;
    if (!a.is_entry && b.is_entry) return 1;
    const outA = outEdges.get(a.path)?.length ?? 0;
    const outB = outEdges.get(b.path)?.length ?? 0;
    return outB - outA;
  });

  const finalEntries =
    candidateEntries.length > 0
      ? candidateEntries.slice(0, 4)
      : nodes.slice(0, 1);

  const flows: FlowCategory[] = [];
  const processedSpineKeys: string[] = [];

  const traceSpine = (startNode: GraphNode, maxHops = 6): GraphNode[] => {
    const path: GraphNode[] = [startNode];
    const visited = new Set<string>([startNode.path, startNode.id]);
    let curr = startNode;

    while (path.length < maxHops) {
      const targets = outEdges.get(curr.path) ?? outEdges.get(curr.id) ?? [];
      const unvisitedTargets = targets
        .map((t) => nodeMap.get(t))
        .filter((n): n is GraphNode => !!n && !visited.has(n.path) && !visited.has(n.id));

      if (unvisitedTargets.length === 0) break;

      unvisitedTargets.sort((a, b) => {
        const weightA = (inEdges.get(a.path)?.length ?? 0) + (outEdges.get(a.path)?.length ?? 0);
        const weightB = (inEdges.get(b.path)?.length ?? 0) + (outEdges.get(b.path)?.length ?? 0);
        return weightB - weightA;
      });

      const nextNode = unvisitedTargets[0];
      visited.add(nextNode.path);
      visited.add(nextNode.id);
      path.push(nextNode);
      curr = nextNode;
    }

    return path;
  };

  for (let eIdx = 0; eIdx < finalEntries.length; eIdx++) {
    const entry = finalEntries[eIdx];
    const spine = traceSpine(entry, 6);
    if (spine.length < 2 && finalEntries.length > 1) {
      continue;
    }

    const spineKey = spine.map((n) => n.path).join("|");
    const isSubset = processedSpineKeys.some((existing) => existing.includes(spineKey));
    if (isSubset) continue;

    processedSpineKeys.push(spineKey);

    const isClient = /client|frontend|web|ui/i.test(entry.path);
    const isServer = /server|backend|api/i.test(entry.path);
    const fileName = entry.path.split("/").pop() || entry.label;
    let flowTitle = `Runtime Ingress (${fileName})`;
    if (isClient) flowTitle = `Client Flow (${fileName})`;
    else if (isServer) flowTitle = `Server Pipeline (${fileName})`;

    const flowId = `entry-${eIdx + 1}`;
    const steps = spine.map((node, stepIdx) =>
      createStep(
        node,
        stepIdx,
        flowId,
        inEdges.get(node.path)?.length ?? 0,
        outEdges.get(node.path)?.length ?? 0,
        inEdges.get(node.path) ?? [],
        outEdges.get(node.path) ?? [],
        stepIdx === 0,
      ),
    );

    flows.push({
      id: flowId,
      title: flowTitle,
      steps,
    });
  }

  // Critical Hub Flow (highest blast-radius file with at least 2 dependents)
  const sortedByDependents = [...nodes].sort((a, b) => {
    const countA = inEdges.get(a.path)?.length ?? 0;
    const countB = inEdges.get(b.path)?.length ?? 0;
    return countB - countA;
  });

  const hubNode = sortedByDependents[0];
  if (hubNode && (inEdges.get(hubNode.path)?.length ?? 0) >= 2) {
    const hubCallers = inEdges.get(hubNode.path) ?? [];
    const hubDeps = outEdges.get(hubNode.path) ?? [];

    const criticalNodes: GraphNode[] = [];
    const hubVisited = new Set<string>();

    for (const cPath of hubCallers.slice(0, 2)) {
      const cNode = nodeMap.get(cPath);
      if (cNode && !hubVisited.has(cNode.path)) {
        criticalNodes.push(cNode);
        hubVisited.add(cNode.path);
      }
    }

    criticalNodes.push(hubNode);
    hubVisited.add(hubNode.path);

    for (const dPath of hubDeps.slice(0, 3)) {
      const dNode = nodeMap.get(dPath);
      if (dNode && !hubVisited.has(dNode.path)) {
        criticalNodes.push(dNode);
        hubVisited.add(dNode.path);
      }
    }

    if (criticalNodes.length >= 2) {
      const spineKey = criticalNodes.map((n) => n.path).join("|");
      const isSubset = processedSpineKeys.some((existing) => existing.includes(spineKey));
      if (!isSubset) {
        processedSpineKeys.push(spineKey);
        const flowId = "critical-hub";
        const hubFileName = hubNode.path.split("/").pop() || hubNode.label;
        const steps = criticalNodes.map((node, stepIdx) =>
          createStep(
            node,
            stepIdx,
            flowId,
            inEdges.get(node.path)?.length ?? 0,
            outEdges.get(node.path)?.length ?? 0,
            inEdges.get(node.path) ?? [],
            outEdges.get(node.path) ?? [],
            stepIdx === 0,
          ),
        );

        flows.push({
          id: flowId,
          title: `Critical Hub (${hubFileName})`,
          steps,
        });
      }
    }
  }

  // Fallback: if no flows, provide single overview flow
  if (flows.length === 0 && nodes.length > 0) {
    const sampleNodes = nodes.slice(0, 5);
    const flowId = "overview";
    flows.push({
      id: flowId,
      title: "Repository Overview",
      steps: sampleNodes.map((node, stepIdx) =>
        createStep(
          node,
          stepIdx,
          flowId,
          inEdges.get(node.path)?.length ?? 0,
          outEdges.get(node.path)?.length ?? 0,
          inEdges.get(node.path) ?? [],
          outEdges.get(node.path) ?? [],
          stepIdx === 0,
        ),
      ),
    });
  }

  return flows;
}

export function CodeFlowStepper({
  graphData,
  onAskCopilot,
  onSelectFile,
  theme = "dark",
}: CodeFlowStepperProps) {
  const isLight = theme === "light";
  const flows = useMemo(() => buildRealFlows(graphData), [graphData]);
  const [activeFlowId, setActiveFlowId] = useState<string>("");
  const [activeStepIdx, setActiveStepIdx] = useState(0);

  // Synchronize activeFlowId when computed flows change
  useEffect(() => {
    if (flows.length > 0 && (!activeFlowId || !flows.some((f) => f.id === activeFlowId))) {
      setActiveFlowId(flows[0].id);
      setActiveStepIdx(0);
    }
  }, [flows, activeFlowId]);

  const currentFlow = flows.find((f) => f.id === activeFlowId) ?? flows[0];
  const current = currentFlow?.steps[activeStepIdx] ?? currentFlow?.steps[0];

  const nextStep = useCallback(() => {
    if (!currentFlow) return;
    setActiveStepIdx((i) => Math.min(i + 1, currentFlow.steps.length - 1));
  }, [currentFlow]);

  const prevStep = useCallback(() => {
    setActiveStepIdx((i) => Math.max(i - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextStep();
      if (e.key === "ArrowLeft") prevStep();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextStep, prevStep]);

  // Empty state if no graph data or flow available
  if (!currentFlow || !current) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: isLight ? "#fbfbfe" : "#08080a",
          color: isLight ? "#09090b" : "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          textAlign: "center",
          fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.15)"}`,
            display: "grid",
            placeItems: "center",
            marginBottom: 16,
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "1rem",
            color: isLight ? "rgba(9, 9, 11, 0.6)" : "rgba(255, 255, 255, 0.6)",
          }}
        >
          ∅
        </div>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 500, margin: "0 0 8px" }}>
          No Code Execution Flow Available
        </h3>
        <p
          style={{
            fontSize: "0.875rem",
            color: isLight ? "rgba(9, 9, 11, 0.6)" : "rgba(255, 255, 255, 0.6)",
            maxWidth: 420,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          This repository does not have enough indexed dependency edges or entry points to compute an
          execution flow graph.
        </p>
      </div>
    );
  }

  return (
    <div
      className="devlens-scroll"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: isLight ? "#fbfbfe" : "#08080a",
        color: isLight ? "#09090b" : "#ffffff",
        display: "flex",
        flexDirection: "column",
        padding: "clamp(24px, 4vw, 48px)",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        overflowY: "auto",
        transition: "background-color 0.2s ease, color 0.2s ease",
      }}
    >
      {/* Top Header & Flow Category Switcher */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 32,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <span
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.45)",
            }}
          >
            Trace Execution Engine
          </span>
          <h2
            style={{
              fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              margin: "6px 0 0",
              color: isLight ? "#09090b" : "#ffffff",
            }}
          >
            Runtime Request Flow
          </h2>
        </div>

        {/* Flow Switcher Pills */}
        <div
          style={{
            display: "flex",
            gap: 6,
            background: isLight ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.04)",
            border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)"}`,
            borderRadius: 999,
            padding: 4,
          }}
        >
          {flows.map((flow) => {
            const isActive = flow.id === activeFlowId;
            return (
              <button
                key={flow.id}
                type="button"
                onClick={() => {
                  setActiveFlowId(flow.id);
                  setActiveStepIdx(0);
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "none",
                  background: isActive ? (isLight ? "#09090b" : "#ffffff") : "transparent",
                  color: isActive
                    ? isLight
                      ? "#ffffff"
                      : "#000000"
                    : isLight
                    ? "rgba(9, 9, 11, 0.7)"
                    : "rgba(255, 255, 255, 0.65)",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {flow.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stepper Navigation Strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <span
          style={{
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.75rem",
            color: isLight ? "rgba(9, 9, 11, 0.55)" : "rgba(255, 255, 255, 0.5)",
          }}
        >
          Hop {activeStepIdx + 1} of {currentFlow.steps.length} · {current.stage}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={prevStep}
            disabled={activeStepIdx === 0}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.15)"}`,
              background: "transparent",
              color:
                activeStepIdx === 0
                  ? isLight
                    ? "rgba(9, 9, 11, 0.25)"
                    : "rgba(255, 255, 255, 0.2)"
                  : isLight
                  ? "#09090b"
                  : "#ffffff",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              cursor: activeStepIdx === 0 ? "not-allowed" : "pointer",
            }}
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={nextStep}
            disabled={activeStepIdx === currentFlow.steps.length - 1}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.15)"}`,
              background:
                activeStepIdx === currentFlow.steps.length - 1
                  ? "transparent"
                  : isLight
                  ? "#09090b"
                  : "#ffffff",
              color:
                activeStepIdx === currentFlow.steps.length - 1
                  ? isLight
                    ? "rgba(9, 9, 11, 0.25)"
                    : "rgba(255, 255, 255, 0.2)"
                  : isLight
                  ? "#ffffff"
                  : "#000000",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              fontWeight: 500,
              cursor: activeStepIdx === currentFlow.steps.length - 1 ? "not-allowed" : "pointer",
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Flow Timeline Track */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${currentFlow.steps.length}, 1fr)`,
          gap: 12,
          marginBottom: 36,
        }}
      >
        {currentFlow.steps.map((s, idx) => {
          const isActive = idx === activeStepIdx;
          const isPassed = idx < activeStepIdx;
          return (
            <div
              key={s.id}
              onClick={() => setActiveStepIdx(idx)}
              style={{
                cursor: "pointer",
                padding: "12px",
                borderRadius: 10,
                border: "1px solid",
                borderColor: isActive
                  ? isLight
                    ? "#09090b"
                    : "#ffffff"
                  : isPassed
                  ? isLight
                    ? "rgba(0, 0, 0, 0.2)"
                    : "rgba(255, 255, 255, 0.25)"
                  : isLight
                  ? "rgba(0, 0, 0, 0.08)"
                  : "rgba(255, 255, 255, 0.08)",
                background: isActive
                  ? isLight
                    ? "rgba(0, 0, 0, 0.06)"
                    : "rgba(255, 255, 255, 0.1)"
                  : isLight
                  ? "rgba(0, 0, 0, 0.02)"
                  : "rgba(255, 255, 255, 0.02)",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "0.6875rem",
                    color: isActive
                      ? isLight
                        ? "#09090b"
                        : "#ffffff"
                      : isLight
                      ? "rgba(9, 9, 11, 0.45)"
                      : "rgba(255, 255, 255, 0.4)",
                  }}
                >
                  {s.stepNumber}
                </span>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: isActive
                      ? isLight
                        ? "#09090b"
                        : "#ffffff"
                      : isPassed
                      ? isLight
                        ? "rgba(0, 0, 0, 0.45)"
                        : "rgba(255, 255, 255, 0.5)"
                      : isLight
                      ? "rgba(0, 0, 0, 0.15)"
                      : "rgba(255, 255, 255, 0.15)",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: isActive
                    ? isLight
                      ? "#09090b"
                      : "#ffffff"
                    : isLight
                    ? "rgba(9, 9, 11, 0.7)"
                    : "rgba(255, 255, 255, 0.7)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {s.stage}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Step Detailed Card */}
      <div
        style={{
          background: isLight ? "#ffffff" : "#111114",
          border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.14)"}`,
          borderRadius: 16,
          padding: "clamp(24px, 4vw, 36px)",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          maxWidth: 960,
          boxShadow: isLight ? "0 4px 20px rgba(0, 0, 0, 0.05)" : "none",
        }}
      >
        <div>
          <span
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.5)",
            }}
          >
            STAGE {current.stepNumber} · EXECUTION HOP
          </span>
          <h3
            style={{
              fontSize: "1.75rem",
              fontWeight: 500,
              margin: "8px 0 12px",
              letterSpacing: "-0.03em",
              color: isLight ? "#09090b" : "#ffffff",
            }}
          >
            {current.stage}
          </h3>
          <p
            style={{
              fontSize: "0.9375rem",
              lineHeight: 1.6,
              color: isLight ? "rgba(9, 9, 11, 0.8)" : "rgba(255, 255, 255, 0.8)",
              margin: 0,
            }}
          >
            {current.description}
          </p>
        </div>

        {/* Function & File Signature Box */}
        <div
          style={{
            background: isLight ? "#f4f4f7" : "#08080a",
            border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)"}`,
            borderRadius: 10,
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              color: isLight ? "rgba(9, 9, 11, 0.45)" : "rgba(255, 255, 255, 0.4)",
              marginBottom: 6,
            }}
          >
            INVOCATION TARGET
          </div>
          <div
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.875rem",
              color: isLight ? "#09090b" : "#ffffff",
              marginBottom: 6,
            }}
          >
            {current.symbol}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                color: isLight ? "rgba(9, 9, 11, 0.55)" : "rgba(255, 255, 255, 0.5)",
              }}
            >
              file:
            </span>
            {onSelectFile ? (
              <button
                type="button"
                onClick={() => onSelectFile(current.file)}
                style={{
                  background: isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255,255,255,0.08)",
                  border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255,255,255,0.16)"}`,
                  borderRadius: 4,
                  padding: "2px 8px",
                  color: isLight ? "#09090b" : "#ffffff",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
                title="View in Architecture Canvas"
              >
                <span>{current.file}</span>
                <span style={{ fontSize: "0.625rem", opacity: 0.6 }}>↗</span>
              </button>
            ) : (
              <span
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  color: isLight ? "#09090b" : "#ffffff",
                }}
              >
                {current.file}
              </span>
            )}
          </div>
        </div>

        {/* Input / Output Contracts Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div
            style={{
              background: isLight ? "#f4f4f7" : "rgba(255,255,255,0.03)",
              border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.625rem",
                color: isLight ? "rgba(9, 9, 11, 0.45)" : "rgba(255,255,255,0.4)",
                marginBottom: 4,
              }}
            >
              INBOUND DATA CONTRACT
            </div>
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                color: isLight ? "#09090b" : "#ffffff",
              }}
            >
              {current.inputContract}
            </div>
          </div>
          <div
            style={{
              background: isLight ? "#f4f4f7" : "rgba(255,255,255,0.03)",
              border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.625rem",
                color: isLight ? "rgba(9, 9, 11, 0.45)" : "rgba(255,255,255,0.4)",
                marginBottom: 4,
              }}
            >
              OUTBOUND RESULT CONTRACT
            </div>
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                color: isLight ? "#09090b" : "#ffffff",
              }}
            >
              {current.outputContract}
            </div>
          </div>
        </div>

        {/* Failure Impact Alert */}
        <div style={{ borderLeft: `2px solid ${isLight ? "#09090b" : "#ffffff"}`, paddingLeft: 16 }}>
          <div
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.6875rem",
              textTransform: "uppercase",
              color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.5)",
              marginBottom: 4,
            }}
          >
            Failure Consequence & Blast Radius
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              color: isLight ? "rgba(9, 9, 11, 0.75)" : "rgba(255, 255, 255, 0.75)",
              lineHeight: 1.5,
            }}
          >
            {current.failureRisk}
          </div>
        </div>

        {/* Ask Copilot action */}
        <div>
          <button
            type="button"
            onClick={() =>
              onAskCopilot(
                `Explain the execution flow hop "${current.stage}" at ${current.file} in detail.`,
              )
            }
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: `1px solid ${isLight ? "#09090b" : "#ffffff"}`,
              background: isLight ? "#09090b" : "#ffffff",
              color: isLight ? "#ffffff" : "#000000",
              fontFamily: "var(--mf-font, 'Geist', sans-serif)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Inspect hop dependencies ↗
          </button>
        </div>
      </div>
    </div>
  );
}
