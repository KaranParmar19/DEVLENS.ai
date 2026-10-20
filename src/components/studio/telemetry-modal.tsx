import { useEffect, useRef, useState } from "react";
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
  onBypass?: () => void;
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
  onBypass,
}: TelemetryModalProps) {
  const repoLabel = repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\.git$/, "");
  const [logs, setLogs] = useState<Array<{ time: string; text: string }>>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const loggedSteps = useRef<Set<string>>(new Set());

  // Derive active step index
  const activeStepIdx = steps.findIndex((s) => s.status === "active");
  const currentStep = activeStepIdx >= 0 ? steps[activeStepIdx] : steps[steps.length - 1];

  useEffect(() => {
    const pushLog = (key: string, text: string) => {
      if (loggedSteps.current.has(key)) return;
      loggedSteps.current.add(key);
      const time = new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLogs((prev) => [...prev, { time, text }].slice(-16));
    };

    if (activeStepIdx >= 0 && currentStep) {
      pushLog(`step-${activeStepIdx}`, `[${progressPct}%] ${currentStep.label}...`);
    }

    if (jobId && !loggedSteps.current.has("job-init")) {
      pushLog("job-init", `Initialized pipeline worker node ${jobId.slice(0, 8)}`);
    }

    if (repoMeta?.files && !loggedSteps.current.has("files-found")) {
      pushLog("files-found", `Discovered ${repoMeta.files.toLocaleString()} source files`);
    }

    if (repoMeta?.languages && Object.keys(repoMeta.languages).length > 0 && !loggedSteps.current.has("langs-found")) {
      const topLangs = Object.keys(repoMeta.languages).slice(0, 4).join(", ");
      pushLog("langs-found", `Language spectra detected: [${topLangs}]`);
    }
  }, [activeStepIdx, currentStep, progressPct, jobId, repoMeta]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        backgroundColor: "#070709",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "clamp(24px, 4vw, 48px)",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        overflow: "hidden",
      }}
    >
      {/* Background architectural grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          pointerEvents: "none",
          opacity: 0.6,
        }}
      />

      {/* Top Header */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          paddingBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#ffffff",
              boxShadow: "0 0 12px rgba(255,255,255,0.8)",
              animation: "mf-pulse 1.8s infinite ease-in-out",
            }}
          />
          <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.8125rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            DevLens // Ingestion Pipeline
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onBypass && (
            <button
              type="button"
              onClick={onBypass}
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.75rem",
                color: "#000000",
                background: "#ffffff",
                border: "1px solid #ffffff",
                borderRadius: 999,
                padding: "6px 14px",
                cursor: "pointer",
                fontWeight: 600,
                transition: "all 0.2s",
              }}
            >
              Bypass to Studio ↗
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.6)",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 999,
              padding: "6px 14px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#ffffff";
              e.currentTarget.style.borderColor = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.6)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
            }}
          >
            Cancel Scan ✕
          </button>
        </div>
      </div>

      {/* Center Stage: Hero Metrics & Checklist */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "clamp(32px, 6vw, 80px)",
          alignItems: "center",
          maxWidth: 1300,
          width: "100%",
          margin: "0 auto",
        }}
      >
        {/* Left Column: Huge Progress & Repo */}
        <div>
          <span
            style={{
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
              display: "block",
              marginBottom: 12,
            }}
          >
            Target Repository
          </span>
          <h1
            style={{
              fontSize: "clamp(2rem, 4.5vw, 4rem)",
              fontWeight: 500,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              wordBreak: "break-all",
              marginBottom: 32,
            }}
          >
            {repoLabel}
          </h1>

          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "clamp(4.5rem, 9vw, 8rem)",
                fontWeight: 600,
                letterSpacing: "-0.06em",
                lineHeight: 0.9,
              }}
            >
              {progressPct.toString().padStart(2, "0")}%
            </span>
            <span style={{ fontFamily: "var(--mf-mono, monospace)", fontSize: "0.875rem", color: "rgba(255,255,255,0.5)" }}>
              // INDEXING
            </span>
          </div>

          {/* Progress Bar Line */}
          <div
            style={{
              width: "100%",
              height: 3,
              background: "rgba(255,255,255,0.1)",
              borderRadius: 2,
              marginTop: 24,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: "100%",
                background: error ? "#ef4444" : "#ffffff",
                boxShadow: error ? "0 0 16px rgba(239,68,68,0.8)" : "0 0 16px rgba(255,255,255,0.8)",
                transition: "width 400ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>

          {/* Analysis Error Alert */}
          {error && (
            <div
              style={{
                marginTop: 20,
                padding: "16px 20px",
                borderRadius: 12,
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#fca5a5",
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.8125rem",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                <span>⚠</span>
                <span>Analysis Issue Detected:</span>
              </div>
              <div style={{ color: "#ffffff", opacity: 0.9, lineHeight: 1.45 }}>{error}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      background: "#ffffff",
                      color: "#000000",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      border: "none",
                    }}
                  >
                    Retry Analysis
                  </button>
                )}
                {onBypass && (
                  <button
                    type="button"
                    onClick={onBypass}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      background: "transparent",
                      color: "#ffffff",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      fontWeight: 500,
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    Open in Studio Mode ↗
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Direct Bypass Button */}
          {onBypass && (
            <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                onClick={onBypass}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 18px",
                  borderRadius: 999,
                  background: "#ffffff",
                  color: "#000000",
                  border: "1px solid #ffffff",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span>⚡ Bypass Ingestion & Explore Studio Workspace</span>
                <span>↗</span>
              </button>
              <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", fontFamily: "var(--mf-mono, monospace)" }}>
                (Backend offline mode)
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Step Checklist & Terminal Log */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Steps Checklist */}
          <div
            style={{
              background: "#111114",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: "24px 28px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.45)",
                marginBottom: 16,
              }}
            >
              Pipeline Stages
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {steps.map((step, idx) => {
                const isDone = step.status === "done";
                const isActive = step.status === "active";
                return (
                  <div
                    key={step.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "0.9375rem",
                      color: isDone ? "#ffffff" : isActive ? "#ffffff" : "rgba(255,255,255,0.4)",
                      fontWeight: isActive ? 500 : 400,
                      transition: "color 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span
                        style={{
                          fontFamily: "var(--mf-mono, monospace)",
                          fontSize: "0.75rem",
                          color: isDone || isActive ? "#ffffff" : "rgba(255,255,255,0.3)",
                        }}
                      >
                        0{idx + 1}
                      </span>
                      <span>{step.label}</span>
                    </div>

                    <span
                      style={{
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "0.6875rem",
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid",
                        borderColor: isDone ? "rgba(255,255,255,0.3)" : isActive ? "#ffffff" : "rgba(255,255,255,0.1)",
                        background: isActive ? "#ffffff" : "transparent",
                        color: isActive ? "#000000" : isDone ? "#ffffff" : "rgba(255,255,255,0.3)",
                        textTransform: "uppercase",
                      }}
                    >
                      {isDone ? "Done" : isActive ? "Active" : "Wait"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Micro Terminal Log */}
          <div
            ref={logContainerRef}
            style={{
              background: "#0c0c0f",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "16px 20px",
              height: 140,
              overflowY: "auto",
              fontFamily: "var(--mf-mono, monospace)",
              fontSize: "0.75rem",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.65)",
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.3)" }}>Listening to worker stream...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{ display: "flex", gap: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{log.time}</span>
                  <span style={{ color: i === logs.length - 1 ? "#ffffff" : "rgba(255,255,255,0.7)" }}>{log.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Telemetry Footer */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingTop: 16,
          fontSize: "0.75rem",
          fontFamily: "var(--mf-mono, monospace)",
          color: "rgba(255,255,255,0.45)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span>STATUS: STREAMING_AST_GRAPH</span>
        <span>SECURITY: EPHEMERAL_WORKTREE</span>
        <span>LATENCY: &lt;14MS</span>
      </div>
    </div>
  );
}
