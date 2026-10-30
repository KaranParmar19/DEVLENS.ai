import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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

const EDITORIAL_PHASES: Array<{
  lead: string;
  serif: string;
  hint: string;
  short: string;
}> = [
  {
    lead: "Cloning repository",
    serif: "worktree.",
    hint: "Fetching default branch head into an isolated ephemeral sandbox",
    short: "Clone",
  },
  {
    lead: "Scanning source",
    serif: "file tree.",
    hint: "Filtering lockfiles, binaries, and build artifacts",
    short: "Scan",
  },
  {
    lead: "Mapping architecture",
    serif: "& imports.",
    hint: "Resolving cross-file AST symbols and module dependencies",
    short: "Graph",
  },
  {
    lead: "Scoring complexity",
    serif: "& blast radius.",
    hint: "Computing cyclomatic depth, hub centrality, and Coupling metrics",
    short: "Metrics",
  },
  {
    lead: "Preparing interactive",
    serif: "studio.",
    hint: "Finalizing architecture canvas and cited onboarding dossier",
    short: "Ready",
  },
];

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

  // Elapsed timer for SaaS precision feel
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

  // Determine current active step index (0..4)
  const activeStepIdx = useMemo(() => {
    const idx = steps.findIndex((s) => s.status === "active");
    if (idx >= 0) return idx;
    const doneCount = steps.filter((s) => s.status === "done").length;
    if (doneCount > 0) return Math.min(doneCount, steps.length - 1);
    return Math.min(Math.floor((progressPct / 100) * Math.max(steps.length, 1)), Math.max(steps.length - 1, 0));
  }, [steps, progressPct]);

  const phaseMeta = EDITORIAL_PHASES[activeStepIdx] ?? EDITORIAL_PHASES[0];

  // Quiet single-line status whisper
  const statusWhisper = useMemo(() => {
    if (error) return "Pipeline halted — review diagnostic message below";
    if (repoMeta?.files && activeStepIdx >= 2) {
      const topLangs = repoMeta.languages
        ? Object.keys(repoMeta.languages).slice(0, 3).join(", ")
        : "";
      return `Indexing ${repoMeta.files.toLocaleString()} source files${topLangs ? ` (${topLangs})` : ""} — ${phaseMeta.hint.toLowerCase()}`;
    }
    if (repoMeta?.files && activeStepIdx === 1) {
      return `Discovered ${repoMeta.files.toLocaleString()} source files — ${phaseMeta.hint.toLowerCase()}`;
    }
    return phaseMeta.hint;
  }, [error, repoMeta, activeStepIdx, phaseMeta]);

  const formattedTime = (elapsedMs / 1000).toFixed(1) + "s";

  const topLanguages = useMemo(() => {
    if (!repoMeta?.languages) return [];
    return Object.keys(repoMeta.languages).slice(0, 3);
  }, [repoMeta]);

  return (
    <motion.div
      className="mf-root"
      data-theme="light"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        backgroundColor: "#ffffff",
        color: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "clamp(20px, 3.2vw, 40px)",
        fontFamily: "var(--mf-font, 'Geist', 'Inter', system-ui, sans-serif)",
        overflowY: "auto",
      }}
    >
      {/* Subtle Monoform dot/grid paper texture */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(to right, rgba(10,10,10,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(10,10,10,0.035) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 65% 55% at 50% 45%, #000 15%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 65% 55% at 50% 45%, #000 15%, transparent 80%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <header
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          maxWidth: 1400,
          margin: "0 auto",
          paddingBottom: 18,
          borderBottom: "1px solid #eaeaea",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              fontWeight: 600,
              fontSize: "1rem",
              letterSpacing: "-0.03em",
              color: "#0a0a0a",
              display: "inline-flex",
              alignItems: "baseline",
            }}
          >
            <span>DevLens</span>
            <span style={{ fontWeight: 400, opacity: 0.45, fontSize: "0.85em" }}>.ai</span>
          </span>

          <span style={{ color: "#d4d4d4", fontSize: "0.875rem" }}>/</span>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px",
              borderRadius: 999,
              border: "1px solid #e5e5e5",
              background: "#fafafa",
              fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
              fontSize: "0.6875rem",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#0a0a0a",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: error ? "#ef4444" : "#10b981",
                boxShadow: error
                  ? "0 0 8px rgba(239, 68, 68, 0.5)"
                  : "0 0 8px rgba(16, 185, 129, 0.5)",
                animation: error ? "none" : "mf-pulse 1.8s ease-in-out infinite",
              }}
            />
            {error ? "Scan Interrupted" : "Indexing Workspace"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
              fontSize: "0.75rem",
              color: "#7a7a7a",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formattedTime}
          </span>

          <button
            type="button"
            onClick={onCancel}
            style={{
              fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
              fontSize: "0.72rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#595959",
              background: "#ffffff",
              border: "1px solid #d9d9d9",
              borderRadius: 999,
              padding: "6px 14px",
              cursor: "pointer",
              transition: "all 0.18s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#0a0a0a";
              e.currentTarget.style.borderColor = "#0a0a0a";
              e.currentTarget.style.background = "#f5f5f5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#595959";
              e.currentTarget.style.borderColor = "#d9d9d9";
              e.currentTarget.style.background = "#ffffff";
            }}
          >
            Cancel ✕
          </button>
        </div>
      </header>

      {/* ── Center Minimalist Stage ─────────────────────────────────────── */}
      <main
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: 640,
          margin: "auto",
          paddingBlock: "clamp(32px, 6vh, 64px)",
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        {/* 1. Repository Identity Block */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
                fontSize: "0.6875rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#8a8a8a",
              }}
            >
              Target Repository
            </span>

            {jobId && (
              <span
                style={{
                  fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
                  fontSize: "0.6875rem",
                  color: "#a3a3a3",
                  letterSpacing: "0.04em",
                }}
              >
                JOB #{jobId.slice(0, 8).toUpperCase()}
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(1.65rem, 3.2vw, 2.35rem)",
                fontWeight: 500,
                letterSpacing: "-0.035em",
                lineHeight: 1.15,
                color: "#0a0a0a",
                wordBreak: "break-word",
              }}
            >
              <span style={{ color: "#8a8a8a", fontWeight: 400 }}>{owner} / </span>
              <span>{repoName}</span>
            </h1>

            {/* Discovered repo metadata pills */}
            {repoMeta && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                {repoMeta.files > 0 && (
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
                      fontSize: "0.6875rem",
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "#f5f5f5",
                      border: "1px solid #e5e5e5",
                      color: "#595959",
                    }}
                  >
                    {repoMeta.files.toLocaleString()} files
                  </span>
                )}
                {topLanguages.length > 0 && (
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
                      fontSize: "0.6875rem",
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "#f5f5f5",
                      border: "1px solid #e5e5e5",
                      color: "#595959",
                    }}
                  >
                    {topLanguages.join(" · ")}
                  </span>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* Hairline Divider */}
        <div style={{ height: 1, background: "#ececec", width: "100%" }} />

        {/* 2. Editorial Phase Display + Large Tabular Percentage */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 24,
              marginBottom: 20,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
                  fontSize: "0.6875rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#10b981",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                PHASE 0{activeStepIdx + 1} OF 0{ Math.max(steps.length, 5) }
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStepIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    fontSize: "clamp(1.75rem, 3.4vw, 2.6rem)",
                    fontWeight: 500,
                    letterSpacing: "-0.04em",
                    lineHeight: 1.08,
                    color: "#0a0a0a",
                  }}
                >
                  {phaseMeta.lead}{" "}
                  <span
                    className="mf-serif-i"
                    style={{
                      fontFamily: "'Newsreader', 'Instrument Serif', Georgia, serif",
                      fontStyle: "italic",
                      fontWeight: 400,
                      color: "#595959",
                    }}
                  >
                    {phaseMeta.serif}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Minimalist Tabular Percentage */}
            <div
              style={{
                fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
                fontSize: "clamp(2.25rem, 4.2vw, 3.25rem)",
                fontWeight: 500,
                letterSpacing: "-0.05em",
                lineHeight: 1,
                color: "#0a0a0a",
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {progressPct.toString().padStart(2, "0")}
              <span style={{ fontSize: "0.5em", color: "#8a8a8a", marginLeft: 2 }}>%</span>
            </div>
          </div>

          {/* 3. Precision Segmented Progress Rail */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.max(steps.length, 5)}, 1fr)`,
              gap: 6,
              width: "100%",
              marginBottom: 14,
            }}
          >
            {(steps.length > 0 ? steps : EDITORIAL_PHASES.map((p) => ({ label: p.short, status: "pending" as const }))).map(
              (step, idx) => {
                const isDone = step.status === "done" || idx < activeStepIdx || progressPct >= 100;
                const isActive = idx === activeStepIdx && !isDone;

                // Calculate smooth intra-segment fill for the active segment
                const segSize = 100 / Math.max(steps.length, 5);
                const segStart = idx * segSize;
                const activeFillPct = isActive
                  ? Math.min(100, Math.max(18, ((progressPct - segStart) / segSize) * 100))
                  : isDone
                    ? 100
                    : 0;

                return (
                  <div
                    key={step.label || idx}
                    style={{
                      height: 4,
                      borderRadius: 999,
                      background: "#ededed",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${activeFillPct}%` }}
                      transition={{ type: "spring", stiffness: 160, damping: 24 }}
                      style={{
                        height: "100%",
                        borderRadius: 999,
                        background: error && isActive ? "#ef4444" : "#0a0a0a",
                      }}
                    />
                  </div>
                );
              }
            )}
          </div>

          {/* 4. Minimal Horizontal Step Strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.max(steps.length, 5)}, 1fr)`,
              gap: 6,
              width: "100%",
            }}
          >
            {(steps.length > 0 ? steps : EDITORIAL_PHASES.map((p) => ({ label: p.short, status: "pending" as const }))).map(
              (step, idx) => {
                const isDone = step.status === "done" || idx < activeStepIdx || progressPct >= 100;
                const isActive = idx === activeStepIdx && !isDone;
                const shortName = EDITORIAL_PHASES[idx]?.short ?? step.label;

                return (
                  <div
                    key={step.label || idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
                      fontSize: "0.6875rem",
                      color: isDone ? "#0a0a0a" : isActive ? "#0a0a0a" : "#a3a3a3",
                      fontWeight: isActive ? 600 : 400,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <span style={{ color: isDone ? "#10b981" : isActive ? "#0a0a0a" : "#c4c4c4" }}>
                      {isDone ? "✓" : `0${idx + 1}`}
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{shortName}</span>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* 5. Quiet Single-Line Status Whisper */}
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: "#fafafa",
            border: "1px solid #eeeeee",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={statusWhisper}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.18 }}
              style={{
                fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
                fontSize: "0.75rem",
                color: "#595959",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <span style={{ color: "#10b981", marginRight: 8 }}>→</span>
              {statusWhisper}
            </motion.div>
          </AnimatePresence>

          <span
            style={{
              fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
              fontSize: "0.65rem",
              color: "#a3a3a3",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            LIVE
          </span>
        </div>

        {/* 6. Clean Error Banner (Only when error occurs) */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              style={{
                padding: "18px 20px",
                borderRadius: 14,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <span>⚠ Analysis Interrupted</span>
              </div>
              <div style={{ fontSize: "0.875rem", color: "#7f1d1d", lineHeight: 1.5 }}>{error}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 999,
                      background: "#0a0a0a",
                      color: "#ffffff",
                      border: "1px solid #0a0a0a",
                      fontSize: "0.78rem",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Retry Analysis ↻
                  </button>
                )}
                <button
                  type="button"
                  onClick={onCancel}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 999,
                    background: "#ffffff",
                    color: "#0a0a0a",
                    border: "1px solid #d4d4d4",
                    fontSize: "0.78rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Back to Dashboard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Minimalist SaaS Footer ──────────────────────────────────────── */}
      <footer
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          maxWidth: 1400,
          margin: "0 auto",
          paddingTop: 16,
          borderTop: "1px solid #eaeaea",
          fontFamily: "var(--mf-mono, 'IBM Plex Mono', monospace)",
          fontSize: "0.6875rem",
          letterSpacing: "0.05em",
          color: "#8a8a8a",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span>EPHEMERAL WORKTREE · ZERO CODE RETENTION</span>
        <span>AST ENGINE // TREE-SITTER</span>
      </footer>
    </motion.div>
  );
}
