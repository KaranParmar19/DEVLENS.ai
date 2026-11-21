import React, { useState, useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

/* ───────────────────────── Plumbline Math & Swell ───────────────────────── */
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smoothstep cubic curve: t * t * (3 - 2 * t) */
const swell = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Proximity metric to continuous pos */
const nearness = (index: number, currentPos: number) => swell(1 - Math.abs(index - currentPos));

export const PLUMBLINE_STEPS = [
  {
    id: "ingest",
    step: "01",
    marker: "01",
    title: "Paste a repo",
  },
  {
    id: "parse",
    step: "02",
    marker: "02",
    title: "Tree-sitter parses it",
  },
  {
    id: "interrogate",
    step: "03",
    marker: "03",
    title: "Inspect and ask questions",
  },
];

export function PlumblinePipeline() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = useRef(0);
  const lastStepTimeRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const n = PLUMBLINE_STEPS.length;

  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  // Smoothly glide `pos` to `activeIdx` over 260ms for fluid plumb bob and swell
  useEffect(() => {
    let animId: number;
    const start = pos;
    const end = activeIdx;
    if (Math.abs(start - end) < 0.005) {
      setPos(end);
      return;
    }
    const startTime = performance.now();
    const duration = 260;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic curve
      const ease = 1 - Math.pow(1 - progress, 3);
      setPos(start + (end - start) * ease);

      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      } else {
        setPos(end);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [activeIdx]);

  // Contained wheel and touch scroll: scrub steps in place without scrolling window simultaneously
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 14) return;

      const isDown = e.deltaY > 0;
      const now = performance.now();
      const timeSinceLast = now - lastStepTimeRef.current;
      const currentIdx = activeIdxRef.current;
      const maxIdx = n - 1;

      const rect = el.getBoundingClientRect();
      const windowH = window.innerHeight;

      if (isDown) {
        // If at first step and container has not yet reached viewing position,
        // let the page scroll naturally until it's centered in viewport
        if (currentIdx === 0 && rect.top > 120) {
          return;
        }

        if (currentIdx < maxIdx) {
          // Prevent window scroll while scrubbing steps
          e.preventDefault();
          if (timeSinceLast > 350) {
            lastStepTimeRef.current = now;
            setActiveIdx((prev) => Math.min(maxIdx, prev + 1));
          }
        } else {
          // At final step (03 Inspect and ask questions)
          // Absorb immediate momentum for 250ms
          if (timeSinceLast < 250) {
            e.preventDefault();
          }
          // After 250ms, natural page scroll resumes down to FAQ
        }
      } else {
        // Scrolling UP
        // If at last step and bottom of container is scrolled past bottom of viewport,
        // let page scroll naturally so container comes into view
        if (currentIdx === maxIdx && rect.bottom < windowH - 120) {
          return;
        }

        if (currentIdx > 0) {
          // Prevent window scroll while scrubbing steps
          e.preventDefault();
          if (timeSinceLast > 350) {
            lastStepTimeRef.current = now;
            setActiveIdx((prev) => Math.max(0, prev - 1));
          }
        } else {
          // At first step
          if (timeSinceLast < 250) {
            e.preventDefault();
          }
          // After 250ms, natural page scroll resumes upwards
        }
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartYRef.current = e.touches[0].clientY;
        touchStartXRef.current = e.touches[0].clientX;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartYRef.current === null || touchStartXRef.current === null) return;
      const touch = e.changedTouches[0];
      const deltaY = touchStartYRef.current - touch.clientY;
      const deltaX = touchStartXRef.current - touch.clientX;
      touchStartYRef.current = null;
      touchStartXRef.current = null;

      if (Math.abs(deltaY) > 40 || Math.abs(deltaX) > 40) {
        const isNext = deltaY > 40 || deltaX > 40;
        const currentIdx = activeIdxRef.current;
        const maxIdx = n - 1;

        if (isNext && currentIdx < maxIdx) {
          setActiveIdx(currentIdx + 1);
        } else if (!isNext && currentIdx > 0) {
          setActiveIdx(currentIdx - 1);
        }
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [n]);

  const handleStepClick = (stepIdx: number) => {
    setActiveIdx(stepIdx);
    lastStepTimeRef.current = performance.now();
  };

  const railProgress = n > 1 ? clamp(pos / (n - 1), 0, 1) : 0;

  return (
    <div
      ref={trackRef}
      className="plumbline-scroll-track"
      aria-label="Scroll-driven Plumbline Pipeline"
    >
      <div className="plumbline-sticky-frame">
        <div className="plumbline-grid">
          {/* ── Left Column: Clean Titles & Vertical Plumb Rail ── */}
          <div className="plumbline-left-rail">
            <div className="plumbline-track-column">
              {/* Vertical Plumbline Guide Rail */}
              <div className="plumbline-guide-rail">
                {/* Traveling Monochrome Plumb Bob Indicator */}
                <div
                  className="plumbline-mono-bob"
                  style={{
                    top: `calc(${railProgress * 100}% - ${railProgress * 14}px)`,
                    transition: "top 0.15s ease-out",
                  }}
                >
                  <span className="plumbline-mono-core" />
                  <span className="plumbline-mono-glow" />
                </div>
              </div>

              {/* Minimalist Step Titles List */}
              <div className="plumbline-titles-stack">
                {PLUMBLINE_STEPS.map((stepItem, idx) => {
                  const near = nearness(idx, pos);
                  const isCurrent = activeIdx === idx;

                  // Smooth typographic swell math inspired by Plumbline
                  const scale = lerp(0.92, 1.04, near);
                  const opacity = lerp(0.35, 1, near);
                  const titleSize = `${lerp(1.3, 2.1, near)}rem`;
                  const fontWeight = near > 0.5 ? 500 : 400;

                  return (
                    <div
                      key={stepItem.id}
                      className={`plumbline-title-row ${isCurrent ? "is-active" : ""}`}
                      style={{ opacity, cursor: "pointer" }}
                      onClick={() => handleStepClick(idx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleStepClick(idx);
                        }
                      }}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      <div
                        className="plumbline-title-content"
                        style={{
                          transform: `scale(${scale})`,
                          transformOrigin: "left center",
                          transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                      >
                        <span
                          className="plumbline-mono-num mf-mono"
                          style={{
                            color: near > 0.5 ? "#ffffff" : "#71717a",
                            transition: "color 0.2s ease",
                          }}
                        >
                          {stepItem.marker}
                        </span>
                        <h3
                          className="plumbline-step-h3"
                          style={{
                            fontSize: titleSize,
                            fontWeight,
                            color: near > 0.5 ? "#ffffff" : "#71717a",
                            transition: "color 0.2s ease",
                          }}
                        >
                          {stepItem.title}
                        </h3>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Architecture link at bottom left */}
            <div className="plumbline-bottom-cta">
              <Link to="/how-it-works" className="mf-btn inv">
                See how it works
              </Link>
            </div>
          </div>

          {/* ── Right Column: Bespoke Architectural Exhibit (Not in Box) ── */}
          <div className="plumbline-right-info">
            <div className="plumbline-exhibit-canvas">
              {/* Exhibit 01: Ingestion Engine */}
              {activeIdx === 0 && (
                <div className="plumbline-view-pane fade-enter" key="exhibit-01">
                  <div className="plumbline-pane-meta">
                    <span className="plumbline-phase-tag mf-mono">Step 1 · Clone repository</span>
                    <span className="plumbline-phase-idx mf-mono">1 of 3</span>
                  </div>

                  <h3 className="plumbline-pane-heading">
                    Shallow clone in a temporary directory.
                  </h3>
                  <p className="plumbline-pane-desc">
                    Paste a public GitHub URL or connect a Personal Access Token for private repos. DevLens runs a shallow clone, skips vendored build folders, and deletes the temporary files when your session ends.
                  </p>

                  {/* Architectural Pipeline Wireframe */}
                  <div className="plumbline-wireframe-flow">
                    <div className="wireframe-node active">
                      <span className="wireframe-dot" />
                      <div className="wireframe-node-inner">
                        <span className="wireframe-node-type mf-mono">Source</span>
                        <span className="wireframe-node-label">github.com/facebook/react</span>
                      </div>
                    </div>

                    <div className="wireframe-connector">
                      <span className="wireframe-line" />
                      <span className="wireframe-arrow">→</span>
                    </div>

                    <div className="wireframe-node">
                      <div className="wireframe-node-inner">
                        <span className="wireframe-node-type mf-mono">Worker</span>
                        <span className="wireframe-node-label">Temporary clone folder</span>
                      </div>
                    </div>

                    <div className="wireframe-connector">
                      <span className="wireframe-line" />
                      <span className="wireframe-arrow">→</span>
                    </div>

                    <div className="wireframe-node">
                      <div className="wireframe-node-inner">
                        <span className="wireframe-node-type mf-mono">Parser</span>
                        <span className="wireframe-node-label">In-memory syntax stream</span>
                      </div>
                    </div>
                  </div>

                  {/* Key Architectural Telemetry */}
                  <div className="plumbline-telemetry-grid">
                    <div className="plumbline-telem-item">
                      <span className="telem-val">0 Bytes</span>
                      <span className="telem-label mf-mono">Kept on disk</span>
                    </div>
                    <div className="plumbline-telem-item">
                      <span className="telem-val">--depth 1</span>
                      <span className="telem-label mf-mono">Shallow git clone</span>
                    </div>
                    <div className="plumbline-telem-item">
                      <span className="telem-val">100%</span>
                      <span className="telem-label mf-mono">Cleared on exit</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Exhibit 02: Syntactic AST Analysis */}
              {activeIdx === 1 && (
                <div className="plumbline-view-pane fade-enter" key="exhibit-02">
                  <div className="plumbline-pane-meta">
                    <span className="plumbline-phase-tag mf-mono">Step 2 · Parse syntax trees</span>
                    <span className="plumbline-phase-idx mf-mono">2 of 3</span>
                  </div>

                  <h3 className="plumbline-pane-heading">
                    Parse files and link imports with Tree-sitter.
                  </h3>
                  <p className="plumbline-pane-desc">
                    Tree-sitter parses each file into a syntax tree and extracts functions, classes, and import statements. Cross-file imports are linked into a directed dependency graph.
                  </p>

                  {/* Visual CST Tree Decomposition */}
                  <div className="plumbline-ast-canvas mf-mono">
                    <div className="ast-spec-row root">
                      <span className="ast-pipe">├─</span>
                      <span className="ast-token-type">FunctionDeclaration</span>
                      <span className="ast-token-name">validateCredentials(req, res)</span>
                      <span className="ast-token-meta">src/auth/login.ts:42</span>
                    </div>
                    <div className="ast-spec-row child">
                      <span className="ast-pipe">│  ├─</span>
                      <span className="ast-token-type">ZodSchemaGuard</span>
                      <span className="ast-token-val">LoginCredentialsSchema</span>
                    </div>
                    <div className="ast-spec-row child">
                      <span className="ast-pipe">│  ├─</span>
                      <span className="ast-token-type">ImportBinding</span>
                      <span className="ast-token-name">createSessionToken</span>
                      <span className="ast-token-meta">➔ src/session/tokens.ts</span>
                    </div>
                    <div className="ast-spec-row child">
                      <span className="ast-pipe">│  └─</span>
                      <span className="ast-token-type">MutationRisk</span>
                      <span className="ast-token-clean">Read-only check</span>
                    </div>
                    <div className="ast-spec-row root">
                      <span className="ast-pipe">└─</span>
                      <span className="ast-token-type">DependencyEdge</span>
                      <span className="ast-token-name">auth_service ➔ pgvector</span>
                      <span className="ast-token-meta">src/db/store.ts</span>
                    </div>
                  </div>

                  {/* Key Architectural Telemetry */}
                  <div className="plumbline-telemetry-grid">
                    <div className="plumbline-telem-item">
                      <span className="telem-val">8</span>
                      <span className="telem-label mf-mono">AST languages</span>
                    </div>
                    <div className="plumbline-telem-item">
                      <span className="telem-val">DAG</span>
                      <span className="telem-label mf-mono">Import graph</span>
                    </div>
                    <div className="plumbline-telem-item">
                      <span className="telem-val">Exact</span>
                      <span className="telem-label mf-mono">Symbol line ranges</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Exhibit 03: Architecture Interrogation */}
              {activeIdx === 2 && (
                <div className="plumbline-view-pane fade-enter" key="exhibit-03">
                  <div className="plumbline-pane-meta">
                    <span className="plumbline-phase-tag mf-mono">Step 3 · Map &amp; search</span>
                    <span className="plumbline-phase-idx mf-mono">3 of 3</span>
                  </div>

                  <h3 className="plumbline-pane-heading">
                    Inspect the graph and ask questions with line links.
                  </h3>
                  <p className="plumbline-pane-desc">
                    Click any file in the graph to see what imports it, trace request paths across modules, or ask a question in plain English. Every answer points to the exact file and line number.
                  </p>

                  {/* Visual Grounded Citation Callout */}
                  <div className="plumbline-citation-canvas">
                    <div className="citation-query-row">
                      <span className="citation-query-label mf-mono">Question</span>
                      <p className="citation-query-text">
                        &ldquo;How does the login form validate anti-CSRF tokens before dispatching?&rdquo;
                      </p>
                    </div>

                    <div className="citation-response-row">
                      <div className="citation-answer-head">
                        <span className="citation-badge mf-mono">Answer</span>
                        <span className="citation-verified mf-mono">Cited source line</span>
                      </div>
                      <p className="citation-answer-text">
                        The client parses credentials against the Zod schema and checks the anti-CSRF nonce in memory before sending the network request.
                      </p>

                      <div className="citation-source-card">
                        <div className="citation-source-head">
                          <span className="citation-file mf-mono">src/routes/auth/login.tsx : L42</span>
                        </div>
                        <code className="citation-code mf-mono">
                          const isValid = await verifyCsrfToken(req.nonce);
                        </code>
                      </div>
                    </div>
                  </div>

                  {/* Key Architectural Telemetry */}
                  <div className="plumbline-telemetry-grid">
                    <div className="plumbline-telem-item">
                      <span className="telem-val">Exact</span>
                      <span className="telem-label mf-mono">File &amp; line links</span>
                    </div>
                    <div className="plumbline-telem-item">
                      <span className="telem-val">@file</span>
                      <span className="telem-label mf-mono">Context pinning</span>
                    </div>
                    <div className="plumbline-telem-item">
                      <span className="telem-val">Mermaid</span>
                      <span className="telem-label mf-mono">Diagram export</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
