import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

function getCardTransform(idx: number, activeIdx: number, isMobile: boolean) {
  const diff = idx - activeIdx;

  if (diff === 0) {
    // Current active hero card: front and center
    return {
      x: 0,
      y: 0,
      scale: isMobile ? 1.0 : 1.05,
      rotate: 0,
      opacity: 1,
      zIndex: 35,
    };
  }

  // Cards behind in upcoming sequence (diff > 0)
  if (diff === 1) {
    return {
      x: isMobile ? 20 : 38,
      y: isMobile ? 14 : 22,
      scale: isMobile ? 0.94 : 0.95,
      rotate: 2.5,
      opacity: 0.9,
      zIndex: 25,
    };
  }
  if (diff === 2) {
    return {
      x: isMobile ? 36 : 72,
      y: isMobile ? 26 : 40,
      scale: isMobile ? 0.88 : 0.90,
      rotate: 5,
      opacity: 0.65,
      zIndex: 18,
    };
  }
  if (diff >= 3) {
    return {
      x: isMobile ? 50 : 100,
      y: isMobile ? 36 : 56,
      scale: isMobile ? 0.82 : 0.84,
      rotate: 7.5,
      opacity: 0.4,
      zIndex: 12,
    };
  }

  // Cards tucked behind that were already inspected (diff < 0)
  if (diff === -1) {
    return {
      x: isMobile ? -22 : -42,
      y: isMobile ? -14 : -20,
      scale: isMobile ? 0.94 : 0.95,
      rotate: -3,
      opacity: 0.85,
      zIndex: 24,
    };
  }
  if (diff === -2) {
    return {
      x: isMobile ? -38 : -76,
      y: isMobile ? -26 : -36,
      scale: isMobile ? 0.88 : 0.89,
      rotate: -5.5,
      opacity: 0.6,
      zIndex: 16,
    };
  }
  // diff <= -3
  return {
    x: isMobile ? -50 : -102,
    y: isMobile ? -36 : -48,
    scale: isMobile ? 0.82 : 0.83,
    rotate: -7.5,
    opacity: 0.35,
    zIndex: 10,
  };
}

