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

const TRIGGER_STAGES = [
  { id: 0, tag: "TRIGGER 0", label: "Single Cover", desc: "Single image covers the screen" },
  { id: 1, tag: "TRIGGER 1", label: "2×2 Grid", desc: "Scale down & form structured grid" },
  { id: 2, tag: "TRIGGER 2", label: "Vertical Shuffle", desc: "2 images slide vertically over 2 static images" },
  { id: 3, tag: "TRIGGER 3", label: "Center Convergence", desc: "Move toward center (2 above, 2 below)" },
  { id: 4, tag: "TRIGGER 4", label: "Layered Stack", desc: "Collapse and stack behind by layer order" },
  { id: 5, tag: "TRIGGER 5", label: "Hero Resolution", desc: "Topmost image scales up to cover screen" },
];

export function CardShuffleShowcase({
  chains,
  initialChainIndex = 0,
  className = "",
}: CardShuffleShowcaseProps) {
  const [chainIdx, setChainIdx] = useState(initialChainIndex);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [currentTrigger, setCurrentTrigger] = useState(0);
  const [manualShuffleKey, setManualShuffleKey] = useState(0);
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

  // Link scroll position through a tall scroll track (450vh) to give large gaps between triggers
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Silky spring physics for smooth interpolation
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    mass: 0.3,
  });

  // Track active trigger based on progress
  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      if (v < 0.12) setCurrentTrigger(0);
      else if (v < 0.32) setCurrentTrigger(1);
      else if (v < 0.52) setCurrentTrigger(2);
      else if (v < 0.72) setCurrentTrigger(3);
      else if (v < 0.88) setCurrentTrigger(4);
      else setCurrentTrigger(5);
    });
  }, [scrollYProgress]);

  // Spatial offsets for the structured grid & shuffles
  const xSpan = isMobile ? 110 : 260;
  const ySpan = isMobile ? 95 : 155;
  const fullScale = isMobile ? 1.3 : 1.72;
  const gridScale = isMobile ? 0.84 : 0.92;

  // 11-point keyframe structure with large resting gaps between triggers:
  // p0=0.00, p1=0.06 -> Trigger 0 (Single cover)
  // p2=0.20, p3=0.26 -> Trigger 1 (2x2 Grid)
  // p4=0.40, p5=0.46 -> Trigger 2 (Vertical shuffle over 2 static images)
  // p6=0.60, p7=0.66 -> Trigger 3 (Move toward center: 2 above, 2 below)
  // p8=0.80, p9=0.86 -> Trigger 4 (Collapse and stack by layer order)
  // p10=1.00         -> Trigger 5 (Topmost image scales up to close)
  const P = [0, 0.06, 0.20, 0.26, 0.40, 0.46, 0.60, 0.66, 0.80, 0.86, 1.0];

  /* ── Card 0: Topmost hero at start -> Top-Left in grid -> Slides DOWN over Card 2 -> Center below -> Stack top -> Scales up to cover ── */
  const c0_x = useTransform(smoothProgress, P, [0, 0, -xSpan, -xSpan, -xSpan, -xSpan, -18, -18, 0, 0, 0]);
  const c0_y = useTransform(smoothProgress, P, [0, 0, -ySpan, -ySpan, ySpan, ySpan, ySpan * 0.42, ySpan * 0.42, -8, -8, 0]);
  const c0_s = useTransform(smoothProgress, P, [fullScale, fullScale, gridScale, gridScale, 0.96, 0.96, 0.95, 0.95, 1.0, 1.0, fullScale]);
  const c0_r = useTransform(smoothProgress, P, [0, 0, 0, 0, -2, -2, 0, 0, -3, -3, 0]);
  const c0_o = useTransform(smoothProgress, P, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  const c0_z = useTransform(smoothProgress, P, [35, 35, 20, 20, 26, 26, 26, 26, 30, 30, 35]);

  /* ── Card 1: Top-Right in grid -> Static in Trigger 2 while Card 3 slides over -> Center above -> Stack middle -> Tucked behind in Trigger 5 ── */
  const c1_x = useTransform(smoothProgress, P, [0, 0, xSpan, xSpan, xSpan, xSpan, 18, 18, 0, 0, 0]);
  const c1_y = useTransform(smoothProgress, P, [0, 0, -ySpan, -ySpan, -ySpan, -ySpan, -ySpan * 0.42, -ySpan * 0.42, -3, -3, 0]);
  const c1_s = useTransform(smoothProgress, P, [0.95, 0.95, gridScale, gridScale, 0.88, 0.88, 0.92, 0.92, 0.98, 0.98, 0.95]);
  const c1_r = useTransform(smoothProgress, P, [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 0]);
  const c1_o = useTransform(smoothProgress, P, [0, 0, 1, 1, 0.6, 0.6, 0.85, 0.85, 1, 1, 0]);
  const c1_z = useTransform(smoothProgress, P, [10, 10, 15, 15, 10, 10, 15, 15, 25, 25, 10]);

  /* ── Card 2: Bottom-Left in grid -> Static in Trigger 2 while Card 0 slides over -> Center below -> Stack middle -> Tucked behind in Trigger 5 ── */
  const c2_x = useTransform(smoothProgress, P, [0, 0, -xSpan, -xSpan, -xSpan, -xSpan, -18, -18, 0, 0, 0]);
  const c2_y = useTransform(smoothProgress, P, [0, 0, ySpan, ySpan, ySpan, ySpan, ySpan * 0.42, ySpan * 0.42, 3, 3, 0]);
  const c2_s = useTransform(smoothProgress, P, [0.95, 0.95, gridScale, gridScale, 0.88, 0.88, 0.9, 0.9, 0.96, 0.96, 0.95]);
  const c2_r = useTransform(smoothProgress, P, [0, 0, 0, 0, 0, 0, -1, -1, -1, -1, 0]);
  const c2_o = useTransform(smoothProgress, P, [0, 0, 1, 1, 0.6, 0.6, 0.85, 0.85, 1, 1, 0]);
  const c2_z = useTransform(smoothProgress, P, [10, 10, 15, 15, 10, 10, 15, 15, 20, 20, 10]);

  /* ── Card 3: Bottom-Right in grid -> Slides UP over Card 1 -> Center above -> Stack base -> Tucked behind in Trigger 5 ── */
  const c3_x = useTransform(smoothProgress, P, [0, 0, xSpan, xSpan, xSpan, xSpan, 18, 18, 0, 0, 0]);
  const c3_y = useTransform(smoothProgress, P, [0, 0, ySpan, ySpan, -ySpan, -ySpan, -ySpan * 0.42, -ySpan * 0.42, 8, 8, 0]);
  const c3_s = useTransform(smoothProgress, P, [0.95, 0.95, gridScale, gridScale, 0.96, 0.96, 0.96, 0.96, 0.94, 0.94, 0.95]);
  const c3_r = useTransform(smoothProgress, P, [0, 0, 0, 0, 2, 2, 0, 0, 3, 3, 0]);
  const c3_o = useTransform(smoothProgress, P, [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
  const c3_z = useTransform(smoothProgress, P, [10, 10, 15, 15, 26, 26, 25, 25, 15, 15, 10]);

  const cardTransforms = [
    { x: c0_x, y: c0_y, r: c0_r, s: c0_s, o: c0_o, z: c0_z },
    { x: c1_x, y: c1_y, r: c1_r, s: c1_s, o: c1_o, z: c1_z },
    { x: c2_x, y: c2_y, r: c2_r, s: c2_s, o: c2_o, z: c2_z },
    { x: c3_x, y: c3_y, r: c3_r, s: c3_s, o: c3_o, z: c3_z },
  ];

  const currentChain = chains[chainIdx] || chains[0];
  const nodes = currentChain.nodes.slice(0, 4);

  // Jump to specific trigger on click
  const scrollToTrigger = (targetTrigger: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const containerTop = rect.top + scrollTop;
    const containerHeight = containerRef.current.offsetHeight;
    const windowHeight = window.innerHeight;

    // Center of each trigger plateau
    const progressTargets = [0.03, 0.23, 0.43, 0.63, 0.83, 0.96];
    const targetP = progressTargets[targetTrigger] ?? 0;
    const targetY = containerTop + targetP * (containerHeight - windowHeight);

    window.scrollTo({
      top: targetY,
      behavior: "smooth",
    });
  };

  return (
    <div
      ref={containerRef}
      className={`card-shuffle-container ${className}`}
      style={{
        position: "relative",
        height: "450vh",
        width: "100%",
        marginTop: 20,
      }}
    >
      {/* Sticky Viewport Stage: Locks in place while user scrolls through the 5 triggers */}
      <div
        className="card-shuffle-sticky"
        style={{
          position: "sticky",
          top: "8vh",
          height: "86vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingBottom: 16,
          boxSizing: "border-box",
        }}
      >
        {/* Top Header: Scenario Picker + Trigger Status Banner */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 12,
            zIndex: 40,
          }}
        >
          {/* Everyday Action Scenario Tabs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {chains.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                className="hwc-thread-tab"
                data-active={idx === chainIdx}
                onClick={() => {
                  setChainIdx(idx);
                  setActiveCardIdx(0);
                  setManualShuffleKey((k) => k + 1);
                }}
                style={{
                  fontFamily: "var(--mf-font)",
                  fontSize: "0.84rem",
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: "1px solid var(--mf-line)",
                  background: idx === chainIdx ? "var(--mf-ink)" : "#ffffff",
                  color: idx === chainIdx ? "var(--mf-bg)" : "var(--mf-ink)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  fontWeight: 500,
                }}
              >
                {c.trigger}
              </button>
            ))}
          </div>

          {/* Current Trigger Phase Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              className="mf-pill"
              style={{
                fontFamily: "var(--mf-mono)",
                fontSize: "0.6875rem",
                color: "var(--mf-ink)",
                backgroundColor: "#f5f5f5",
                borderColor: "#e5e5e5",
                padding: "6px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span className="mf-dot live" style={{ background: "#10b981" }} />
              <strong>{TRIGGER_STAGES[currentTrigger].tag}</strong>
              <span style={{ color: "var(--mf-ink-3)" }}>//</span>
              <span>{TRIGGER_STAGES[currentTrigger].label.toUpperCase()}</span>
            </div>

            <button
              type="button"
              className="mf-pill"
              onClick={() => {
                const nextTrigger = (currentTrigger + 1) % 6;
                scrollToTrigger(nextTrigger);
              }}
              style={{
                cursor: "pointer",
                background: "#0a0a0a",
                color: "#ffffff",
                borderColor: "#0a0a0a",
                fontWeight: 600,
                fontSize: "0.72rem",
                padding: "6px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              title="Smoothly advance to the next trigger"
            >
              <span>Next Trigger</span>
              <span>↓</span>
            </button>
          </div>
        </div>

        {/* ── Central 3D Card Shuffle Arena ────────────────────────────────── */}
        <div
          className="card-shuffle-arena"
          style={{
            position: "relative",
            flex: 1,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            perspective: 1200,
            overflow: "visible",
            minHeight: isMobile ? 380 : 460,
          }}
        >
          {/* Subtle Ambient Arena Background Guide */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: "min(94vw, 980px)",
              height: isMobile ? "370px" : "440px",
              borderRadius: 32,
              border: "1px dashed rgba(10, 10, 10, 0.08)",
              background: "radial-gradient(ellipse 65% 55% at 50% 50%, rgba(10, 10, 10, 0.015), transparent)",
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
                  key={`${currentChain.id}-${hop.name}-${manualShuffleKey}`}
                  className="card-shuffle-item"
                  onClick={() => setActiveCardIdx(idx)}
                  style={{
                    position: "absolute",
                    width: isMobile ? "min(86vw, 300px)" : "min(88vw, 380px)",
                    height: isMobile ? 210 : 250,
                    x: transform.x,
                    y: transform.y,
                    rotate: transform.r,
                    scale: transform.s,
                    opacity: transform.o,
                    zIndex: transform.z,
                    cursor: "pointer",
                    willChange: "transform, opacity",
                  }}
                  whileHover={{
                    scale: 1.03,
                    transition: { duration: 0.18 },
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: 22,
                      padding: isMobile ? "18px 20px" : "24px 26px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxSizing: "border-box",
                      backgroundColor: isSelected ? "#0a0a0a" : "#ffffff",
                      color: isSelected ? "#ffffff" : "#0a0a0a",
                      border: isSelected ? "1.5px solid #0a0a0a" : "1px solid #e5e5e5",
                      boxShadow: isSelected
                        ? "0 32px 72px -16px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.15) inset"
                        : "0 20px 44px -14px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.03)",
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
                        fontSize: "0.6875rem",
                        letterSpacing: "0.06em",
                        color: isSelected ? "#10b981" : "var(--mf-ink-3)",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>STEP {hop.step}</span>
                      <span
                        style={{
                          textTransform: "uppercase",
                          padding: "3px 10px",
                          borderRadius: 999,
                          backgroundColor: isSelected ? "rgba(16, 185, 129, 0.15)" : "#f5f5f5",
                          color: isSelected ? "#10b981" : "var(--mf-ink-2)",
                          fontWeight: 500,
                          fontSize: "0.625rem",
                        }}
                      >
                        {hop.role}
                      </span>
                    </div>

                    {/* Middle: Name & Plain-English Description */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div
                        style={{
                          fontSize: isMobile ? "1.1rem" : "1.25rem",
                          fontWeight: 600,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.2,
                        }}
                      >
                        {hop.name}
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: isMobile ? "0.8125rem" : "0.875rem",
                          lineHeight: 1.45,
                          color: isSelected ? "rgba(255, 255, 255, 0.78)" : "var(--mf-ink-2)",
                        }}
                      >
                        {hop.note}
                      </p>
                    </div>

                    {/* Bottom: Exact Code Spot Tag */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontFamily: "var(--mf-mono)",
                        fontSize: "0.72rem",
                        paddingTop: 10,
                        borderTop: isSelected ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #f0f0f0",
                        letterSpacing: "0.04em",
                      }}
                    >
                      <span style={{ color: isSelected ? "rgba(255, 255, 255, 0.5)" : "var(--mf-ink-3)" }}>
                        ↳ EXACT SPOT
                      </span>
                      <strong
                        style={{
                          color: isSelected ? "#10b981" : "var(--mf-ink)",
                          fontWeight: 600,
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

        {/* Bottom Interactive 5-Trigger Scrubber Strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingTop: 10,
            flexWrap: "wrap",
            zIndex: 40,
          }}
        >
          {TRIGGER_STAGES.map((trig) => {
            const isActive = currentTrigger === trig.id;
            return (
              <button
                key={trig.id}
                type="button"
                onClick={() => scrollToTrigger(trig.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: isActive ? "1.5px solid var(--mf-ink)" : "1px solid var(--mf-line)",
                  backgroundColor: isActive ? "var(--mf-ink)" : "#ffffff",
                  color: isActive ? "var(--mf-bg)" : "var(--mf-ink-2)",
                  fontFamily: "var(--mf-mono)",
                  fontSize: "0.6875rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  fontWeight: isActive ? 600 : 400,
                }}
                title={trig.desc}
              >
                <span style={{ opacity: isActive ? 0.7 : 0.5 }}>{trig.id}</span>
                <span>{trig.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
