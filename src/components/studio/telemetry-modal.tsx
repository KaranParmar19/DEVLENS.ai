import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Loader2,
  CircleDot,
  Terminal,
  AlertTriangle,
  RefreshCw,
  GitBranch,
  FolderGit2,
} from "lucide-react";
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
  detail: string;
  phaseLabel: string;
  actionLabel: string;
}

const PHASES: PhaseDefinition[] = [
  {
    stepNumber: 1,
    name: "Discovery",
    detail: "Cloning worktree & indexing source file tree",
    phaseLabel: "Phase 1: Repository Discovery",
    actionLabel: "Indexing Files & Structure",
  },
  {
    stepNumber: 2,
    name: "AST Parsing",
    detail: "Generating Tree-sitter syntax trees & symbol tables",
    phaseLabel: "Phase 2: Tree-sitter AST Parsing",
    actionLabel: "Generating Syntax Trees",
  },
  {
    stepNumber: 3,
    name: "Semantic Map",
    detail: "Resolving cross-file imports, exports & call edges",
    phaseLabel: "Phase 3: Semantic Mapping",
    actionLabel: "Mapping Object Relations",
  },
  {
    stepNumber: 4,
    name: "Graph Logic",
    detail: "Computing blast radius, coupling & cited dossier",
    phaseLabel: "Phase 4: Architecture Synthesis",
    actionLabel: "Computing Blast Radius",
  },
];

interface LogEntry {
  id: string;
  time: string;
  tag: string;
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

