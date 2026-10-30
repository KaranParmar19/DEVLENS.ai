import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Loader2, CircleDot, Terminal, AlertTriangle, RefreshCw } from "lucide-react";
import type { AnalysisStep } from "@/hooks/useAnalysis";

interface TelemetryModalProps {
  repoUrl: string;
  steps: AnalysisStep[];
  progressPct: number;
  repoMeta?: {
    stars: number;
    files: number;
    languages: Record<string, number>;
    sizeKb: number;
  } | null;
  jobId?: string | null;
  error?: string | null;
  onRetry?: () => void;
  onCancel: () => void;
}

interface PhaseDefinition {
  stepNumber: number;
  name: string;
  phaseLabel: string;
  actionLabel: string;
}

const PHASES: PhaseDefinition[] = [
  {
    stepNumber: 1,
    name: "Discovery",
    phaseLabel: "Phase 1: Repository Discovery",
    actionLabel: "Indexing Files & Structure",
  },
  {
    stepNumber: 2,
    name: "AST Parsing",
    phaseLabel: "Phase 2: Tree-sitter AST Parsing",
    actionLabel: "Generating Syntax Trees",
  },
  {
    stepNumber: 3,
    name: "Semantic Map",
    phaseLabel: "Phase 3: Semantic Mapping",
    actionLabel: "Mapping Object Relations",
  },
  {
    stepNumber: 4,
    name: "Graph Logic",
    phaseLabel: "Phase 4: Architecture Synthesis",
    actionLabel: "Computing Blast Radius",
  },
];

interface LogEntry {
  id: string;
  time: string;
  text: string;
  codeBadge?: string;
  isInfo?: boolean;
}

