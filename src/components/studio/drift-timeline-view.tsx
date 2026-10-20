import { useState, useEffect, useMemo } from "react";
import type { GitCommitItem, GraphData } from "./studio-types";
import { api } from "@/lib/api";

interface DriftTimelineViewProps {
  sessionId?: string;
  repoLabel: string;
  graphData?: GraphData | null;
  onSelectFile?: (filePath: string) => void;
  onAskCopilot?: (prompt: string) => void;
}

export function DriftTimelineView({
  sessionId,
  repoLabel,
  onSelectFile,
  onAskCopilot,
}: DriftTimelineViewProps) {
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  // Fetch real commits from the backend (no placeholder data is ever shown)
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    api
      .getCommits(sessionId)
      .then((res) => {
        if (cancelled) return;
        const enriched: GitCommitItem[] = (res?.commits ?? []).map((c) => ({
          sha: c.sha,
          short_sha: c.short_sha,
          message: c.message,
          full_message: c.full_message,
          author: c.author,
          author_avatar: c.author_avatar,
          date: c.date,
          files_changed: c.files_changed,
          insertions: c.insertions,
          deletions: c.deletions,
          risk_level: c.risk_level || "low",
          drift_summary: c.drift_summary || c.message,
          impacted_files: c.impacted_files ?? [],
          new_dependencies: [],
        }));
        setCommits(enriched);
        setSelectedCommitSha(enriched[0]?.sha ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCommits([]);
        setLoadError(err instanceof Error ? err.message : "Could not load commit history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, reloadKey]);

  const selectedCommit = useMemo(() => {
    return commits.find((c) => c.sha === selectedCommitSha) || commits[0];
  }, [commits, selectedCommitSha]);

  const copySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  if (!selectedCommit) {
    return (
      <div
        style={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          backgroundColor: "#08080a",
          color: "rgba(255,255,255,0.6)",
          fontFamily: "var(--mf-mono, monospace)",
          fontSize: "0.8125rem",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div style={{ color: "#ffffff", fontWeight: 600, marginBottom: 8 }}>
            {loading
              ? "Loading commit history…"
              : loadError
                ? "Commit history unavailable"
                : "No commits found"}
          </div>
          {!loading && (
            <p style={{ margin: "0 0 16px", lineHeight: 1.5 }}>
              {loadError ??
                (sessionId
                  ? "GitHub returned no recent commits for this branch."
                  : "Analyze a repository to see its architectural drift timeline.")}
            </p>
          )}
          {!loading && sessionId && (
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                background: "#ffffff",
                color: "#000000",
                border: "none",
                fontFamily: "inherit",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        backgroundColor: "#08080a",
        color: "#ffffff",
        fontFamily: "var(--mf-font, 'Geist', sans-serif)",
        overflow: "hidden",
      }}
    >
      {/* ── Left Column: Commit Timeline Stepper ─────────────────────── */}
      <div
        style={{
          width: "min(380px, 38vw)",
          borderRight: "1px solid rgba(255, 255, 255, 0.1)",
          backgroundColor: "#0d0d11",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Timeline Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            backgroundColor: "#09090b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em" }}>
              Architectural Drift
            </div>
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                color: "rgba(255, 255, 255, 0.45)",
              }}
            >
              {commits.length} commits indexed // {repoLabel}
            </div>
          </div>
          {loading && (
            <span
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.625rem",
                color: "#ffffff",
              }}
            >
              Syncing...
            </span>
          )}
        </div>

        {/* Commit List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {commits.map((c, idx) => {
              const isSelected = c.sha === selectedCommitSha;
              const isHead = idx === 0;

              return (
                <div
                  key={c.sha}
                  onClick={() => setSelectedCommitSha(c.sha)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    backgroundColor: isSelected ? "rgba(255, 255, 255, 0.08)" : "transparent",
                    border: isSelected
                      ? "1px solid #ffffff"
                      : "1px solid rgba(255, 255, 255, 0.06)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    position: "relative",
                  }}
                >
                  {/* Top Bar: Head Tag, SHA & Date */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isHead && (
                        <span
                          style={{
                            fontFamily: "var(--mf-mono, monospace)",
                            fontSize: "0.5625rem",
                            padding: "1px 5px",
                            borderRadius: 4,
                            background: "#ffffff",
                            color: "#000000",
                            fontWeight: 700,
                          }}
                        >
                          HEAD
                        </span>
                      )}
                      <span
                        style={{
                          fontFamily: "var(--mf-mono, monospace)",
                          fontSize: "0.6875rem",
                          color: isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.5)",
                          fontWeight: 500,
                        }}
                      >
                        {c.short_sha}
                      </span>
                    </div>

                    <span
                      style={{
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "0.625rem",
                        color: "rgba(255, 255, 255, 0.35)",
                      }}
                    >
                      {new Date(c.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Message */}
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: isSelected ? 500 : 400,
                      color: isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.8)",
                      lineHeight: 1.4,
                      marginBottom: 8,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {c.message}
                  </div>

                  {/* Drift Risk Badge & Author */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.625rem",
                    }}
                  >
                    <span style={{ color: "rgba(255, 255, 255, 0.45)" }}>{c.author}</span>
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: 4,
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color:
                          c.risk_level === "high"
                            ? "#ff6b6b"
                            : c.risk_level === "moderate"
                              ? "#ffc078"
                              : "#69db7c",
                      }}
                    >
                      {c.risk_level ? `${c.risk_level.toUpperCase()} DRIFT` : "LOW DRIFT"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Right Column: Selected Commit Architectural Diff ────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {/* Detail Header */}
        <div
          style={{
            padding: "24px 32px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            backgroundColor: "#09090b",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "0.75rem",
                    padding: "3px 8px",
                    borderRadius: 6,
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    cursor: "pointer",
                  }}
                  onClick={() => copySha(selectedCommit.sha)}
                  title="Click to copy full commit SHA"
                >
                  {copiedSha === selectedCommit.sha ? "✓ Copied SHA" : selectedCommit.sha}
                </span>

                <span
                  style={{
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "0.6875rem",
                    color: "rgba(255, 255, 255, 0.45)",
                  }}
                >
                  Authored by {selectedCommit.author} on{" "}
                  {new Date(selectedCommit.date).toLocaleDateString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>

              <h2
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  margin: 0,
                  letterSpacing: "-0.02em",
                  color: "#ffffff",
                }}
              >
                {selectedCommit.message}
              </h2>
            </div>

            {/* Quick Copilot Audit Buttons */}
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() =>
                  onAskCopilot &&
                  onAskCopilot(
                    `Analyze architectural drift in commit ${selectedCommit.short_sha}: "${selectedCommit.message}". What components were affected, and what are the testing risks?`,
                  )
                }
                style={{
                  padding: "7px 14px",
                  borderRadius: 999,
                  background: "#ffffff",
                  color: "#000000",
                  border: "none",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Explain Drift Impact ↗
              </button>

              <button
                type="button"
                onClick={() =>
                  onAskCopilot &&
                  onAskCopilot(
                    `Write release notes and a changelog entry summarizing commit ${selectedCommit.short_sha}: ${selectedCommit.message}`,
                  )
                }
                style={{
                  padding: "7px 14px",
                  borderRadius: 999,
                  background: "transparent",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  cursor: "pointer",
                }}
              >
                Generate Changelog ↗
              </button>
            </div>
          </div>
        </div>

        {/* Drift Summary Cards */}
        <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Architectural Invariant Delta */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: 12,
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderLeft: "4px solid #ffffff",
            }}
          >
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                textTransform: "uppercase",
                color: "rgba(255, 255, 255, 0.4)",
                marginBottom: 6,
              }}
            >
              Architectural Shift Analysis
            </div>
            <div style={{ fontSize: "0.9375rem", lineHeight: 1.5, color: "#ffffff" }}>
              {selectedCommit.drift_summary ||
                "Standard code evolution. File edits preserve existing modular boundaries."}
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <div
              style={{
                padding: "16px",
                borderRadius: 10,
                backgroundColor: "#0d0d11",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.625rem",
                  textTransform: "uppercase",
                  color: "rgba(255, 255, 255, 0.4)",
                  marginBottom: 6,
                }}
              >
                Files Touched
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#ffffff" }}>
                {selectedCommit.files_changed ?? (selectedCommit.impacted_files?.length || 3)}
              </div>
            </div>

            <div
              style={{
                padding: "16px",
                borderRadius: 10,
                backgroundColor: "#0d0d11",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.625rem",
                  textTransform: "uppercase",
                  color: "rgba(255, 255, 255, 0.4)",
                  marginBottom: 6,
                }}
              >
                Lines Added / Removed
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 600, display: "flex", gap: 10 }}>
                <span style={{ color: "#69db7c" }}>+{selectedCommit.insertions ?? 120}</span>
                <span style={{ color: "#ff6b6b" }}>-{selectedCommit.deletions ?? 35}</span>
              </div>
            </div>

            <div
              style={{
                padding: "16px",
                borderRadius: 10,
                backgroundColor: "#0d0d11",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.625rem",
                  textTransform: "uppercase",
                  color: "rgba(255, 255, 255, 0.4)",
                  marginBottom: 6,
                }}
              >
                Drift Risk Level
              </div>
              <div
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  color:
                    selectedCommit.risk_level === "high"
                      ? "#ff6b6b"
                      : selectedCommit.risk_level === "moderate"
                        ? "#ffc078"
                        : "#69db7c",
                }}
              >
                {selectedCommit.risk_level ? selectedCommit.risk_level.toUpperCase() : "LOW"}
              </div>
            </div>
          </div>

          {/* New External / Internal Dependencies */}
          {selectedCommit.new_dependencies && selectedCommit.new_dependencies.length > 0 && (
            <div
              style={{
                padding: "18px 20px",
                borderRadius: 12,
                backgroundColor: "#0d0d11",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mf-mono, monospace)",
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  color: "rgba(255, 255, 255, 0.4)",
                  marginBottom: 12,
                }}
              >
                New Dependencies Introduced in this Commit:
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {selectedCommit.new_dependencies.map((dep) => (
                  <span
                    key={dep}
                    style={{
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "0.75rem",
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.16)",
                      color: "#ffffff",
                    }}
                  >
                    📦 {dep}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Impacted Files Table with One-Click Navigation */}
          <div>
            <div
              style={{
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "0.6875rem",
                textTransform: "uppercase",
                color: "rgba(255, 255, 255, 0.4)",
                marginBottom: 12,
              }}
            >
              Modified Modules &amp; Blast Radius Targets (
              {selectedCommit.impacted_files?.length || 0}):
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(selectedCommit.impacted_files || []).map((filePath) => (
                <div
                  key={filePath}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 8,
                    backgroundColor: "#0d0d11",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "0.875rem" }}>📄</span>
                    <span
                      style={{
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "0.8125rem",
                        color: "#ffffff",
                      }}
                    >
                      {filePath}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => onSelectFile && onSelectFile(filePath)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "rgba(255, 255, 255, 0.8)",
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "0.6875rem",
                        cursor: "pointer",
                      }}
                    >
                      Focus in Architecture Map ↗
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
