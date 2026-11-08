import React, { useState, useEffect, useRef, useCallback } from "react";
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
    title: "PASTE A REPO",
  },
  {
    id: "parse",
    step: "02",
    marker: "02",
    title: "TREE-SITTER PARSES IT",
  },
  {
    id: "interrogate",
    step: "03",
    marker: "03",
    title: "INSPECT AND ASK QUESTIONS",
  },
];

export function PlumblinePipeline() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  const n = PLUMBLINE_STEPS.length;

  // Track scroll position of the section to smoothly progress through steps on page scroll
  const handleScroll = useCallback(() => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const stickyTop = 100; // top offset where sticky pins
    const totalScrollable = rect.height - (windowHeight - stickyTop);

    if (totalScrollable <= 0) return;

    // How far user has scrolled into the pinned section
    const currentScrolled = stickyTop - rect.top;
    const rawProgress = currentScrolled / totalScrollable;
    const clampedProgress = clamp(rawProgress, 0, 1);

    // Continuous floating pos from 0 to n - 1
    const targetPos = clampedProgress * (n - 1);
    setPos(targetPos);

    const roundedIdx = clamp(Math.round(targetPos), 0, n - 1);
    setActiveIdx(roundedIdx);
  }, [n]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [handleScroll]);

  // Click on step title smoothly scrolls the page to that step's position
  const scrollToStep = (stepIdx: number) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const absoluteSectionTop = window.scrollY + rect.top;
    const stickyTop = 100;
    const windowHeight = window.innerHeight;
    const totalScrollable = sectionRef.current.offsetHeight - (windowHeight - stickyTop);

    const targetScrollY =
      absoluteSectionTop - stickyTop + (stepIdx / (n - 1)) * totalScrollable;

    window.scrollTo({
      top: Math.max(0, targetScrollY + 2),
      behavior: "smooth",
    });
  };

  // Rail marker progress (0 to 1)
  const railProgress = n > 1 ? clamp(pos / (n - 1), 0, 1) : 0;

  return (
    <div
      ref={sectionRef}
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
                      style={{ opacity }}
                      onClick={() => scrollToStep(idx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          scrollToStep(idx);
                        }
                      }}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      <div
                        className="plumbline-title-content"
                        style={{
                          transform: `scale(${scale})`,
                          transformOrigin: "left center",
                        }}
                      >
                        <span
                          className="plumbline-mono-num mf-mono"
                          style={{
                            color: near > 0.5 ? "#ffffff" : "#71717a",
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

                  <h3 className="plumbline-pane-heading" style={{ textTransform: "uppercase", fontFamily: '"Boogaloo", sans-serif' }}>
                    SHALLOW CLONE IN A TEMPORARY DIRECTORY.
                  </h3>
                  <p className="plumbline-pane-desc" style={{ textTransform: "none", fontFamily: '"Boogaloo", sans-serif', fontSize: "1.1rem", lineHeight: 1.55 }}>
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

                  <h3 className="plumbline-pane-heading" style={{ textTransform: "uppercase", fontFamily: '"Boogaloo", sans-serif' }}>
                    PARSE FILES AND LINK IMPORTS WITH TREE-SITTER.
                  </h3>
                  <p className="plumbline-pane-desc" style={{ textTransform: "none", fontFamily: '"Boogaloo", sans-serif', fontSize: "1.1rem", lineHeight: 1.55 }}>
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

                  <h3 className="plumbline-pane-heading" style={{ textTransform: "uppercase", fontFamily: '"Boogaloo", sans-serif' }}>
                    INSPECT THE GRAPH AND ASK QUESTIONS WITH LINE LINKS.
                  </h3>
                  <p className="plumbline-pane-desc" style={{ textTransform: "none", fontFamily: '"Boogaloo", sans-serif', fontSize: "1.1rem", lineHeight: 1.55 }}>
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
