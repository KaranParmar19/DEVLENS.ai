import React, { useRef, useState, useEffect } from "react";
import type { RepoHistoryEntry } from "@/lib/repo-history";

export const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f7df1e",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Ruby: "#701516",
  Java: "#b07219",
  PHP: "#4F5D95",
  HTML: "#e34c26",
  CSS: "#563d7c",
  PLpgSQL: "#336791",
  PLPGSQL: "#336791",
  SQL: "#e38c00",
  Shell: "#89e051",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Vue: "#41b883",
  Svelte: "#ff3e00",
};

export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export interface CurvyShowcaseProps {
  entries: RepoHistoryEntry[];
  onOpen: (entry: RepoHistoryEntry) => void;
  onDelete: (entry: RepoHistoryEntry) => void;
  className?: string;
}

export function CurvyShowcase({
  entries,
  onOpen,
  onDelete,
  className = "",
}: CurvyShowcaseProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const count = entries.length;

  const updateScrollState = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);

    const cardStride = 362;
    const idx = Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / cardStride)));
    setCurrentIndex(idx);
  };

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [count]);

  const scrollByAmount = (offset: number) => {
    if (!trackRef.current) return;
    trackRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  if (count === 0) return null;

  return (
    <div className={`curvy-showcase-root ${className}`}>
      {/* Top Bar: Counter & Quick Arrow Navigation */}
      <div className="curvy-showcase-bar">
        <div className="curvy-showcase-counter">
          <span className="mf-mono" style={{ fontSize: "0.75rem", color: "var(--mf-ink-3)" }}>
            Showing <strong>{currentIndex + 1}</strong> of <strong>{count}</strong> repositories
          </span>
        </div>

        {count > 1 && (
          <div className="curvy-showcase-arrows">
            <button
              type="button"
              className="curvy-nav-btn"
              onClick={() => scrollByAmount(-362)}
              disabled={!canScrollLeft}
              aria-label="Previous repository"
            >
              ←
            </button>
            <button
              type="button"
              className="curvy-nav-btn"
              onClick={() => scrollByAmount(362)}
              disabled={!canScrollRight}
              aria-label="Next repository"
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Clean Horizontal Track */}
      <div className="curvy-stage">
        <div ref={trackRef} className="curvy-track">
          {entries.map((entry, idx) => {
            const langs = Object.keys(entry.meta?.languages ?? {}).slice(0, 3);
            const files = entry.meta?.files ?? 0;
            const sizeKb = entry.meta?.sizeKb ?? 0;
            const sizeFormatted =
              sizeKb > 1024
                ? `${(sizeKb / 1024).toFixed(1)} MB`
                : sizeKb
                  ? `${sizeKb} KB`
                  : null;
            const pct =
              entry.status === "complete" ? 100 : entry.status === "failed" ? 100 : 55;

            return (
              <div
                key={entry.id || `${entry.repoLabel}-${idx}`}
                className="curvy-card-slot"
              >
                <div
                  className="curvy-repo-card"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open repository workspace for ${entry.repoLabel}`}
                  onClick={() => onOpen(entry)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(entry);
                    }
                  }}
                >
                  {/* Top Bar: Status Badge + Delete Button */}
                  <div className="curvy-card-top">
                    <span className="mf-pill">
                      <span
                        className={`mf-dot ${entry.status === "complete" ? "live" : ""}`}
                        style={
                          entry.status === "complete"
                            ? { background: "#10b981" }
                            : entry.status === "failed"
                              ? { background: "#ef4444" }
                              : { background: "#f59e0b" }
                        }
                      />
                      {entry.status === "complete"
                        ? "Indexed"
                        : entry.status === "failed"
                          ? "Failed"
                          : "Indexing"}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${entry.repoLabel} from history`}
                      className="dx-card-remove-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete(entry);
                      }}
                      title="Remove from history"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Repo Title & Analyzed Time */}
                  <div className="curvy-card-body">
                    <div
                      className="mf-h3"
                      style={{
                        wordBreak: "break-all",
                        fontSize: "1.125rem",
                        fontWeight: 600,
                        lineHeight: 1.3,
                      }}
                    >
                      {entry.repoLabel}
                    </div>
                    <div
                      className="mf-mono mf-muted"
                      style={{
                        marginTop: 6,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        fontSize: "0.6875rem",
                      }}
                    >
                      <span>Indexed {timeAgo(entry.analyzedAt)}</span>
                      {sizeFormatted && <span>· {sizeFormatted}</span>}
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="curvy-card-foot">
                    <div className="mf-bar">
                      <i
                        style={{
                          width: `${pct}%`,
                          background:
                            entry.status === "failed"
                              ? "#ef4444"
                              : entry.status === "indexing"
                                ? "#f59e0b"
                                : "#000000",
                        }}
                      />
                    </div>

                    {/* Bottom Metadata: File Count & Languages */}
                    <div className="curvy-card-meta">
                      <span
                        className="mf-mono mf-muted"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: "0.6875rem",
                        }}
                      >
                        {files ? `${files.toLocaleString()} files` : "File count pending"}
                      </span>

                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {langs.map((lang) => {
                          const langKey =
                            Object.keys(LANG_COLORS).find(
                              (k) => k.toLowerCase() === lang.toLowerCase()
                            ) || lang;
                          return (
                            <span
                              key={lang}
                              className="mf-mono"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: "0.625rem",
                                color: "var(--mf-ink-2)",
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: LANG_COLORS[langKey] || "#888888",
                                }}
                              />
                              {lang}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
