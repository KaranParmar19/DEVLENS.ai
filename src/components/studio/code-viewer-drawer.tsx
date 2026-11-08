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
  theme?: "dark" | "light";
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
  theme = "dark",
}: CodeViewerDrawerProps) {
  const isLight = theme === "light";
  const [activeTab, setActiveTab] = useState<"symbols" | "code" | "topology">("symbols");
  const [symbolFilter, setSymbolFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedSymbolName, setSelectedSymbolName] = useState<string | null>(null);

  const [fileDetail, setFileDetail] = useState<FileDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
      const lineRange =
        s.start_line && s.end_line
          ? `L${s.start_line}-L${s.end_line}`
          : `L1-${fileDetail.line_count}`;
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

  // If a file has 0 AST symbols (e.g., config, json, yaml, markdown), default to the Source Code tab
  useEffect(() => {
    if (fileDetail && symbols.length === 0 && fileDetail.content) {
      setActiveTab("code");
    }
  }, [fileDetail, symbols.length]);

  const filteredSymbols = useMemo(() => {
    if (!symbolFilter.trim()) return symbols;
    const q = symbolFilter.toLowerCase();
    return symbols.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.signature.toLowerCase().includes(q) ||
        (s.docstring && s.docstring.toLowerCase().includes(q)),
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
    <>
      {/* Semi-transparent backdrop overlay for click-outside dismissal */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: isLight ? "rgba(0, 0, 0, 0.2)" : "rgba(0, 0, 0, 0.55)",
          backdropFilter: "blur(2px)",
          zIndex: 44,
          transition: "opacity 0.2s ease",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: "min(680px, 94vw)",
          height: "100%",
          maxHeight: "100vh",
          overflow: "hidden",
          backgroundColor: isLight ? "#ffffff" : "#0d0d11",
          borderLeft: `1px solid ${isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.15)"}`,
          boxShadow: isLight
            ? "-12px 0 40px rgba(0, 0, 0, 0.12)"
            : "-24px 0 64px rgba(0, 0, 0, 0.85)",
          zIndex: 45,
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--mf-font, 'Geist', sans-serif)",
          color: isLight ? "#09090b" : "#ffffff",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.1)"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: isLight ? "#f4f4f7" : "#09090b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.06)",
                border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.14)"}`,
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.625rem",
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: isLight
                  ? "#09090b"
                  : node.is_entry
                  ? "#ffffff"
                  : "rgba(255,255,255,0.6)",
                flexShrink: 0,
              }}
            >
              {node.is_entry ? "ENTRY" : "SRC"}
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
                  color: isLight ? "#09090b" : "#ffffff",
                }}
              >
                {node.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.45)",
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
                  background: isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.06)",
                  border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)"}`,
                  color: isLight ? "#09090b" : "#ffffff",
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
                color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255, 255, 255, 0.5)",
                fontSize: "1.25rem",
                cursor: "pointer",
                padding: "4px 8px",
              }}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Invariant / Coupling Callout ─────────────────────────────────── */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: `1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)"}`,
            backgroundColor: isLight ? "rgba(0, 0, 0, 0.02)" : "rgba(255, 255, 255, 0.02)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              color: isLight ? "rgba(9, 9, 11, 0.7)" : "rgba(255, 255, 255, 0.7)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                color: isLight ? "#09090b" : "#ffffff",
                fontWeight: 600,
              }}
            >
              FAN-IN: {incomingNodes.length}
            </span>{" "}
            callers ·{" "}
            <span
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                color: isLight ? "#09090b" : "#ffffff",
                fontWeight: 600,
              }}
            >
              FAN-OUT: {outgoingNodes.length}
            </span>{" "}
            callees · Complexity:{" "}
            <span
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                color: isLight ? "#09090b" : "#ffffff",
              }}
            >
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
              background: isLight ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.15)",
              border: `1px solid ${isLight ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.4)"}`,
              color: isLight ? "#dc2626" : "#fca5a5",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Blast Radius
          </button>
        </div>

        {/* ── Tabs (Symbols | Code | Topology) ───────────────────────────── */}
        <div
          style={{
            display: "flex",
            borderBottom: `1px solid ${isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)"}`,
            background: isLight ? "#f4f4f7" : "#09090b",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("symbols")}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              background: "transparent",
              color:
                activeTab === "symbols"
                  ? isLight
                    ? "#09090b"
                    : "#ffffff"
                  : isLight
                  ? "rgba(9, 9, 11, 0.45)"
                  : "rgba(255, 255, 255, 0.45)",
              borderBottom:
                activeTab === "symbols"
                  ? `2px solid ${isLight ? "#09090b" : "#ffffff"}`
                  : "2px solid transparent",
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
              color:
                activeTab === "code"
                  ? isLight
                    ? "#09090b"
                    : "#ffffff"
                  : isLight
                  ? "rgba(9, 9, 11, 0.45)"
                  : "rgba(255, 255, 255, 0.45)",
              borderBottom:
                activeTab === "code"
                  ? `2px solid ${isLight ? "#09090b" : "#ffffff"}`
                  : "2px solid transparent",
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
              color:
                activeTab === "topology"
                  ? isLight
                    ? "#09090b"
                    : "#ffffff"
                  : isLight
                  ? "rgba(9, 9, 11, 0.45)"
                  : "rgba(255, 255, 255, 0.45)",
              borderBottom:
                activeTab === "topology"
                  ? `2px solid ${isLight ? "#09090b" : "#ffffff"}`
                  : "2px solid transparent",
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
        <div
          className="devlens-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {loading && (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: isLight ? "rgba(9, 9, 11, 0.6)" : "rgba(255, 255, 255, 0.6)",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.8125rem",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  width: 22,
                  height: 22,
                  border: `2px solid ${isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.2)"}`,
                  borderTopColor: isLight ? "#09090b" : "#ffffff",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  marginBottom: 12,
                }}
              />
              <div>Fetching source & AST symbols from index...</div>
            </div>
          )}

          {!loading && error && (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                background: isLight ? "rgba(239, 68, 68, 0.06)" : "rgba(239, 68, 68, 0.05)",
                border: `1px solid ${isLight ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.2)"}`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  color: isLight ? "#dc2626" : "#f87171",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.8125rem",
                  marginBottom: 8,
                  fontWeight: 600,
                }}
              >
                Source Content Unavailable
              </div>
              <p
                style={{
                  color: isLight ? "rgba(9, 9, 11, 0.6)" : "rgba(255,255,255,0.5)",
                  fontSize: "0.75rem",
                  marginBottom: 16,
                }}
              >
                {error}
              </p>
              <button
                type="button"
                onClick={() =>
                  onAskCopilot(`What is the architectural purpose of ${node.path}? Who calls it?`)
                }
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  background: isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255,255,255,0.1)",
                  border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255,255,255,0.2)"}`,
                  color: isLight ? "#09090b" : "#ffffff",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Inspect Module References ↗
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
                    backgroundColor: isLight ? "#ffffff" : "#070709",
                    border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.12)"}`,
                    color: isLight ? "#09090b" : "#ffffff",
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "0.75rem",
                    outline: "none",
                  }}
                />
              </div>

              {filteredSymbols.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: isLight ? "rgba(9, 9, 11, 0.45)" : "rgba(255, 255, 255, 0.4)",
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "0.75rem",
                  }}
                >
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
                        borderColor: isSelected
                          ? isLight
                            ? "#09090b"
                            : "#ffffff"
                          : isLight
                          ? "rgba(0, 0, 0, 0.1)"
                          : "rgba(255, 255, 255, 0.1)",
                        backgroundColor: isSelected
                          ? isLight
                            ? "#f4f4f7"
                            : "rgba(255, 255, 255, 0.04)"
                          : isLight
                          ? "#ffffff"
                          : "#09090b",
                        padding: "12px 14px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
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
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              fontFamily: "var(--mf-mono, monospace)",
                              fontSize: "0.625rem",
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: isLight
                                ? "rgba(0, 0, 0, 0.06)"
                                : "rgba(255, 255, 255, 0.08)",
                              color: isLight ? "rgba(9, 9, 11, 0.8)" : "rgba(255, 255, 255, 0.8)",
                            }}
                          >
                            {sym.kind}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--mf-mono, monospace)",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: isLight ? "#09090b" : "#ffffff",
                            }}
                          >
                            {sym.name}
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: "var(--mf-mono, monospace)",
                            fontSize: "0.625rem",
                            color: isLight ? "rgba(9, 9, 11, 0.45)" : "rgba(255, 255, 255, 0.4)",
                          }}
                        >
                          {sym.lineRange}
                        </span>
                      </div>

                      <div
                        style={{
                          fontFamily: "var(--mf-mono, monospace)",
                          fontSize: "0.6875rem",
                          color: isLight ? "#09090b" : "rgba(255, 255, 255, 0.65)",
                          background: isLight ? "#f1f1f5" : "rgba(0, 0, 0, 0.4)",
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
                              onAskCopilot(
                                `Explain what the function \`${sym.name}\` in \`${node.path}\` does and what callers depend on it.`,
                              );
                            }}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 4,
                              background: isLight
                                ? "rgba(0, 0, 0, 0.05)"
                                : "rgba(255, 255, 255, 0.1)",
                              border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.2)"}`,
                              color: isLight ? "#09090b" : "#ffffff",
                              fontFamily: "var(--mf-mono, monospace)",
                              fontSize: "0.6875rem",
                              cursor: "pointer",
                            }}
                          >
                            Explain Function
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAskCopilot(
                                `Generate unit tests for \`${sym.name}\` in \`${node.path}\`.`,
                              );
                            }}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 4,
                              background: isLight
                                ? "rgba(0, 0, 0, 0.05)"
                                : "rgba(255, 255, 255, 0.1)",
                              border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.2)"}`,
                              color: isLight ? "#09090b" : "#ffffff",
                              fontFamily: "var(--mf-mono, monospace)",
                              fontSize: "0.6875rem",
                              cursor: "pointer",
                            }}
                          >
                            Generate Tests
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
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                flex: 1,
                minHeight: 0,
              }}
            >
              <div
                className="devlens-scroll"
                style={{
                  flex: 1,
                  minHeight: 0,
                  maxHeight: "calc(100vh - 210px)",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.75rem",
                  lineHeight: "1.6",
                  backgroundColor: isLight ? "#f8f8fa" : "#050507",
                  border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.1)"}`,
                  borderRadius: 8,
                  padding: "14px 16px",
                  overflowX: "auto",
                  overflowY: "auto",
                  whiteSpace: "pre",
                }}
              >
                {(fileDetail?.content || "").split("\n").map((line, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 16 }}>
                    <span
                      style={{
                        width: 38,
                        color: isLight
                          ? "rgba(9, 9, 11, 0.35)"
                          : "rgba(255, 255, 255, 0.25)",
                        textAlign: "right",
                        userSelect: "none",
                        flexShrink: 0,
                        fontFamily: "inherit",
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span style={{ color: isLight ? "#09090b" : "#e2e8f0" }}>{line || " "}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: TOPOLOGY */}
          {activeTab === "topology" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Blast Radius Impact Analysis Card */}
              <div
                style={{
                  background: isLight ? "rgba(239, 68, 68, 0.05)" : "rgba(239, 68, 68, 0.08)",
                  border: `1px solid ${isLight ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.3)"}`,
                  borderRadius: 8,
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: isLight ? "#dc2626" : "#fca5a5",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    💥 Blast Radius Impact Analysis
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.625rem",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background:
                        incomingNodes.length >= 4
                          ? isLight
                            ? "rgba(239, 68, 68, 0.15)"
                            : "rgba(239, 68, 68, 0.25)"
                          : incomingNodes.length > 0
                          ? isLight
                            ? "rgba(249, 115, 22, 0.15)"
                            : "rgba(249, 115, 22, 0.25)"
                          : isLight
                          ? "rgba(34, 197, 94, 0.15)"
                          : "rgba(34, 197, 94, 0.25)",
                      color:
                        incomingNodes.length >= 4
                          ? isLight
                            ? "#b91c1c"
                            : "#f87171"
                          : incomingNodes.length > 0
                          ? isLight
                            ? "#c2410c"
                            : "#fb923c"
                          : isLight
                          ? "#15803d"
                          : "#4ade80",
                      fontWeight: 600,
                    }}
                  >
                    {incomingNodes.length >= 4
                      ? "CRITICAL RISK"
                      : incomingNodes.length > 0
                      ? "MODERATE RISK"
                      : "CONTAINED / LEAF"}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "0.75rem",
                    lineHeight: 1.5,
                    color: isLight ? "rgba(9, 9, 11, 0.75)" : "rgba(255, 255, 255, 0.75)",
                    margin: "0 0 12px",
                  }}
                >
                  {incomingNodes.length > 0
                    ? `Modifying or introducing a runtime regression into ${node.label} directly endangers ${incomingNodes.length} direct caller module(s). Simulating the blast radius maps the full cascading failure tree across the repository graph.`
                    : `${node.label} has 0 internal callers in the AST graph. Changes here are contained and will not cause cascading breaks in other modules.`}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onSimulateBlastRadius(node.id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      background: isLight ? "#09090b" : "#ffffff",
                      color: isLight ? "#ffffff" : "#000000",
                      border: "none",
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>Launch Graph Simulation ↗</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onAskCopilot(
                        `Explain the blast radius of modifying \`${node.path}\`. Which callers (${incomingNodes.map((n) => n.path).join(", ") || "none"}) break and what are the safest refactoring steps?`,
                      )
                    }
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      background: isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.08)",
                      border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.15)"}`,
                      color: isLight ? "#09090b" : "#ffffff",
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.6875rem",
                      cursor: "pointer",
                    }}
                  >
                    Ask Copilot ↗
                  </button>
                </div>
              </div>
              {/* Fan-In: Callers */}
              <div>
                <div
                  style={{
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "0.6875rem",
                    color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255,255,255,0.5)",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Incoming Callers (Fan-In: {incomingNodes.length})
                </div>
                {incomingNodes.length === 0 ? (
                  <div
                    style={{
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.75rem",
                      color: isLight ? "rgba(9, 9, 11, 0.45)" : "rgba(255,255,255,0.4)",
                    }}
                  >
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
                          background: isLight ? "#f8f8fa" : "#09090b",
                          border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255,255,255,0.1)"}`,
                          borderRadius: 6,
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          color: isLight ? "#09090b" : "#ffffff",
                        }}
                      >
                        <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem" }}>
                          {n.path}
                        </span>
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255,255,255,0.4)",
                          }}
                        >
                          inspect ↗
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fan-Out: Dependencies */}
              <div>
                <div
                  style={{
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "0.6875rem",
                    color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255,255,255,0.5)",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Outgoing Dependencies (Fan-Out: {outgoingNodes.length})
                </div>
                {outgoingNodes.length === 0 ? (
                  <div
                    style={{
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.75rem",
                      color: isLight ? "rgba(9, 9, 11, 0.45)" : "rgba(255,255,255,0.4)",
                    }}
                  >
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
                          background: isLight ? "#f8f8fa" : "#09090b",
                          border: `1px solid ${isLight ? "rgba(0, 0, 0, 0.1)" : "rgba(255,255,255,0.1)"}`,
                          borderRadius: 6,
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          color: isLight ? "#09090b" : "#ffffff",
                        }}
                      >
                        <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.75rem" }}>
                          {n.path}
                        </span>
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            color: isLight ? "rgba(9, 9, 11, 0.5)" : "rgba(255,255,255,0.4)",
                          }}
                        >
                          inspect ↗
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
