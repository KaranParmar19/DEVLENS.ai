import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "motion/react";

export interface StoryNode {
  step: string;
  role: string;
  name: string;
  line: string;
  note: string;
}

export interface StoryChain {
  id: string;
  trigger: string;
  nodes: StoryNode[];
}

export interface CardShuffleShowcaseProps {
  chains: StoryChain[];
  initialChainIndex?: number;
  className?: string;
}

export function CardShuffleShowcase({
  chains,
  initialChainIndex = 0,
  className = "",
}: CardShuffleShowcaseProps) {
  const [chainIdx] = useState(initialChainIndex);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  // Link scroll position through a smooth 280vh track
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Silky smooth spring physics
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    mass: 0.3,
  });

  // Spatial offsets for the 2x2 grid and shuffles
  const xSpan = isMobile ? 115 : 270;
  const ySpan = isMobile ? 95 : 155;

  // Large, highly readable scale factors across all stages
  const fullCoverScale = isMobile ? 1.05 : 1.15;
  const gridScale = isMobile ? 0.78 : 0.88;
  const stackScale = isMobile ? 0.82 : 0.92;

  // 12 Keyframe points:
  // 0.00 — 0.06 : Initial state: single card covering full screen at native resolution (zero blur)
  // 0.06 — 0.22 : Trigger 1: scale down & reposition to 2x2 grid
  // 0.22 — 0.28 : Rest gap in 2x2 grid
  // 0.28 — 0.44 : Trigger 2: 2 cards slide vertically over 2 static cards (layered shuffle)
  // 0.44 — 0.50 : Rest gap in vertical shuffle
  // 0.50 — 0.66 : Trigger 3: move toward center (2 above, 2 below)
  // 0.66 — 0.72 : Rest gap in center convergence
  // 0.72 — 0.84 : Trigger 4: collapse into center & stack behind by layer order
  // 0.84 — 0.90 : Rest gap in stacked deck
  // 0.90 — 0.96 : Trigger 5: topmost card scales up to full-screen resolution
  // 0.96 — 1.00 : Smoothly returns to default size as page continues scrolling down
  const P = [0, 0.06, 0.22, 0.28, 0.44, 0.50, 0.66, 0.72, 0.84, 0.90, 0.96, 1.0];

  /* ── Card 0: Topmost hero -> Top-Left in grid -> Slides DOWN over Card 2 -> Center below -> Stack top -> Scales up -> Settles to default ── */
  const c0_x = useTransform(smoothProgress, P, [0, 0, -xSpan, -xSpan, -xSpan, -xSpan, -18, -18, 0, 0, 0, 0]);
  const c0_y = useTransform(smoothProgress, P, [0, 0, -ySpan, -ySpan, ySpan, ySpan, ySpan * 0.42, ySpan * 0.42, -8, -8, 0, 0]);
  const c0_s = useTransform(smoothProgress, P, [fullCoverScale, fullCoverScale, gridScale, gridScale, 0.90, 0.90, 0.88, 0.88, stackScale, stackScale, fullCoverScale, stackScale]);
  const c0_r = useTransform(smoothProgress, P, [0, 0, 0, 0, -2, -2, 0, 0, -3, -3, 0, 0]);
  const c0_o = useTransform(smoothProgress, P, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  const c0_z = useTransform(smoothProgress, P, [35, 35, 20, 20, 26, 26, 26, 26, 30, 30, 35, 20]);

  /* ── Card 1: Top-Right in grid -> Static in Trigger 2 while Card 3 slides over -> Center above -> Stack middle -> Tucked behind ── */
  const c1_x = useTransform(smoothProgress, P, [0, 0, xSpan, xSpan, xSpan, xSpan, 18, 18, 0, 0, 0, 0]);
  const c1_y = useTransform(smoothProgress, P, [0, 0, -ySpan, -ySpan, -ySpan, -ySpan, -ySpan * 0.42, -ySpan * 0.42, -3, -3, 0, 0]);
  const c1_s = useTransform(smoothProgress, P, [gridScale, gridScale, gridScale, gridScale, 0.82, 0.82, 0.86, 0.86, stackScale - 0.02, stackScale - 0.02, 0.88, 0.88]);
  const c1_r = useTransform(smoothProgress, P, [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 0, 0]);
  const c1_o = useTransform(smoothProgress, P, [0, 0, 1, 1, 0.65, 0.65, 0.85, 0.85, 1, 1, 0, 0]);
  const c1_z = useTransform(smoothProgress, P, [10, 10, 15, 15, 10, 10, 15, 15, 25, 25, 10, 10]);

  /* ── Card 2: Bottom-Left in grid -> Static in Trigger 2 while Card 0 slides over -> Center below -> Stack middle -> Tucked behind ── */
  const c2_x = useTransform(smoothProgress, P, [0, 0, -xSpan, -xSpan, -xSpan, -xSpan, -18, -18, 0, 0, 0, 0]);
  const c2_y = useTransform(smoothProgress, P, [0, 0, ySpan, ySpan, ySpan, ySpan, ySpan * 0.42, ySpan * 0.42, 3, 3, 0, 0]);
  const c2_s = useTransform(smoothProgress, P, [gridScale, gridScale, gridScale, gridScale, 0.82, 0.82, 0.84, 0.84, stackScale - 0.04, stackScale - 0.04, 0.88, 0.88]);
  const c2_r = useTransform(smoothProgress, P, [0, 0, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0]);
  const c2_o = useTransform(smoothProgress, P, [0, 0, 1, 1, 0.65, 0.65, 0.85, 0.85, 1, 1, 0, 0]);
  const c2_z = useTransform(smoothProgress, P, [10, 10, 15, 15, 10, 10, 15, 15, 20, 20, 10, 10]);

  /* ── Card 3: Bottom-Right in grid -> Slides UP over Card 1 -> Center above -> Stack base -> Tucked behind ── */
  const c3_x = useTransform(smoothProgress, P, [0, 0, xSpan, xSpan, xSpan, xSpan, 18, 18, 0, 0, 0, 0]);
  const c3_y = useTransform(smoothProgress, P, [0, 0, ySpan, ySpan, -ySpan, -ySpan, -ySpan * 0.42, -ySpan * 0.42, 8, 8, 0, 0]);
  const c3_s = useTransform(smoothProgress, P, [gridScale, gridScale, gridScale, gridScale, 0.90, 0.90, 0.88, 0.88, stackScale - 0.06, stackScale - 0.06, 0.88, 0.88]);
  const c3_r = useTransform(smoothProgress, P, [0, 0, 0, 0, 2, 2, 0, 0, 3, 3, 0, 0]);
  const c3_o = useTransform(smoothProgress, P, [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0]);
  const c3_z = useTransform(smoothProgress, P, [10, 10, 15, 15, 26, 26, 25, 25, 15, 15, 10, 10]);

  const cardTransforms = [
    { x: c0_x, y: c0_y, r: c0_r, s: c0_s, o: c0_o, z: c0_z },
    { x: c1_x, y: c1_y, r: c1_r, s: c1_s, o: c1_o, z: c1_z },
    { x: c2_x, y: c2_y, r: c2_r, s: c2_s, o: c2_o, z: c2_z },
    { x: c3_x, y: c3_y, r: c3_r, s: c3_s, o: c3_o, z: c3_z },
  ];

  const currentChain = chains[chainIdx] || chains[0];
  const nodes = currentChain.nodes.slice(0, 4);

  return (
    <div
      ref={containerRef}
      className={`card-shuffle-container ${className}`}
      style={{
        position: "relative",
        height: "280vh",
        width: "100%",
        marginTop: 0,
        marginBottom: 0,
        overflow: "visible",
      }}
    >
      {/* Sticky Viewport Stage: Takes over the ENTIRE page for the animation duration */}
      <div
        className="card-shuffle-sticky"
        style={{
          position: "sticky",
          top: 0,
          left: 0,
          width: "100%",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: "#ffffff",
          zIndex: 25,
        }}
      >
        {/* Subtle Ambient Radial Backdrop */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 65% 55% at 50% 50%, rgba(255, 255, 255, 0.04), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* ── Central 3D Card Shuffle Arena (Full Page) ────────────────────────── */}
        <div
          className="card-shuffle-arena"
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            perspective: 1200,
            overflow: "visible",
          }}
        >
          {/* Subtle Stage Boundary Guide */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: "min(92vw, 1040px)",
              height: isMobile ? "380px" : "480px",
              borderRadius: 36,
              border: "1px dashed rgba(10, 10, 10, 0.07)",
              background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(10, 10, 10, 0.012), transparent)",
              pointerEvents: "none",
            }}
          />

          {/* 4 Shuffling Story Cards */}
          <AnimatePresence mode="popLayout">
            {nodes.map((hop, idx) => {
              const transform = cardTransforms[idx];
              const isSelected = idx === activeCardIdx;

              return (
                <motion.div
                  key={`${currentChain.id}-${hop.name}`}
                  className="card-shuffle-item"
                  onClick={() => setActiveCardIdx(idx)}
                  style={{
                    position: "absolute",
                    width: isMobile ? "min(92vw, 380px)" : "min(90vw, 540px)",
                    height: isMobile ? 250 : 310,
                    x: transform.x,
                    y: transform.y,
                    rotate: transform.r,
                    scale: transform.s,
                    opacity: transform.o,
                    zIndex: transform.z,
                    cursor: "pointer",
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale",
                    textRendering: "optimizeLegibility",
                    transformStyle: "preserve-3d",
                    backfaceVisibility: "hidden",
                  }}
                  whileHover={{
                    scale: 1.025,
                    transition: { duration: 0.18 },
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: 24,
                      padding: isMobile ? "20px 22px" : "26px 30px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxSizing: "border-box",
                      backgroundColor: isSelected ? "#0a0a0a" : "#ffffff",
                      color: isSelected ? "#ffffff" : "#0a0a0a",
                      border: isSelected ? "1.5px solid #0a0a0a" : "1px solid #e5e5e5",
                      boxShadow: isSelected
                        ? "0 36px 80px -16px rgba(0, 0, 0, 0.38), 0 0 0 1px rgba(255, 255, 255, 0.15) inset"
                        : "0 22px 48px -14px rgba(0, 0, 0, 0.11), 0 2px 8px rgba(0, 0, 0, 0.03)",
                      transition:
                        "background-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
                      userSelect: "none",
                    }}
                  >
                    {/* Top Row: Step Tag + Role Pill */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontFamily: "var(--mf-mono)",
                        fontSize: isMobile ? "0.72rem" : "0.78rem",
                        letterSpacing: "0.08em",
                        color: isSelected ? "#ffffff" : "var(--mf-ink-3)",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Step {hop.step}</span>
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: 999,
                          backgroundColor: isSelected ? "rgba(255, 255, 255, 0.12)" : "#f5f5f5",
                          color: isSelected ? "#ffffff" : "var(--mf-ink-2)",
                          fontWeight: 500,
                          fontSize: isMobile ? "0.68rem" : "0.75rem",
                        }}
                      >
                        {hop.role}
                      </span>
                    </div>

                    {/* Middle: Name & Plain-English Description */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div
                        style={{
                          fontSize: isMobile ? "1.2rem" : "1.45rem",
                          fontWeight: 600,
                          letterSpacing: "-0.025em",
                          lineHeight: 1.25,
                        }}
                      >
                        {hop.name}
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: isMobile ? "0.875rem" : "1.0rem",
                          lineHeight: 1.5,
                          color: isSelected ? "rgba(255, 255, 255, 0.85)" : "var(--mf-ink-2)",
                        }}
                      >
                        {hop.note}
                      </p>
                    </div>

                    {/* Bottom: Verified Code Citation Tag */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontFamily: "var(--mf-mono)",
                        fontSize: isMobile ? "0.72rem" : "0.8rem",
                        paddingTop: 12,
                        borderTop: isSelected ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #f0f0f0",
                        letterSpacing: "0.04em",
                      }}
                    >
                      <span style={{ color: isSelected ? "rgba(255, 255, 255, 0.5)" : "var(--mf-ink-3)" }}>
                        Source line
                      </span>
                      <strong
                        style={{
                          color: isSelected ? "#ffffff" : "var(--mf-ink)",
                          fontWeight: 600,
                          fontSize: isMobile ? "0.78rem" : "0.86rem",
                        }}
                      >
                        {hop.line}
                      </strong>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
