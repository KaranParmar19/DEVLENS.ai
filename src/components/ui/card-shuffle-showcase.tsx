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
  const [chainIdx, setChainIdx] = useState(initialChainIndex);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
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

  // Link scroll position through the tall scroll track (260vh)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Smooth out scroll value using a gentle spring
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 160,
    damping: 26,
    mass: 0.25,
  });

  // Responsive spatial span
  const xSpan = isMobile ? 100 : 250;
  const ySpan = isMobile ? 85 : 130;

  // Transform trajectories across scroll progress [0 -> 0.28 -> 0.58 -> 0.82 -> 1]
  // Card 0: Top-Left -> Shuffles to Bottom-Right -> Center Deck -> Spotlight
  const c0_x = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [-xSpan, -xSpan, xSpan, 0, 0]);
  const c0_y = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [-ySpan, -ySpan, ySpan, -12, -18]);
  const c0_r = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [-5, -5, 4, -4, 0]);
  const c0_s = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [0.94, 0.94, 0.94, 0.97, 1]);

  // Card 1: Top-Right -> Shuffles to Bottom-Left -> Center Deck
  const c1_x = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [xSpan, xSpan, -xSpan, 0, 0]);
  const c1_y = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [-ySpan, -ySpan, ySpan, -4, -4]);
  const c1_r = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [4, 4, -4, 3, 2]);
  const c1_s = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [0.94, 0.94, 0.94, 0.97, 0.98]);

  // Card 2: Bottom-Left -> Shuffles to Top-Right -> Center Deck
  const c2_x = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [-xSpan, -xSpan, xSpan, 0, 0]);
  const c2_y = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [ySpan, ySpan, -ySpan, 4, 6]);
  const c2_r = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [2, 2, 4, -2, -1]);
  const c2_s = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [0.94, 0.94, 0.94, 0.98, 0.98]);

  // Card 3: Bottom-Right -> Shuffles to Top-Left -> Center Deck
  const c3_x = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [xSpan, xSpan, -xSpan, 0, 0]);
  const c3_y = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [ySpan, ySpan, -ySpan, 12, 16]);
  const c3_r = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [-4, -4, -3, 2, 1]);
  const c3_s = useTransform(smoothProgress, [0, 0.25, 0.55, 0.8, 1], [0.94, 0.94, 0.94, 0.99, 1]);

  const cardTransforms = [
    { x: c0_x, y: c0_y, r: c0_r, s: c0_s },
    { x: c1_x, y: c1_y, r: c1_r, s: c1_s },
    { x: c2_x, y: c2_y, r: c2_r, s: c2_s },
    { x: c3_x, y: c3_y, r: c3_r, s: c3_s },
  ];

  // Auto-update active card depending on scroll position when user scrolls through
  useEffect(() => {
    return scrollYProgress.on("change", (latest) => {
      if (latest < 0.25) {
        setActiveCardIdx(0);
      } else if (latest < 0.5) {
        setActiveCardIdx(1);
      } else if (latest < 0.75) {
        setActiveCardIdx(2);
      } else {
        setActiveCardIdx(3);
      }
    });
  }, [scrollYProgress]);

  const currentChain = chains[chainIdx] || chains[0];
  const nodes = currentChain.nodes.slice(0, 4);

  return (
    <div
      ref={containerRef}
      className={`card-shuffle-container ${className}`}
      style={{
        position: "relative",
        height: "260vh",
        width: "100%",
        marginTop: 20,
      }}
    >
      {/* Sticky Viewport Stage: Locks in place while scrolling through the 260vh track */}
      <div
        className="card-shuffle-sticky"
        style={{
          position: "sticky",
          top: "10vh",
          height: "82vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingBottom: 20,
          boxSizing: "border-box",
        }}
      >
        {/* Interactive Scenario Tabs & Action Control Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 16,
            zIndex: 10,
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

          {/* Shuffle Mode Indicator & Interactive Trigger Button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              className="mf-pill"
              style={{
                fontFamily: "var(--mf-mono)",
                fontSize: "0.6875rem",
                color: "var(--mf-ink-2)",
                padding: "6px 14px",
              }}
            >
              <span className="mf-dot live" style={{ background: "#10b981" }} />
              SCROLL DOWN TO SHUFFLE CARDS
            </div>

            <button
              type="button"
              className="mf-pill"
              onClick={() => {
                setManualShuffleKey((k) => k + 1);
                setActiveCardIdx((curr) => (curr + 1) % 4);
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
              title="Click to manually shuffle the cards"
            >
              <span>🔀</span> Shuffle Deck
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
            minHeight: isMobile ? 380 : 450,
          }}
        >
          {/* Subtle Ambient Arena Background Guide */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: "min(94vw, 960px)",
              height: isMobile ? "360px" : "420px",
              borderRadius: 28,
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

              // Compute zIndex dynamically: selected card rises to the top layer
              const zIndex = isSelected ? 20 : 5 + idx;

              return (
                <motion.div
                  key={`${currentChain.id}-${hop.name}-${manualShuffleKey}`}
                  className="card-shuffle-item"
                  onClick={() => setActiveCardIdx(idx)}
                  style={{
                    position: "absolute",
                    width: isMobile ? "min(86vw, 300px)" : "min(88vw, 370px)",
                    height: isMobile ? 210 : 240,
                    x: transform.x,
                    y: transform.y,
                    rotate: transform.r,
                    scale: transform.s,
                    zIndex,
                    cursor: "pointer",
                    willChange: "transform",
                  }}
                  whileHover={{
                    scale: 1.03,
                    zIndex: 30,
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
                        ? "0 28px 64px -16px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(255, 255, 255, 0.15) inset"
                        : "0 16px 36px -12px rgba(0, 0, 0, 0.07), 0 2px 6px rgba(0, 0, 0, 0.03)",
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
                          padding: "2px 8px",
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

        {/* Bottom Interactive Step Progress Scrub Strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            paddingTop: 12,
            flexWrap: "wrap",
            zIndex: 10,
          }}
        >
          {nodes.map((n, i) => (
            <button
              key={n.name}
              type="button"
              onClick={() => setActiveCardIdx(i)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 999,
                border: i === activeCardIdx ? "1.5px solid var(--mf-ink)" : "1px solid var(--mf-line)",
                backgroundColor: i === activeCardIdx ? "var(--mf-ink)" : "#ffffff",
                color: i === activeCardIdx ? "var(--mf-bg)" : "var(--mf-ink-2)",
                fontFamily: "var(--mf-mono)",
                fontSize: "0.7rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
                fontWeight: i === activeCardIdx ? 600 : 400,
              }}
            >
              <span>0{i + 1}</span>
              <span>·</span>
              <span>{n.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