export function CardShuffleShowcase({
  chains,
  initialChainIndex = 0,
  className = "",
}: CardShuffleShowcaseProps) {
  const [chainIdx] = useState(initialChainIndex);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeCardIdxRef = useRef(0);
  const lastStepTimeRef = useRef(0);
  const lockUntilRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const currentChain = chains[chainIdx] || chains[0];
  const nodes = currentChain.nodes.slice(0, 4);

  useEffect(() => {
    activeCardIdxRef.current = activeCardIdx;
  }, [activeCardIdx]);

  // Contained wheel and touch events: scrubs cards in place without scrolling window simultaneously
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 14) return;

      const isDown = e.deltaY > 0;
      const now = performance.now();
      const currentIdx = activeCardIdxRef.current;
      const maxIdx = nodes.length - 1;

      if (isDown) {
        if (currentIdx < maxIdx) {
          // Lock document scroll while scrubbing cards
          e.preventDefault();
          if (now - lastStepTimeRef.current > 320) {
            lastStepTimeRef.current = now;
            const next = currentIdx + 1;
            setActiveCardIdx(next);
            if (next === maxIdx) {
              lockUntilRef.current = now + 700;
            }
          }
        } else {
          // At final card (Step 04)
          if (now < lockUntilRef.current) {
            e.preventDefault();
          }
          // Deliberate scroll down afterwards continues page scroll naturally
        }
      } else {
        // Scrolling UP
        if (currentIdx > 0) {
          // Lock document scroll while scrubbing cards
          e.preventDefault();
          if (now - lastStepTimeRef.current > 320) {
            lastStepTimeRef.current = now;
            const prev = currentIdx - 1;
            setActiveCardIdx(prev);
            if (prev === 0) {
              lockUntilRef.current = now + 700;
            }
          }
        } else {
          // At first card
          if (now < lockUntilRef.current) {
            e.preventDefault();
          }
          // Deliberate scroll up afterwards continues page scroll naturally
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
        const currentIdx = activeCardIdxRef.current;
        const maxIdx = nodes.length - 1;

        if (isNext && currentIdx < maxIdx) {
          setActiveCardIdx(currentIdx + 1);
        } else if (!isNext && currentIdx > 0) {
          setActiveCardIdx(currentIdx - 1);
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
  }, [nodes.length]);

  const selectCard = (idx: number) => {
    setActiveCardIdx(idx);
    lastStepTimeRef.current = performance.now();
  };

  return (
    <div
      ref={containerRef}
      className={`card-shuffle-container ${className}`}
      style={{
        position: "relative",
        height: "clamp(560px, 80vh, 680px)",
        width: "100%",
        marginTop: "clamp(24px, 4vw, 40px)",
        marginBottom: "clamp(24px, 4vw, 40px)",
        borderRadius: 28,
        border: "1px solid rgba(10, 10, 10, 0.08)",
        background: "linear-gradient(180deg, #fafafa 0%, #ffffff 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "20px 14px" : "28px 24px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
      aria-label="Interactive 4-Card Story Pipeline"
    >
      {/* Subtle Ambient Radial Backdrop */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 65% 55% at 50% 50%, rgba(10, 10, 10, 0.02), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Top Control Bar: Chain Title & 4-Step Pill Selectors ── */}
      <div
        style={{
          position: "relative",
          zIndex: 40,
          width: "100%",
          maxWidth: 960,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#10b981",
              boxShadow: "0 0 10px rgba(16, 185, 129, 0.5)",
            }}
          />
          <span
            className="mf-mono"
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "var(--mf-ink-2)",
              textTransform: "uppercase",
            }}
          >
            {currentChain.trigger}
          </span>
        </div>

        {/* 4 Interactive Step Selector Pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {nodes.map((hop, idx) => {
            const isActive = idx === activeCardIdx;
            return (
              <button
                key={hop.step}
                type="button"
                onClick={() => selectCard(idx)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: isActive ? "1px solid #0a0a0a" : "1px solid rgba(10, 10, 10, 0.08)",
                  backgroundColor: isActive ? "#0a0a0a" : "#ffffff",
                  color: isActive ? "#ffffff" : "var(--mf-ink-2)",
                  fontFamily: "var(--mf-mono)",
                  fontSize: isMobile ? "0.68rem" : "0.74rem",
                  fontWeight: isActive ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{hop.step}</span>
                <span>{hop.role.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Central 3D Card Shuffle Arena ── */}
      <div
        className="card-shuffle-arena"
        style={{
          position: "relative",
          width: "100%",
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          perspective: 1200,
          overflow: "visible",
          margin: "12px 0",
        }}
      >
        {/* Subtle Stage Boundary Guide */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: "min(92vw, 920px)",
            height: isMobile ? "300px" : "340px",
            borderRadius: 32,
            border: "1px dashed rgba(10, 10, 10, 0.07)",
            background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(10, 10, 10, 0.012), transparent)",
            pointerEvents: "none",
          }}
        />

        {/* 4 Shuffling Story Cards */}
        <AnimatePresence mode="popLayout">
          {nodes.map((hop, idx) => {
            const isSelected = idx === activeCardIdx;
            const targetTransform = getCardTransform(idx, activeCardIdx, isMobile);

            return (
              <motion.div
                key={`${currentChain.id}-${hop.name}`}
                className="card-shuffle-item"
                onClick={() => selectCard(idx)}
                animate={{
                  x: targetTransform.x,
                  y: targetTransform.y,
                  rotate: targetTransform.rotate,
                  scale: targetTransform.scale,
                  opacity: targetTransform.opacity,
                  zIndex: targetTransform.zIndex,
                }}
                transition={{
                  type: "spring",
                  stiffness: 280,
                  damping: 28,
                  mass: 0.4,
                }}
                style={{
                  position: "absolute",
                  width: isMobile ? "min(90vw, 360px)" : "min(88vw, 520px)",
                  height: isMobile ? 260 : 310,
                  cursor: "pointer",
                  WebkitFontSmoothing: "antialiased",
                  MozOsxFontSmoothing: "grayscale",
                  textRendering: "optimizeLegibility",
                  transformStyle: "preserve-3d",
                  backfaceVisibility: "hidden",
                }}
                whileHover={{
                  scale: isSelected ? 1.02 : targetTransform.scale * 1.02,
                  transition: { duration: 0.16 },
                }}
                whileTap={{ scale: 0.98 }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 24,
                    padding: isMobile ? "18px 20px" : "24px 28px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxSizing: "border-box",
                    backgroundColor: isSelected ? "#0a0a0a" : "#ffffff",
                    color: isSelected ? "#ffffff" : "#0a0a0a",
                    border: isSelected ? "1.5px solid #0a0a0a" : "1px solid #e5e5e5",
                    boxShadow: isSelected
                      ? "0 32px 72px -16px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.12) inset"
                      : "0 18px 40px -12px rgba(0, 0, 0, 0.10), 0 2px 6px rgba(0, 0, 0, 0.03)",
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
                        fontSize: isMobile ? "1.15rem" : "1.38rem",
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
                        fontSize: isMobile ? "0.85rem" : "0.96rem",
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

      {/* ── Bottom Controls: Prev / Next Buttons & Dot Indicators ── */}
      <div
        style={{
          position: "relative",
          zIndex: 40,
          width: "100%",
          maxWidth: 960,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 8,
        }}
      >
        <button
          type="button"
          onClick={() => selectCard(Math.max(0, activeCardIdx - 1))}
          disabled={activeCardIdx === 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid rgba(10, 10, 10, 0.1)",
            backgroundColor: "#ffffff",
            color: activeCardIdx === 0 ? "rgba(10, 10, 10, 0.25)" : "var(--mf-ink)",
            cursor: activeCardIdx === 0 ? "not-allowed" : "pointer",
            fontFamily: "var(--mf-mono)",
            fontSize: "0.75rem",
            fontWeight: 500,
            transition: "all 0.2s ease",
          }}
          aria-label="Previous step"
        >
          <ChevronLeft size={14} />
          <span>Back</span>
        </button>

        {/* Center: Dot Indicators and Micro-Hint */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {nodes.map((_, dotIdx) => (
              <span
                key={dotIdx}
                onClick={() => selectCard(dotIdx)}
                style={{
                  width: dotIdx === activeCardIdx ? 18 : 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: dotIdx === activeCardIdx ? "#0a0a0a" : "rgba(10, 10, 10, 0.2)",
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
          <span
            className="mf-mono"
            style={{
              fontSize: "0.68rem",
              color: "var(--mf-ink-3)",
              letterSpacing: "0.04em",
            }}
          >
            Scroll or swipe to advance · Step {activeCardIdx + 1} of {nodes.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => selectCard(Math.min(nodes.length - 1, activeCardIdx + 1))}
          disabled={activeCardIdx === nodes.length - 1}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid rgba(10, 10, 10, 0.1)",
            backgroundColor: "#ffffff",
            color: activeCardIdx === nodes.length - 1 ? "rgba(10, 10, 10, 0.25)" : "var(--mf-ink)",
            cursor: activeCardIdx === nodes.length - 1 ? "not-allowed" : "pointer",
            fontFamily: "var(--mf-mono)",
            fontSize: "0.75rem",
            fontWeight: 500,
            transition: "all 0.2s ease",
          }}
          aria-label="Next step"
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