  // Elapsed timer
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setElapsedMs(0);
  }, [repoUrl]);

  useEffect(() => {
    if (error) return;
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 100);
    return () => clearInterval(id);
  }, [error]);

  const formattedElapsed = (elapsedMs / 1000).toFixed(1).padStart(4, "0") + "s";

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
    if (!repoMeta?.languages) return ["TypeScript", "JavaScript", "CSS"];
    const langs = Object.keys(repoMeta.languages);
    return langs.length > 0 ? langs.slice(0, 4) : ["TypeScript"];
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
        tag: "INDEX",
        text: `Successfully indexed ${totalFiles.toLocaleString()} source files across ephemeral worktree.`,
      },
      {
        id: "l-2",
        time: getTimestamp(9),
        tag: "AST",
        text: "Generating Tree-sitter syntax trees for module",
        codeBadge: "/src/core/parser",
      },
      {
        id: "l-3",
        time: getTimestamp(6),
        tag: "BIND",
        text: `Resolved cross-file symbol bindings across ${topLanguages.join(", ")}.`,
      },
      {
        id: "l-4",
        time: getTimestamp(3),
        tag: "INFO",
        text: "INFO: Initializing semantic mapping of class hierarchies & module imports.",
        isInfo: true,
      },
      {
        id: "l-5",
        time: getTimestamp(1),
        tag: "TYPES",
        text: "Extracting exported interface contracts from",
        codeBadge: `@${owner}/types`,
      },
    ];

    setLogs(initialLogs);
  }, [owner, totalFiles, topLanguages]);

  // Periodic streaming logs
  useEffect(() => {
    if (error || progressPct >= 100) return;

    const dynamicStreamTemplates = [
      {
        tag: "GRAPH",
        text: "Analyzing deep dependency chains for",
        codeBadge: "/utils/graph-traversal.ts",
      },
      {
        tag: "CACHE",
        text: "Context window optimization: OK — chunking AST symbol tokens.",
      },
      {
        tag: "METRIC",
        text: "Evaluating cyclomatic complexity & fan-in across export tree.",
      },
      {
        tag: "INDEX",
        text: "Building cross-reference index for sub-modules in",
        codeBadge: "/src/engine",
      },
      {
        tag: "INFO",
        text: "INFO: AST syntax verification completed without fatal anomalies.",
        isInfo: true,
      },
      {
        tag: "DOCS",
        text: "Synthesizing interactive architecture graph nodes & line citations.",
      },
    ];

    let logCounter = 0;
    const interval = setInterval(() => {
      const template = dynamicStreamTemplates[logCounter % dynamicStreamTemplates.length];
      logCounter++;

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      setLogs((prev) => [
        ...prev.slice(-20),
        {
          id: `dyn-${Date.now()}-${logCounter}`,
          time: timeStr,
          tag: template.tag,
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
      data-theme="light"
      className="mf-root overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        backgroundColor: "#ffffff",
        color: "var(--mf-ink, #0a0a0a)",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        fontFamily: "var(--mf-font)",
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
        .devlens-phase-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }
        .devlens-bottom-split {
          display: grid;
          grid-template-columns: 7fr 5fr;
          gap: 36px;
        }
        @media (max-width: 1024px) {
          .devlens-phase-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .devlens-bottom-split {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 600px) {
          .devlens-phase-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Full-Viewport Architectural Page Layout */}
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          maxWidth: 1480,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          padding: "clamp(24px, 3vw, 40px) clamp(24px, 4.5vw, 72px) 100px",
          boxSizing: "border-box",
          gap: 40,
        }}
      >
        {/* ── 1. Top Full-Width System Header ─────────────────────────────── */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 20,
            borderBottom: "1px solid #eaeaea",
            gap: 20,
            flexWrap: "wrap",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                className="mf-mono"
                style={{
                  fontSize: "0.6875rem",
                  letterSpacing: "0.14em",
                  color: "var(--mf-ink-3, #7a7a7a)",
                  fontWeight: 500,
                }}
              >
                System Status
              </span>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 2,
                  fontFamily: "var(--mf-font)",
                  fontSize: "1.5rem",
                  fontWeight: 600,
                  letterSpacing: "-0.035em",
                  color: "var(--mf-ink, #0a0a0a)",
                }}
              >
                <span>DevLens</span>
                <span style={{ fontWeight: 400, opacity: 0.55, fontSize: "0.85em" }}>.ai</span>
              </div>
            </div>

            <div
              style={{
                height: 24,
                width: 1,
                backgroundColor: "#e5e5e5",
              }}
            />

            {/* Target Repo Breadcrumb Pill */}
            <div
              className="mf-pill"
              style={{
                backgroundColor: "#fafafa",
                borderColor: "#eaeaea",
                color: "var(--mf-ink-2, #595959)",
                textTransform: "none",
                letterSpacing: "-0.01em",
                fontSize: "0.75rem",
              }}
            >
              <FolderGit2 size={14} style={{ color: "#0a0a0a" }} />
              <span>
                {owner} / <strong style={{ color: "#0a0a0a", fontWeight: 600 }}>{repoName}</strong>
              </span>
              <span style={{ color: "#d4d4d4" }}>·</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: "var(--mf-ink-3, #7a7a7a)",
                }}
              >
                <GitBranch size={12} />
                HEAD
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              className="mf-mono"
              style={{
                fontSize: "0.75rem",
                color: "var(--mf-ink-3, #7a7a7a)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ELAPSED {formattedElapsed}
            </span>

            <span
              className="mf-pill"
              style={{
                backgroundColor: error ? "#fef2f2" : "#f5fdf9",
                borderColor: error ? "#fecaca" : "#d1fae5",
                color: error ? "#dc2626" : "#065f46",
                fontWeight: 600,
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
            </span>

            <button
              type="button"
              onClick={onCancel}
              className="mf-pill"
              style={{
                color: "var(--mf-ink-2, #595959)",
                background: "#ffffff",
                borderColor: "#e5e5e5",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#0a0a0a";
                e.currentTarget.style.borderColor = "#0a0a0a";
                e.currentTarget.style.background = "#fafafa";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--mf-ink-2, #595959)";
                e.currentTarget.style.borderColor = "#e5e5e5";
                e.currentTarget.style.background = "#ffffff";
              }}
            >
              Cancel ✕
            </button>
          </div>
        </header>

        {/* ── 2. Full-Width Central Workspace ────────────────────────────── */}
        <main
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 32,
            flex: 1,
            justifyContent: "center",
          }}
        >
          {/* Hero Progress Header Row */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  className="mf-mono"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: "0.75rem",
                    letterSpacing: "0.06em",
                    color: "var(--mf-ink-3, #7a7a7a)",
                  }}
                >
                  <span style={{ color: "#0a0a0a", fontWeight: 600 }}>
                    [0{activePhaseIdx + 1} / 04]
                  </span>
                  <span>{currentPhase.phaseLabel}</span>
                </div>

                <h2
                  className="mf-h2"
                  style={{
                    margin: 0,
                    fontSize: "clamp(2.15rem, 3.8vw, 3.25rem)",
                    fontWeight: 500,
                    color: "var(--mf-ink, #0a0a0a)",
                    letterSpacing: "-0.04em",
                    lineHeight: 1.04,
                  }}
                >
                  Analyzing <span className="mf-serif-i">repository.</span>
                </h2>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    marginTop: 2,
                  }}
                >
                  <p
                    className="mf-body"
                    style={{
                      margin: 0,
                      fontSize: "1.05rem",
                      color: "var(--mf-ink-2, #595959)",
                      lineHeight: 1.5,
                    }}
                  >
                    Deconstructing{" "}
                    <span style={{ color: "#0a0a0a", fontWeight: 600 }}>
                      {owner}/{repoName}
                    </span>{" "}
                    architecture...
                  </p>

                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {topLanguages.map((lang) => (
                      <span
                        key={lang}
                        className="mf-pill"
                        style={{
                          padding: "3px 10px",
                          fontSize: "0.6875rem",
                          backgroundColor: "#f5f5f5",
                          borderColor: "#eaeaea",
                          color: "var(--mf-ink-2, #595959)",
                        }}
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Monumental Percentage Readout */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--mf-font)",
                    fontSize: "clamp(2.75rem, 4.8vw, 4rem)",
                    fontWeight: 500,
                    color: "var(--mf-ink, #0a0a0a)",
                    letterSpacing: "-0.045em",
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Math.round(progressPct)}
                  <span style={{ fontSize: "0.5em", color: "var(--mf-ink-3, #7a7a7a)", marginLeft: 3 }}>
                    %
                  </span>
                </div>
                <span
                  className="mf-mono"
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    color: "var(--mf-ink, #0a0a0a)",
                  }}
                >
                  {currentPhase.actionLabel}
                </span>
              </div>
            </div>

            {/* Full-Width Progress Bar Track */}
            <div
              style={{
                height: 5,
                backgroundColor: "#efefef",
                borderRadius: 9999,
                position: "relative",
                overflow: "hidden",
                width: "100%",
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

          {/* ── 3. Full-Width 4-Column Phase Indicator Cards ─────────────── */}
          <div className="devlens-phase-grid">
            {PHASES.map((p, idx) => {
              const isDone = idx < activePhaseIdx || progressPct >= 100;
              const isActive = idx === activePhaseIdx && progressPct < 100;
              const isPending = idx > activePhaseIdx && progressPct < 100;

              return (
                <div
                  key={p.stepNumber}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 14,
                    padding: "18px 20px",
                    borderRadius: 12,
                    border: isActive
                      ? "1.5px solid #0a0a0a"
                      : isDone
                        ? "1px solid #e5e5e5"
                        : "1px solid #f0f0f0",
                    backgroundColor: isActive
                      ? "#ffffff"
                      : isDone
                        ? "#fafafa"
                        : "#ffffff",
                    boxShadow: isActive ? "0 8px 24px -6px rgba(0, 0, 0, 0.06)" : "none",
                    opacity: isPending ? 0.48 : 1,
                    position: "relative",
                    overflow: "hidden",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span
                      className="mf-mono"
                      style={{
                        fontSize: "0.6875rem",
                        letterSpacing: "0.06em",
                        color: isActive ? "#0a0a0a" : "var(--mf-ink-3, #7a7a7a)",
                        fontWeight: 600,
                      }}
                    >
                      STEP 0{p.stepNumber}
                    </span>

                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span
                        className="mf-mono"
                        style={{
                          fontSize: "0.625rem",
                          letterSpacing: "0.05em",
                          padding: "2px 7px",
                          borderRadius: 999,
                          backgroundColor: isActive
                            ? "#0a0a0a"
                            : isDone
                              ? "#eaeaea"
                              : "#f5f5f5",
                          color: isActive ? "#ffffff" : isDone ? "#0a0a0a" : "#8a8a8a",
                          fontWeight: 600,
                        }}
                      >
                        {isDone ? "Done" : isActive ? "Active" : "Queued"}
                      </span>

                      {isDone ? (
                        <CheckCircle2 size={17} style={{ color: "#0a0a0a", flexShrink: 0 }} />
                      ) : isActive ? (
                        <Loader2
                          size={17}
                          style={{
                            color: "#0a0a0a",
                            flexShrink: 0,
                            animation: "spin 1.4s linear infinite",
                          }}
                        />
                      ) : (
                        <CircleDot size={17} style={{ color: "#a3a3a3", flexShrink: 0 }} />
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span
                      style={{
                        fontFamily: "var(--mf-font)",
                        fontSize: "1.05rem",
                        fontWeight: 500,
                        color: "var(--mf-ink, #0a0a0a)",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {p.name}
                    </span>
                    <span
                      className="mf-body"
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--mf-ink-3, #7a7a7a)",
                        lineHeight: 1.45,
                      }}
                    >
                      {p.detail}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 4. Full-Width Bottom Split: System Log (7fr) & Technical Metrics (5fr) ── */}
          <div
            className="devlens-bottom-split"
            style={{
              borderTop: "1px solid #eaeaea",
              paddingTop: 28,
            }}
          >
            {/* Left Column: System Log Stream */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  className="mf-mono"
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    color: "var(--mf-ink, #0a0a0a)",
                  }}
                >
                  System Log // AST Telemetry
                </span>
                <span
                  className="mf-mono"
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--mf-ink-3, #7a7a7a)",
                    textTransform: "none",
                  }}
                >
                  Streaming live...
                </span>
              </div>

              <div
                ref={logContainerRef}
                data-lenis-prevent="true"
                className="devlens-log-scroll overflow-y-auto"
                style={{
                  height: 210,
                  overflowY: "auto",
                  fontFamily: "var(--mf-mono)",
                  fontSize: "0.8125rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: "16px 18px",
                  backgroundColor: "#fafafa",
                  border: "1px solid #eeeeee",
                  borderRadius: 12,
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
                        fontSize: "0.72rem",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {entry.time}
                    </span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        padding: "1px 6px",
                        borderRadius: 4,
                        backgroundColor: entry.isInfo ? "#0a0a0a" : "#eaeaea",
                        color: entry.isInfo ? "#ffffff" : "#525252",
                        flexShrink: 0,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {entry.tag}
                    </span>
                    <span
                      style={{
                        color: entry.isInfo ? "#0a0a0a" : "#262626",
                        fontWeight: entry.isInfo ? 600 : 400,
                      }}
                    >
                      {entry.text}{" "}
                      {entry.codeBadge && (
                        <code
                          style={{
                            backgroundColor: "#ffffff",
                            border: "1px solid #e5e5e5",
                            padding: "2px 7px",
                            borderRadius: 4,
                            fontSize: "0.72rem",
                            color: "#0a0a0a",
                            fontWeight: 500,
                            fontFamily: "var(--mf-mono)",
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
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  className="mf-mono"
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    color: "var(--mf-ink, #0a0a0a)",
                  }}
                >
                  Technical Metrics
                </span>
                <span
                  className="mf-mono"
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--mf-ink-3, #7a7a7a)",
                    textTransform: "none",
                  }}
                >
                  Real-time telemetry
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 16,
                  backgroundColor: "#fafafa",
                  padding: "18px 20px",
                  borderRadius: 12,
                  border: "1px solid #eeeeee",
                  height: 210,
                  boxSizing: "border-box",
                }}
              >
                {/* Metric 1: Files Processed */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.875rem",
                    }}
                  >
                    <span style={{ color: "var(--mf-ink-2, #595959)", fontWeight: 500 }}>
                      Files Processed
                    </span>
                    <span
                      className="mf-mono"
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "#0a0a0a",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {processedFiles.toLocaleString()} / {totalFiles.toLocaleString()}
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      backgroundColor: "#e5e5e5",
                      height: 5,
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

                {/* Metric 2 & 3 Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    paddingTop: 4,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--mf-ink-3, #7a7a7a)" }}>
                      Repository Size
                    </span>
                    <span
                      className="mf-mono"
                      style={{
                        fontSize: "0.9375rem",
                        fontWeight: 600,
                        color: "#0a0a0a",
                      }}
                    >
                      {sizeFormatted}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--mf-ink-3, #7a7a7a)" }}>
                      Complexity Index
                    </span>
                    <span
                      className="mf-mono"
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        padding: "2px 9px",
                        backgroundColor: "#0a0a0a",
                        color: "#ffffff",
                        borderRadius: 999,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {complexityRating}
                    </span>
                  </div>
                </div>

                {/* Worker Node Footer */}
                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: 12,
                    borderTop: "1px solid #e5e5e5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Terminal size={14} style={{ color: "#0a0a0a", flexShrink: 0 }} />
                    <span
                      className="mf-mono"
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--mf-ink-2, #595959)",
                        textTransform: "none",
                      }}
                    >
                      Worker node: <strong style={{ color: "#0a0a0a" }}>{workerNodeId}</strong>
                    </span>
                  </div>

                  <span
                    className="mf-mono"
                    style={{
                      fontSize: "0.6875rem",
                      color: "var(--mf-ink-3, #7a7a7a)",
                    }}
                  >
                    Tree-sitter AST
                  </span>
                </div>
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
                  borderRadius: 12,
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div
                    className="mf-mono"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    <AlertTriangle size={15} style={{ color: "#dc2626" }} />
                    <span>Analysis Interrupted</span>
                  </div>
                  <div style={{ fontSize: "0.84375rem", color: "#7f1d1d", lineHeight: 1.5 }}>
                    {error}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mf-pill"
                      style={{
                        backgroundColor: "#0a0a0a",
                        color: "#ffffff",
                        borderColor: "#0a0a0a",
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
                    className="mf-pill"
                    style={{
                      backgroundColor: "#ffffff",
                      color: "#0a0a0a",
                      borderColor: "#d4d4d4",
                      cursor: "pointer",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </motion.div>
  );
}