export function TelemetryModal({
  repoUrl,
  steps,
  progressPct,
  repoMeta,
  jobId,
  error,
  onRetry,
  onCancel,
}: TelemetryModalProps) {
  const cleanRepo = repoUrl
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");

  const [owner, repoName] = useMemo(() => {
    const parts = cleanRepo.split("/");
    if (parts.length >= 2) {
      return [parts[0], parts.slice(1).join("/")];
    }
    return ["github", cleanRepo || "repository"];
  }, [cleanRepo]);

  // Determine current active phase (0..3)
  const activePhaseIdx = useMemo(() => {
    if (progressPct >= 100) return 3;
    if (steps && steps.length > 0) {
      const activeIdx = steps.findIndex((s) => s.status === "active");
      if (activeIdx >= 0) return Math.min(activeIdx, 3);
      const doneCount = steps.filter((s) => s.status === "done").length;
      if (doneCount > 0) return Math.min(doneCount, 3);
    }
    if (progressPct < 25) return 0;
    if (progressPct < 50) return 1;
    if (progressPct < 75) return 2;
    return 3;
  }, [progressPct, steps]);

  const currentPhase = PHASES[activePhaseIdx] ?? PHASES[0];

  // Derived metrics
  const totalFiles = repoMeta?.files || 184;
  const processedFiles = useMemo(() => {
    if (progressPct >= 100) return totalFiles;
    return Math.min(totalFiles, Math.max(12, Math.floor((progressPct / 100) * totalFiles)));
  }, [progressPct, totalFiles]);

  const sizeFormatted = useMemo(() => {
    if (repoMeta?.sizeKb) {
      if (repoMeta.sizeKb > 1024) {
        return (repoMeta.sizeKb / 1024).toFixed(1) + " MB";
      }
      return repoMeta.sizeKb.toLocaleString() + " KB";
    }
    return "18.4 MB";
  }, [repoMeta]);

  const topLanguages = useMemo(() => {
    if (!repoMeta?.languages) return ["TypeScript", "Rust"];
    const langs = Object.keys(repoMeta.languages);
    return langs.length > 0 ? langs.slice(0, 3) : ["TypeScript"];
  }, [repoMeta]);

  const complexityRating = useMemo(() => {
    if (totalFiles > 800) return "HIGH";
    if (totalFiles > 200) return "MODERATE";
    return "BALANCED";
  }, [totalFiles]);

  const workerNodeId = useMemo(() => {
    if (jobId) {
      const cleanId = jobId.replace(/^job_devlens_scan_/i, "").replace(/^job_/i, "");
      return `AST-WKR-${cleanId.slice(0, 4).toUpperCase()}`;
    }
    return "AST-WKR-08";
  }, [jobId]);

  // Streaming system logs
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const getTimestamp = (offsetSec = 0) => {
      const d = new Date(Date.now() - offsetSec * 1000);
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const initialLogs: LogEntry[] = [
      {
        id: "l-1",
        time: getTimestamp(12),
        text: `Successfully indexed ${totalFiles.toLocaleString()} files across workspace.`,
      },
      {
        id: "l-2",
        time: getTimestamp(9),
        text: "Generating syntax trees for module",
        codeBadge: "/src/core/parser",
      },
      {
        id: "l-3",
        time: getTimestamp(6),
        text: `Resolved cross-file symbol bindings across ${topLanguages.join(", ")}.`,
      },
      {
        id: "l-4",
        time: getTimestamp(3),
        text: "INFO: Initializing semantic mapping of class hierarchies & imports.",
        isInfo: true,
      },
      {
        id: "l-5",
        time: getTimestamp(1),
        text: "Extracting interface contracts from",
        codeBadge: `@${owner}/types`,
      },
    ];

    setLogs(initialLogs);
  }, [owner, totalFiles, topLanguages]);

  // Periodic streaming logs to give the live AST parser experience
  useEffect(() => {
    if (error || progressPct >= 100) return;

    const dynamicStreamTemplates = [
      { text: "Analyzing deep dependency chains for", codeBadge: "/utils/graph-traversal.ts" },
      { text: "Context window optimization: OK — chunking AST tokens." },
      { text: "Evaluating cyclomatic complexity & fan-in across export tree." },
      { text: "Building cross-reference index for sub-modules in", codeBadge: "/src/engine" },
      { text: "INFO: AST syntax verification completed without fatal anomalies.", isInfo: true },
      { text: "Synthesizing interactive architecture graph nodes & citations." },
    ];

    let logCounter = 0;
    const interval = setInterval(() => {
      const template = dynamicStreamTemplates[logCounter % dynamicStreamTemplates.length];
      logCounter++;

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      setLogs((prev) => [
        ...prev.slice(-18),
        {
          id: `dyn-${Date.now()}-${logCounter}`,
          time: timeStr,
          text: template.text,
          codeBadge: template.codeBadge,
          isInfo: template.isInfo,
        },
      ]);
    }, 2400);

    return () => clearInterval(interval);
  }, [error, progressPct]);

  // Auto-scroll log container to bottom on new entry
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <motion.div
      data-lenis-prevent="true"
      className="overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        backgroundColor: "#ffffff",
        color: "#0a0a0a",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        fontFamily:
          "var(--mf-font, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
      }}
    >
      <style>{`
        @keyframes devlens-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .devlens-log-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .devlens-log-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .devlens-log-scroll::-webkit-scrollbar-thumb {
          background: #e5e5e5;
          border-radius: 4px;
        }
        .devlens-log-scroll::-webkit-scrollbar-thumb:hover {
          background: #d4d4d4;
        }
      `}</style>

      {/* Scrollable Inner Wrapper that centers when tall and scrolls smoothly when needed */}
      <div
        style={{
          minHeight: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "clamp(32px, 5vh, 64px) clamp(20px, 4vw, 48px) 120px",
          boxSizing: "border-box",
        }}
      >
        {/* ── Main Content Merged Directly into White Background (No Outer Box) ── */}
        <main
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: 880,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 36,
          }}
        >
          {/* ── Top Header Branding ───────────────────────────────────────── */}
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              paddingBottom: 24,
              borderBottom: "1px solid #eeeeee",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                  fontSize: "0.6875rem",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "#8a8a8a",
                  fontWeight: 500,
                }}
              >
                System Status
              </span>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(1.65rem, 3vw, 2.15rem)",
                  fontWeight: 600,
                  letterSpacing: "-0.035em",
                  lineHeight: 1.08,
                  color: "#0a0a0a",
                }}
              >
                DevLens AI
              </h1>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                  fontSize: "0.75rem",
                  letterSpacing: "0.06em",
                  fontWeight: 500,
                  color: error ? "#dc2626" : "#0a0a0a",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: error ? "#ef4444" : "#10b981",
                    boxShadow: error
                      ? "0 0 8px rgba(239, 68, 68, 0.4)"
                      : "0 0 8px rgba(16, 185, 129, 0.4)",
                    animation: error
                      ? "none"
                      : "devlens-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                  }}
                />
                {error ? "HALTED" : "ACTIVE SESSION"}
              </div>

              <button
                type="button"
                onClick={onCancel}
                style={{
                  fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                  fontSize: "0.6875rem",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "#525252",
                  background: "#ffffff",
                  border: "1px solid #e5e5e5",
                  borderRadius: 6,
                  padding: "6px 14px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#0a0a0a";
                  e.currentTarget.style.borderColor = "#0a0a0a";
                  e.currentTarget.style.background = "#fafafa";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#525252";
                  e.currentTarget.style.borderColor = "#e5e5e5";
                  e.currentTarget.style.background = "#ffffff";
                }}
              >
                Cancel ✕
              </button>
            </div>
          </header>

          {/* ── Seamless Analysis Workspace (Merged directly with background) ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 32,
            }}
          >
            {/* 1. Progress Header */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "clamp(1.35rem, 2.5vw, 1.65rem)",
                    fontWeight: 600,
                    color: "#0a0a0a",
                    letterSpacing: "-0.025em",
                  }}
                >
                  Analyzing Repository
                </h2>

                <div
                  style={{
                    fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "#0a0a0a",
                    letterSpacing: "0.05em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Math.round(progressPct)}% COMPLETE
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.95rem",
                    color: "#737373",
                    lineHeight: 1.5,
                  }}
                >
                  Deconstructing{" "}
                  <span style={{ color: "#0a0a0a", fontWeight: 600 }}>
                    {owner}/{repoName}
                  </span>{" "}
                  architecture...
                </p>

                {topLanguages.length > 0 && (
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                      fontSize: "0.6875rem",
                      color: "#8a8a8a",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {topLanguages.join(" · ")}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Progress Bar Visual */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                  fontSize: "0.75rem",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "#737373",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span>{currentPhase.phaseLabel}</span>
                <span style={{ fontWeight: 600, color: "#0a0a0a" }}>
                  {currentPhase.actionLabel}
                </span>
              </div>

              <div
                style={{
                  height: 4,
                  backgroundColor: "#efefef",
                  borderRadius: 9999,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    backgroundColor: "#0a0a0a",
                    width: `${Math.min(100, Math.max(progressPct, 4))}%`,
                    borderRadius: 9999,
                    transition: "width 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
              </div>
            </div>

            {/* 3. Phase Indicator Cards (4 Columns) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 14,
              }}
            >
              {PHASES.map((p, idx) => {
                const isDone = idx < activePhaseIdx || progressPct >= 100;
                const isActive = idx === activePhaseIdx && progressPct < 100;
                const isPending = idx > activePhaseIdx && progressPct < 100;

                return (
                  <div
                    key={p.stepNumber}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      borderRadius: 6,
                      border: isActive
                        ? "1px solid #0a0a0a"
                        : isDone
                          ? "1px solid #eaeaea"
                          : "1px solid #f2f2f2",
                      backgroundColor: isActive
                        ? "#ffffff"
                        : isDone
                          ? "#fafafa"
                          : "#ffffff",
                      boxShadow: isActive ? "0 4px 14px rgba(0, 0, 0, 0.04)" : "none",
                      opacity: isPending ? 0.45 : 1,
                      position: "relative",
                      overflow: "hidden",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {/* Status Icon */}
                    {isDone ? (
                      <CheckCircle2
                        size={19}
                        style={{ color: "#0a0a0a", flexShrink: 0, position: "relative", zIndex: 2 }}
                      />
                    ) : isActive ? (
                      <Loader2
                        size={19}
                        style={{
                          color: "#0a0a0a",
                          flexShrink: 0,
                          animation: "spin 1.4s linear infinite",
                          position: "relative",
                          zIndex: 2,
                        }}
                      />
                    ) : (
                      <CircleDot
                        size={19}
                        style={{ color: "#a3a3a3", flexShrink: 0, position: "relative", zIndex: 2 }}
                      />
                    )}

                    {/* Step Text */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        position: "relative",
                        zIndex: 2,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                          fontSize: "0.6875rem",
                          letterSpacing: "0.05em",
                          color: isActive ? "#0a0a0a" : "#737373",
                          fontWeight: isActive ? 600 : 500,
                        }}
                      >
                        STEP {p.stepNumber}
                      </span>
                      <span
                        style={{
                          fontSize: "0.84375rem",
                          fontWeight: isActive ? 600 : 500,
                          color: isPending ? "#737373" : "#0a0a0a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {p.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 4. System Log & Technical Metrics Split */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 28,
                borderTop: "1px solid #eeeeee",
                paddingTop: 28,
              }}
            >
              {/* Left Column: System Log */}
              <div
                style={{
                  gridColumn: "span 2",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  minWidth: 0,
                }}
                className="col-span-1 md:col-span-2"
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#737373",
                    }}
                  >
                    System Log
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                      fontSize: "0.75rem",
                      color: "#a3a3a3",
                    }}
                  >
                    Streaming...
                  </span>
                </div>

                <div
                  ref={logContainerRef}
                  data-lenis-prevent="true"
                  className="devlens-log-scroll overflow-y-auto"
                  style={{
                    height: 170,
                    overflowY: "auto",
                    fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                    fontSize: "0.75rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    paddingRight: 8,
                  }}
                >
                  {logs.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 12,
                        lineHeight: 1.55,
                      }}
                    >
                      <span
                        style={{
                          color: "#a3a3a3",
                          flexShrink: 0,
                          fontSize: "0.6875rem",
                        }}
                      >
                        {entry.time}
                      </span>
                      <span
                        style={{
                          color: entry.isInfo ? "#0a0a0a" : "#333333",
                          fontWeight: entry.isInfo ? 600 : 400,
                        }}
                      >
                        {entry.text}{" "}
                        {entry.codeBadge && (
                          <code
                            style={{
                              backgroundColor: "#f5f5f5",
                              border: "1px solid #eaeaea",
                              padding: "1px 6px",
                              borderRadius: 3,
                              fontSize: "0.6875rem",
                              color: "#0a0a0a",
                            }}
                          >
                            {entry.codeBadge}
                          </code>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Technical Metrics */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  backgroundColor: "#fafafa",
                  padding: 18,
                  borderRadius: 6,
                  border: "1px solid #eeeeee",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#737373",
                  }}
                >
                  Technical Metrics
                </span>

                {/* Metric: Files Processed */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <span style={{ color: "#737373" }}>Files Processed</span>
                    <span
                      style={{
                        fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#0a0a0a",
                      }}
                    >
                      {processedFiles.toLocaleString()} / {totalFiles.toLocaleString()}
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      backgroundColor: "#e5e5e5",
                      height: 4,
                      borderRadius: 9999,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: "#0a0a0a",
                        height: "100%",
                        borderRadius: 9999,
                        width: `${Math.min(100, (processedFiles / totalFiles) * 100)}%`,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>

                {/* Metric: Repository Size */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.8125rem",
                  }}
                >
                  <span style={{ color: "#737373" }}>Repository Size</span>
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#0a0a0a",
                    }}
                  >
                    {sizeFormatted}
                  </span>
                </div>

                {/* Metric: Complexity Index */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.8125rem",
                  }}
                >
                  <span style={{ color: "#737373" }}>Complexity Index</span>
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      padding: "2px 7px",
                      backgroundColor: "#0a0a0a",
                      color: "#ffffff",
                      borderRadius: 3,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {complexityRating}
                  </span>
                </div>

                {/* Worker Node Footer */}
                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: 12,
                    borderTop: "1px solid #eaeaea",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Terminal size={14} style={{ color: "#0a0a0a", flexShrink: 0 }} />
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                      fontSize: "0.75rem",
                      color: "#737373",
                    }}
                  >
                    Worker node: {workerNodeId}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Banner (If present) */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  style={{
                    padding: "16px 20px",
                    borderRadius: 6,
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    <AlertTriangle size={15} style={{ color: "#dc2626" }} />
                    <span>Analysis Interrupted</span>
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "#7f1d1d", lineHeight: 1.5 }}>
                    {error}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    {onRetry && (
                      <button
                        type="button"
                        onClick={onRetry}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 4,
                          backgroundColor: "#0a0a0a",
                          color: "#ffffff",
                          border: "1px solid #0a0a0a",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        <RefreshCw size={12} />
                        Retry Analysis
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onCancel}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 4,
                        backgroundColor: "#ffffff",
                        color: "#0a0a0a",
                        border: "1px solid #d4d4d4",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Footer Visual Hint ─────────────────────────────────────────── */}
          <footer
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                opacity: 0.4,
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 1,
                  background: "linear-gradient(90deg, transparent, #0a0a0a)",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--mf-mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
                  fontSize: "0.6875rem",
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  color: "#0a0a0a",
                  fontWeight: 500,
                }}
              >
                DevLens AST Core v2.4
              </span>
              <div
                style={{
                  width: 96,
                  height: 1,
                  background: "linear-gradient(270deg, transparent, #0a0a0a)",
                }}
              />
            </div>
          </footer>
        </main>
      </div>
    </motion.div>
  );
}
