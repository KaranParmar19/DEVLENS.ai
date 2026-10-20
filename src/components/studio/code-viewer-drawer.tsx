import { useState, useMemo, useEffect } from "react";
import type { GraphNode } from "./studio-types";
import { api, type FileDetailResponse, type SymbolDetail } from "@/lib/api";

export interface FunctionSymbol {
  name: string;
  signature: string;
  kind: "function" | "method" | "class" | "interface" | "constant";
  returnType: string;
  parameters: { name: string; type: string }[];
  complexityScore: "low" | "moderate" | "high";
  lineRange: string;
  docstring?: string;
  isExported: boolean;
}

interface CodeViewerDrawerProps {
  node: GraphNode | null;
  sessionId?: string;
  incomingNodes?: GraphNode[];
  outgoingNodes?: GraphNode[];
  onSelectNode?: (nodeId: string, path: string) => void;
  onClose: () => void;
  onSimulateBlastRadius: (nodeId: string) => void;
  onAskCopilot: (prompt: string) => void;
}

export function CodeViewerDrawer({
  node,
  sessionId,
  incomingNodes = [],
  outgoingNodes = [],
  onSelectNode,
  onClose,
  onSimulateBlastRadius,
  onAskCopilot,
}: CodeViewerDrawerProps) {
  const [activeTab, setActiveTab] = useState<"symbols" | "code" | "topology">("symbols");
  const [symbolFilter, setSymbolFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedSymbolName, setSelectedSymbolName] = useState<string | null>(null);

  const [fileDetail, setFileDetail] = useState<FileDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch genuine file content and AST symbols from backend API
  useEffect(() => {
    if (!node) {
      setFileDetail(null);
      return;
    }
    if (!sessionId) {
      setFileDetail(null);
      setError("Active session required to fetch file content from index.");
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    api
      .getFile(sessionId, node.path)
      .then((data) => {
        if (isMounted) {
          setFileDetail(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setFileDetail(null);
          setError(err.message || "File source code not cached in repository index.");
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [node, sessionId]);

  const symbols: FunctionSymbol[] = useMemo(() => {
    if (!fileDetail?.symbols || fileDetail.symbols.length === 0) return [];
    return fileDetail.symbols.map((s: SymbolDetail) => {
      const comp = s.complexity ?? 1;
      const complexityScore = comp > 15 ? "high" : comp > 7 ? "moderate" : "low";
      const lineRange = s.start_line && s.end_line ? `L${s.start_line}-L${s.end_line}` : `L1-${fileDetail.line_count}`;
      return {
        name: s.name,
        signature: `${s.type || "def"} ${s.name}(${(s.parameters || []).join(", ")})`,
        kind: (s.type === "class" ? "class" : "function") as FunctionSymbol["kind"],
        returnType: s.return_type || "inferred",
        parameters: (s.parameters || []).map((p) => ({ name: p, type: "any" })),
        complexityScore,
        lineRange,
        docstring: `AST indexed ${s.type || "symbol"} in ${fileDetail.path}`,
        isExported: true,
      };
    });
  }, [fileDetail]);

  const filteredSymbols = useMemo(() => {
    if (!symbolFilter.trim()) return symbols;
    const q = symbolFilter.toLowerCase();
    return symbols.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.signature.toLowerCase().includes(q) ||
        (s.docstring && s.docstring.toLowerCase().includes(q))
    );
  }, [symbols, symbolFilter]);

  const copyCode = () => {
    if (!fileDetail?.content) return;
    navigator.clipboard.writeText(fileDetail.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!node) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        right: 0,
        width: "min(680px, 94vw)",
        backgroundColor: "#0d0d11",
        borderLeft: "1px solid rgba(255, 255, 255, 0.15)",
        boxShadow: "-24px 0 64px rgba(0, 0, 0, 0.85)",
        zIndex: 45,
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        color: "#ffffff",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#09090b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              display: "grid",
              placeItems: "center",
              fontSize: "0.875rem",
              flexShrink: 0,
            }}
          >
            {node.is_entry ? "🚀" : "📄"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                letterSpacing: "-0.015em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {node.label}
            </div>
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                color: "rgba(255, 255, 255, 0.45)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {node.path}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {fileDetail?.content && (
            <button
              type="button"
              onClick={copyCode}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                cursor: "pointer",
              }}
            >
              {copied ? "✓ Copied" : "Copy Code"}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: "1.25rem",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Invariant / Coupling Callout ─────────────────────────────────── */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          backgroundColor: "rgba(255, 255, 255, 0.02)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.7)" }}>
          <span style={{ fontFamily: "var(--mf-mono, monospace)", color: "#ffffff", fontWeight: 600 }}>
            FAN-IN: {incomingNodes.length}
          </span>{" "}
          callers ·{" "}
          <span style={{ fontFamily: "var(--mf-mono, monospace)", color: "#ffffff", fontWeight: 600 }}>
            FAN-OUT: {outgoingNodes.length}
          </span>{" "}
          callees · Complexity:{" "}
          <span style={{ fontFamily: "var(--mf-mono, monospace)", color: "#ffffff" }}>
            {node.complexity ?? 1}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onSimulateBlastRadius(node.id)}
          style={{
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            padding: "4px 10px",
            borderRadius: 6,
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            color: "#fca5a5",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          💥 Blast Radius
        </button>
      </div>

      {/* ── Tabs (Symbols | Code | Topology) ───────────────────────────── */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", background: "#09090b" }}>
        <button
          type="button"
          onClick={() => setActiveTab("symbols")}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            background: "transparent",
            color: activeTab === "symbols" ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
            borderBottom: activeTab === "symbols" ? "2px solid #ffffff" : "2px solid transparent",
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: "pointer",
          }}
        >
          AST Symbols ({symbols.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("code")}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            background: "transparent",
            color: activeTab === "code" ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
            borderBottom: activeTab === "code" ? "2px solid #ffffff" : "2px solid transparent",
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: "pointer",
          }}
        >
          Source Code
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("topology")}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            background: "transparent",
            color: activeTab === "topology" ? "#ffffff" : "rgba(255, 255, 255, 0.45)",
            borderBottom: activeTab === "topology" ? "2px solid #ffffff" : "2px solid transparent",
            fontFamily: "var(--mf-mono, monospace)",
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: "pointer",
          }}
        >
          Topology ({incomingNodes.length + outgoingNodes.length})
        </button>
      </div>

      {/* ── Drawer Body ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {loading && (
          <div style={{ padding: 40, textAlign: "center", color: "rgba(255, 255, 255, 0.6)", fontFamily: "var(--mf-mono, monospace)", fontSize: "0.8125rem" }}>
            <div style={{ display: "inline-block", width: 22, height: 22, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 12 }} />
            <div>Fetching source & AST symbols from index...</div>
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: 32, textAlign: "center", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 10 }}>
            <div style={{ color: "#f87171", fontFamily: "var(--mf-mono, monospace)", fontSize: "0.8125rem", marginBottom: 8, fontWeight: 600 }}>
              Source Content Unavailable
            </div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", marginBottom: 16 }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => onAskCopilot(`What is the architectural purpose of ${node.path}? Who calls it?`)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#ffffff",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              Ask Copilot About This Module
            </button>
          </div>
        )}

        {/* TAB 1: AST SYMBOLS */}
        {!loading && !error && activeTab === "symbols" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Filter symbols..."
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  backgroundColor: "#070709",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  outline: "none",
                }}
              />
            </div>

            {filteredSymbols.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "rgba(255, 255, 255, 0.4)", fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem" }}>
                {symbols.length === 0
                  ? "No AST functions or classes were indexed in this file."
                  : `No symbols matching "${symbolFilter}"`}
              </div>
            ) : (
              filteredSymbols.map((sym) => {
                const isSelected = selectedSymbolName === sym.name;
                return (
                  <div
                    key={sym.name}
                    onClick={() => setSelectedSymbolName(isSelected ? null : sym.name)}
                    style={{
                      borderRadius: 8,
                      border: "1px solid",
                      borderColor: isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.1)",
                      backgroundColor: isSelected ? "rgba(255, 255, 255, 0.04)" : "#09090b",
                      padding: "12px 14px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            fontFamily: "var(--mf-mono, monospace)",
                            fontSize: "0.625rem",
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "rgba(255, 255, 255, 0.08)",
                            color: "rgba(255, 255, 255, 0.8)",
                          }}
                        >
                          {sym.kind}
                        </span>
                        <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.8125rem", fontWeight: 600 }}>
                          {sym.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--mf-mono, monospace)",
                          fontSize: "0.625rem",
                          color: "rgba(255, 255, 255, 0.4)",
                        }}
                      >
                        {sym.lineRange}
                      </span>
                    </div>

                    <div
                      style={{
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "0.6875rem",
                        color: "rgba(255, 255, 255, 0.65)",
                        background: "rgba(0, 0, 0, 0.4)",
                        padding: "6px 8px",
                        borderRadius: 4,
                        marginBottom: 8,
                        overflowX: "auto",
                      }}
                    >
                      {sym.signature}
                    </div>

                    {isSelected && (
                      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAskCopilot(`Explain what the function \`${sym.name}\` in \`${node.path}\` does and what callers depend on it.`);
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            background: "rgba(255, 255, 255, 0.1)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: "#ffffff",
                            fontFamily: "var(--mf-mono, monospace)",
                            fontSize: "0.6875rem",
                            cursor: "pointer",
                          }}
                        >
                          💬 Explain Function
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAskCopilot(`Generate unit tests for \`${sym.name}\` in \`${node.path}\`.`);
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            background: "rgba(255, 255, 255, 0.1)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: "#ffffff",
                            fontFamily: "var(--mf-mono, monospace)",
                            fontSize: "0.6875rem",
                            cursor: "pointer",
                          }}
                        >
                          🧪 Generate Tests
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: SOURCE CODE */}
        {!loading && !error && activeTab === "code" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                lineHeight: "1.6",
                backgroundColor: "#050507",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 8,
                padding: "14px 16px",
                overflowX: "auto",
                whiteSpace: "pre",
              }}
            >
              {(fileDetail?.content || "").split("\n").map((line, idx) => (
                <div key={idx} style={{ display: "flex", gap: 16 }}>
                  <span
                    style={{
                      width: 36,
                      color: "rgba(255, 255, 255, 0.25)",
                      textAlign: "right",
                      userSelect: "none",
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ color: "#e2e8f0" }}>{line || " "}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: TOPOLOGY */}
        {activeTab === "topology" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Fan-In: Callers */}
            <div>
              <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.6875rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 8 }}>
                Incoming Callers (Fan-In: {incomingNodes.length})
              </div>
              {incomingNodes.length === 0 ? (
                <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
                  No incoming callers detected (Entry point or standalone).
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {incomingNodes.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => onSelectNode?.(n.id, n.path)}
                      style={{
                        padding: "8px 12px",
                        background: "#09090b",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem" }}>{n.path}</span>
                      <span style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.4)" }}>inspect ↗</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fan-Out: Dependencies */}
            <div>
              <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.6875rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 8 }}>
                Outgoing Dependencies (Fan-Out: {outgoingNodes.length})
              </div>
              {outgoingNodes.length === 0 ? (
                <div style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
                  No outgoing dependencies (Leaf module).
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {outgoingNodes.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => onSelectNode?.(n.id, n.path)}
                      style={{
                        padding: "8px 12px",
                        background: "#09090b",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem" }}>{n.path}</span>
                      <span style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.4)" }}>inspect ↗</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
