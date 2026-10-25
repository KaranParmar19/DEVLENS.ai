import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
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
  onOpen: (repoUrl: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}

/**
 * CurvyShowcase
 * Smooth horizontal sliding carousel with 3D concave ribbon wave.
 * High-performance 1:1 pointer dragging, flick inertia, and automatic snap.
 */
export function CurvyShowcase({
  entries,
  onOpen,
  onDelete,
  className = "",
}: CurvyShowcaseProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [stageWidth, setStageWidth] = useState(1000);
  const [activeIndex, setActiveIndex] = useState(0);

  // Position & physics state (refs for 60/120fps direct GPU updates without React re-render)
  const currentScroll = useRef(0);
  const targetScroll = useRef(0);
  const animRaf = useRef<number | null>(null);

  // Drag interaction tracking
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);
  const hasMoved = useRef(false);
  const wheelTimer = useRef<number | null>(null);
  const activeIndexRef = useRef(0);

  const count = entries.length;
  const cardWidth = Math.min(360, Math.max(280, stageWidth * 0.32));
  const gap = 24;
  const stride = cardWidth + gap;

  // Max scroll bounds: allows scrolling until the last card reaches the end
  const totalContentWidth = count * stride - gap;
  const maxScroll = Math.max(0, totalContentWidth - stageWidth + 36);

  // Direct GPU DOM transform calculation (Framer Curvy Concave Ribbon)
  const applyTransforms = useCallback(
    (scroll: number) => {
      const stageCenter = stageWidth / 2;
      const halfSpan = Math.max(stageWidth * 0.52, 300);

      cardRefs.current.forEach((el, idx) => {
        if (!el) return;

        // Position of this card relative to the viewport
        const cardX = idx * stride - scroll + 16;
        const cardCenterPos = cardX + cardWidth / 2;
        const lx = cardCenterPos - stageCenter;

        // Normalized distance from center [-1.3, 1.3]
        const t = Math.max(-1.3, Math.min(1.3, lx / halfSpan));
        const absT = Math.abs(t);

        // Curvy Concave 3D Bowl Wave formula
        const scale = Math.max(0.88, 1.02 - 0.08 * (absT * absT));
        const rotateY = -t * 11;
        const rotateX = Math.min(1, absT * absT) * 2;
        const translateY = Math.min(1.2, absT * absT) * 14;
        const translateZ = -absT * 28;
        const opacity = Math.max(0.35, 1 - Math.max(0, absT - 0.8) * 1.5);

        el.style.transform = `translate3d(${cardX}px, ${translateY}px, ${translateZ}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) scale(${scale})`;
        el.style.opacity = `${opacity}`;
        el.style.zIndex = `${Math.round(100 - absT * 40)}`;
      });
    },
    [cardWidth, stageWidth, stride]
  );

  // Update active index indicator cleanly without re-rendering transforms
  const updateActiveIndex = useCallback(
    (scroll: number) => {
      const nearest = Math.max(0, Math.min(count - 1, Math.round(scroll / stride)));
      if (nearest !== activeIndexRef.current) {
        activeIndexRef.current = nearest;
        setActiveIndex(nearest);
      }
    },
    [count, stride]
  );

  // Smooth spring lerp animation loop
  const animateTo = useCallback(
    (target: number) => {
      if (animRaf.current) cancelAnimationFrame(animRaf.current);
      targetScroll.current = Math.max(0, Math.min(maxScroll, target));

      const step = () => {
        const diff = targetScroll.current - currentScroll.current;
        if (Math.abs(diff) < 0.25) {
          currentScroll.current = targetScroll.current;
          applyTransforms(currentScroll.current);
          updateActiveIndex(currentScroll.current);
          animRaf.current = null;
          return;
        }

        // Silky spring easing
        currentScroll.current += diff * 0.15;
        applyTransforms(currentScroll.current);
        updateActiveIndex(currentScroll.current);
        animRaf.current = requestAnimationFrame(step);
      };

      animRaf.current = requestAnimationFrame(step);
    },
    [applyTransforms, maxScroll, updateActiveIndex]
  );

  // Scroll to a specific card index
  const scrollToCard = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(count - 1, index));
      const target = Math.min(maxScroll, clamped * stride);
      animateTo(target);
    },
    [animateTo, count, maxScroll, stride]
  );

  // Measure stage width on mount and resize
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const measure = () => {
      setStageWidth(el.offsetWidth);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Update card transforms when dimensions or count change
  useEffect(() => {
    applyTransforms(currentScroll.current);
  }, [applyTransforms, stageWidth, count]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animRaf.current) cancelAnimationFrame(animRaf.current);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
    };
  }, []);

  // Pointer drag interaction handlers
  const onPointerDown = (e: React.PointerEvent) => {
    // Prevent dragging when clicking a remove/delete button
    if ((e.target as HTMLElement).closest(".mf-kbd, button[aria-label]")) return;

    if (animRaf.current) {
      cancelAnimationFrame(animRaf.current);
      animRaf.current = null;
    }

    isDragging.current = true;
    hasMoved.current = false;
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastTime.current = performance.now();
    startScroll.current = currentScroll.current;
    velocity.current = 0;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;

    const deltaX = e.clientX - startX.current;
    if (Math.abs(deltaX) > 6) {
      hasMoved.current = true;
    }

    const now = performance.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
      velocity.current = ((lastX.current - e.clientX) / dt) * 16;
    }
    lastX.current = e.clientX;
    lastTime.current = now;

    // Direct 1:1 position tracking with rubber-band edge resistance
    let next = startScroll.current - deltaX;
    if (next < 0) {
      next = next * 0.32;
    } else if (next > maxScroll) {
      next = maxScroll + (next - maxScroll) * 0.32;
    }

    currentScroll.current = next;
    applyTransforms(next);
    updateActiveIndex(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    // Toss projection based on drag velocity
    let projected = currentScroll.current;
    if (Math.abs(velocity.current) > 1.2) {
      projected += velocity.current * 18;
    }

    // Snap to nearest card stride
    const nearestCard = Math.round(projected / stride);
    const snapTarget = Math.max(0, Math.min(maxScroll, nearestCard * stride));
    animateTo(snapTarget);
  };

  // Smooth wheel & trackpad horizontal scrolling
  const onWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 2) return;

    if (animRaf.current) {
      cancelAnimationFrame(animRaf.current);
      animRaf.current = null;
    }

    let next = currentScroll.current + delta * 0.85;
    next = Math.max(-20, Math.min(maxScroll + 20, next));
    currentScroll.current = next;
    applyTransforms(next);
    updateActiveIndex(next);

    // Debounced snap to nearest card when wheel ends
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => {
      const nearestCard = Math.round(currentScroll.current / stride);
      const snapTarget = Math.max(0, Math.min(maxScroll, nearestCard * stride));
      animateTo(snapTarget);
    }, 140);
  };

  if (count === 0) return null;

  return (
    <div className={`curvy-showcase-root ${className}`}>
      {/* Top ribbon bar: Showing counter (Arrow buttons removed as requested) */}
      <div className="curvy-showcase-bar">
        <div className="curvy-showcase-counter">
          <span className="mf-mono" style={{ fontSize: "0.75rem", color: "var(--mf-ink-3)" }}>
            SHOWING <strong>{activeIndex + 1}</strong> OF <strong>{count}</strong> REPOSITORIES
          </span>
        </div>
      </div>

      {/* 3D Curvy Concave Ribbon Stage */}
      <div
        ref={stageRef}
        className="curvy-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        style={{
          perspective: 1200,
          perspectiveOrigin: "50% 50%",
        }}
      >
        <div className="curvy-track">
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
              entry.status === "complete" ? 100 : entry.status === "failed" ? 0 : 55;

            const isCurrent = idx === activeIndex;

            return (
              <div
                key={entry.id}
                ref={(el) => {
                  cardRefs.current[idx] = el;
                }}
                className="curvy-card-slot"
                style={{
                  width: cardWidth,
                }}
              >
                <motion.div
                  className={`curvy-repo-card ${isCurrent ? "is-active" : ""}`}
                  onClick={(e) => {
                    // Prevent accidental clicks if the user dragged
                    if (hasMoved.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    onOpen(entry.repoUrl);
                  }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
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
                              : undefined
                        }
                      />
                      {entry.status}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove repository"
                      className="mf-kbd"
                      style={{ cursor: "pointer", transition: "all 0.15s" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(entry.id);
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
                      <span>ANALYZED {timeAgo(entry.analyzedAt).toUpperCase()}</span>
                      {sizeFormatted && <span>· {sizeFormatted}</span>}
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="curvy-card-foot">
                    <div className="mf-bar">
                      <i
                        style={{
                          width: `${pct}%`,
                          background: entry.status === "failed" ? "#ef4444" : "var(--mf-ink)",
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
                        <span>📄</span> {files ? `${files.toLocaleString()} FILES` : "— FILES"}
                      </span>

                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {langs.map((lang) => (
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
                                background: LANG_COLORS[lang] || "#888888",
                              }}
                            />
                            {lang.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress Dots / Breadcrumbs */}
      {count > 1 && (
        <div className="curvy-dots">
          {entries.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`curvy-dot ${i === activeIndex ? "is-active" : ""}`}
              onClick={() => scrollToCard(i)}
              aria-label={`Jump to repository ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
