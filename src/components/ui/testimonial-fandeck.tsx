import React, { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { motion } from "motion/react";

export interface FanDeckCard {
  id: string;
  category: string;
  badge: string;
  headline: string;
  description: string;
  footerTag: string;
  status: string;
  rotation: number;
}

export const DEFAULT_COMPARISON_CARDS: FanDeckCard[] = [
  {
    id: "call-hierarchy",
    category: "01 / CALL GRAPH",
    badge: "TREE-SITTER",
    headline: "Grep matches text strings. DevLens traverses the AST.",
    description: "Resolves cross-file exports, symbol declarations, and call sites into an explicit AST graph instead of manual file jumps.",
    footerTag: "WASM Call Graph",
    status: "DETERMINISTIC",
    rotation: -7,
  },
  {
    id: "blast-radius",
    category: "02 / BLAST RADIUS",
    badge: "DEPENDENCY",
    headline: "Line diffs show what changed. DevLens traces who breaks.",
    description: "Traces direct and indirect callers across 1-hop and 2-hop dependencies before you merge changes to production.",
    footerTag: "2-Hop Blast Radius",
    status: "VERIFIED",
    rotation: -3.5,
  },
  {
    id: "citations",
    category: "03 / CITATIONS",
    badge: "BYTE OFFSET",
    headline: "Chat guesses line numbers. DevLens cites syntax nodes.",
    description: "Every citation links to exact file and line coordinates verified against live Tree-sitter parser byte offsets.",
    footerTag: "Exact file:line Links",
    status: "VERIFIED",
    rotation: 0,
  },
  {
    id: "onboarding",
    category: "04 / ONBOARDING",
    badge: "LIVE SOURCE",
    headline: "READMEs drift in silence. DevLens maps live code.",
    description: "Generates structural architecture blueprints of routes, state stores, and controllers directly from active code.",
    footerTag: "Source-Derived Map",
    status: "LIVE BLUEPRINT",
    rotation: 3.5,
  },
  {
    id: "sandbox",
    category: "05 / ISOLATION",
    badge: "IN-MEMORY",
    headline: "Cloud models store code. DevLens stays ephemeral.",
    description: "In-memory ephemeral clone. Zero code bytes written to disk or stored on remote servers after your session closes.",
    footerTag: "0 Bytes Retained",
    status: "EPHEMERAL",
    rotation: 7,
  },
];

export function calculateFandeckOverlap(
  count: number,
  cardWidth: number,
  overlap: number,
  containerWidth: number,
  isMobile: boolean
): number {
  if (isMobile || count <= 1 || containerWidth <= 0) return overlap;
  const naturalWidth = cardWidth * count - overlap * (count - 1);
  const maxAllowedWidth = Math.max(300, containerWidth - 40);
  if (naturalWidth > maxAllowedWidth) {
    const requiredOverlap = Math.ceil((cardWidth * count - maxAllowedWidth) / (count - 1));
    return Math.min(Math.max(requiredOverlap, 36), Math.floor(cardWidth * 0.65));
  }
  return overlap;
}

export interface TestimonialFanDeckProps {
  cards?: FanDeckCard[];
  cardWidth?: number;
  cardHeight?: number;
  cardRadius?: number;
  cardPadding?: number;
  overlap?: number;
  lift?: number;
  hoverScale?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function TestimonialFanDeck({
  cards = DEFAULT_COMPARISON_CARDS,
  cardWidth = 285,
  cardHeight = 370,
  cardRadius = 20,
  cardPadding = 26,
  overlap = 46,
  lift = 24,
  hoverScale = 1.03,
  className = "",
  style,
}: TestimonialFanDeckProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeScrollIdx, setActiveScrollIdx] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = rootRef.current;
    if (!el) return;

    const update = () => {
      const next = el.getBoundingClientRect().width;
      startTransition(() => setContainerWidth(next));
    };

    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isMobile = containerWidth > 0 ? containerWidth <= 720 : false;
  const count = cards.length;

  const effectiveOverlap = useMemo(() => {
    return calculateFandeckOverlap(count, cardWidth, overlap, containerWidth, isMobile);
  }, [isMobile, count, containerWidth, cardWidth, overlap]);

  const desktopStackWidth = useMemo(() => {
    if (count <= 0) return 0;
    return cardWidth * count - effectiveOverlap * (count - 1);
  }, [count, cardWidth, effectiveOverlap]);

  const hoverSpring = useMemo(
    () => ({
      type: "spring" as const,
      stiffness: 380,
      damping: 26,
    }),
    []
  );

  const handleScroll = () => {
    if (!scrollTrackRef.current) return;
    const el = scrollTrackRef.current;
    const scrollLeft = el.scrollLeft;
    const cardStep = el.scrollWidth / count;
    const current = Math.round(scrollLeft / cardStep);
    setActiveScrollIdx(Math.min(Math.max(0, current), count - 1));
  };

  const scrollToCard = (index: number) => {
    if (!scrollTrackRef.current) return;
    const el = scrollTrackRef.current;
    const children = el.children;
    if (children[index]) {
      (children[index] as HTMLElement).scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
      setActiveScrollIdx(index);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`fandeck-root ${className}`}
      style={{
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
        padding: "16px 0 28px 0",
        ...style,
      }}
    >
      {/* Deck Container */}
      <div
        ref={scrollTrackRef}
        onScroll={isMobile ? handleScroll : undefined}
        role="list"
        aria-label="Architectural comparison fandeck"
        className="fandeck-track"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "stretch",
          justifyContent: isMobile ? "flex-start" : "center",
          flexDirection: "row",
          width: isMobile ? "100%" : desktopStackWidth || undefined,
          maxWidth: "100%",
          overflowX: isMobile ? "auto" : "visible",
          overflowY: isMobile ? "hidden" : "visible",
          paddingTop: isMobile ? 12 : 32,
          paddingBottom: isMobile ? 16 : 32,
          paddingLeft: isMobile ? 16 : 0,
          paddingRight: isMobile ? 16 : 0,
          marginLeft: isMobile ? 0 : "auto",
          marginRight: isMobile ? 0 : "auto",
          gap: isMobile ? 16 : 0,
          scrollSnapType: isMobile ? "x mandatory" : undefined,
          WebkitOverflowScrolling: isMobile ? "touch" : undefined,
          touchAction: isMobile ? "pan-x" : undefined,
        }}
      >
        {cards.map((card, idx) => {
          const marginLeft = isMobile ? 0 : idx === 0 ? 0 : -Math.abs(effectiveOverlap);
          const baseRotate = isMobile ? 0 : card.rotation;
          const isHovered = hoveredIndex === idx;
          const isSelected = selectedIndex === idx;
          const isTargeted = isHovered || isSelected;

          return (
            <motion.div
              key={card.id}
              role="listitem"
              tabIndex={0}
              aria-label={card.headline}
              initial={{ opacity: 0, y: 20, rotate: baseRotate }}
              animate={{
                opacity: 1,
                y: isTargeted ? -Math.abs(lift) : 0,
                rotate: isTargeted ? 0 : baseRotate,
                scale: isTargeted ? Math.max(1, hoverScale) : 1,
              }}
              transition={hoverSpring}
              onHoverStart={() => startTransition(() => setHoveredIndex(idx))}
              onHoverEnd={() => startTransition(() => setHoveredIndex(null))}
              onClick={() => {
                startTransition(() => {
                  setSelectedIndex((prev) => (prev === idx ? null : idx));
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedIndex((prev) => (prev === idx ? null : idx));
                }
                if (e.key === "Escape") {
                  setSelectedIndex(null);
                  (e.currentTarget as HTMLElement).blur();
                }
              }}
              style={{
                position: "relative",
                width: isMobile ? "clamp(260px, 80vw, 310px)" : cardWidth,
                minHeight: cardHeight,
                flexShrink: 0,
                marginLeft,
                padding: cardPadding,
                boxSizing: "border-box",
                borderRadius: cardRadius,
                background: "#0D0E12",
                color: "#FFFFFF",
                border: isTargeted
                  ? "1px solid rgba(255, 255, 255, 0.45)"
                  : "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: isTargeted
                  ? "0 28px 56px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.2)"
                  : "0 12px 28px -8px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.06)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                outline: "none",
                zIndex: isTargeted ? 50 : idx + 1,
                userSelect: "none",
                scrollSnapAlign: isMobile ? "center" : undefined,
                willChange: "transform, z-index, box-shadow",
                transformOrigin: "bottom center",
                transition: "border-color 0.2s ease",
              }}
            >
              {/* Card Header & Body */}
              <div>
                {/* Meta Row: Clean Category on Left, Non-overlapping Badge on Right */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: "10px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: isTargeted ? "#FFFFFF" : "rgba(255, 255, 255, 0.55)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      transition: "color 0.15s ease",
                    }}
                  >
                    {card.category}
                  </span>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 7px",
                      borderRadius: "6px",
                      fontSize: "9px",
                      fontFamily: "var(--mf-mono, monospace)",
                      letterSpacing: "0.06em",
                      background: "rgba(255, 255, 255, 0.08)",
                      color: "rgba(255, 255, 255, 0.8)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {card.badge}
                  </span>
                </div>

                {/* Primary Headline */}
                <h3
                  style={{
                    margin: "0 0 14px 0",
                    fontSize: "17px",
                    lineHeight: 1.32,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    color: "#FFFFFF",
                  }}
                >
                  {card.headline}
                </h3>

                {/* Body Prose with Generous Breathing Room */}
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    lineHeight: 1.5,
                    color: "rgba(255, 255, 255, 0.65)",
                  }}
                >
                  {card.description}
                </p>
              </div>

              {/* Card Footer: Clean Metric Tag on Left, Status Pill on Right */}
              <div
                style={{
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  paddingTop: 14,
                  marginTop: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--mf-mono, monospace)",
                    fontSize: "11px",
                    letterSpacing: "0.02em",
                    color: "rgba(255, 255, 255, 0.6)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {card.footerTag}
                </span>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: "10px",
                    fontFamily: "var(--mf-mono, monospace)",
                    letterSpacing: "0.04em",
                    color: "#34D399",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "999px",
                      background: "#34D399",
                    }}
                  />
                  {card.status}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Mobile Swipe Pagination Dots */}
      {isMobile && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 12,
          }}
        >
          {cards.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToCard(i)}
              aria-label={`Go to card ${i + 1}`}
              style={{
                width: activeScrollIdx === i ? 18 : 6,
                height: 6,
                borderRadius: "999px",
                background:
                  activeScrollIdx === i
                    ? "var(--mf-ink, #0a0a0a)"
                    : "var(--mf-line, #d9d9d9)",
                border: "none",
                padding: 0,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default TestimonialFanDeck;
