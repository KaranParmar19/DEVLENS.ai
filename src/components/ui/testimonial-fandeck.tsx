import React, { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { motion } from "motion/react";

export interface FanDeckCard {
  id?: string;
  // Architectural comparison format
  category?: string;
  task?: string;
  grepFlaw?: string;
  llmFlaw?: string;
  devlensAdvantage?: string;
  detail?: string;
  badge?: string;
  // Testimonial format (Framer parity)
  quote?: string;
  author?: string;
  role?: string;
  avatar?: { src: string; alt?: string };
  // Visual overrides
  color?: string;
  rotation?: number;
}

export interface TestimonialFanDeckProps {
  cards?: FanDeckCard[];
  testimonials?: Array<{
    quote?: string;
    author?: string;
    role?: string;
    avatar?: { src: string; alt?: string };
    color?: string;
    rotation?: number;
  }>;
  cardWidth?: number;
  cardHeight?: number;
  cardRadius?: number;
  cardPadding?: number;
  overlap?: number;
  lift?: number;
  hoverScale?: number;
  sectionPadding?: number;
  className?: string;
  style?: React.CSSProperties;
  enableTableViewToggle?: boolean;
}

export const DEFAULT_COMPARISON_CARDS: FanDeckCard[] = [
  {
    id: "call-hierarchy",
    category: "01 / CALL GRAPH",
    task: "Cross-file call hierarchy",
    grepFlaw: "Manual file-by-file text jumping",
    llmFlaw: "Guesses unindexed imports & hallucinated calls",
    devlensAdvantage: "Resolved Tree-sitter import graph",
    detail: "Traverses AST nodes, symbol declarations, and cross-file reference edges deterministically.",
    badge: "Tree-sitter WASM · 100% Deterministic",
    rotation: -7,
  },
  {
    id: "blast-radius",
    category: "02 / BLAST RADIUS",
    task: "Commit impact check",
    grepFlaw: "Raw line diff only with zero dependency awareness",
    llmFlaw: "Blind single-file edits without cross-file caller checks",
    devlensAdvantage: "Direct and indirect dependent check",
    detail: "Traces 1-hop and 2-hop caller graphs across every package before merging changes.",
    badge: "Impact Analysis · Call Graph Traversal",
    rotation: -3.5,
  },
  {
    id: "citations",
    category: "03 / CITATIONS",
    task: "Source code citations",
    grepFlaw: "String match only with noisy false positives",
    llmFlaw: "Unverified markdown snippets with fabricated line numbers",
    devlensAdvantage: "Clickable file and line links",
    detail: "Every node and citation anchors to verified file and line byte offsets in the syntax tree.",
    badge: "Verified Anchors · file:line Links",
    rotation: 0,
  },
  {
    id: "onboarding",
    category: "04 / ONBOARDING",
    task: "New engineer onboarding",
    grepFlaw: "Reading folders by hand without entry point guidance",
    llmFlaw: "Outdated README summaries drifted months ago",
    devlensAdvantage: "Generated architecture blueprint",
    detail: "Live structural map of routes, stores, controllers, and event loops computed from source.",
    badge: "Live Blueprint · Generated from Source",
    rotation: 3.5,
  },
  {
    id: "sandbox",
    category: "05 / ISOLATION",
    task: "Code privacy & memory",
    grepFlaw: "Local only, zero structural intelligence",
    llmFlaw: "Cloud code ingestion & training leak risks",
    devlensAdvantage: "Ephemeral in-memory sandbox",
    detail: "Zero code bytes stored on disk or server. In-memory Tree-sitter index discarded on close.",
    badge: "Ephemeral Clone · 0 Bytes Retained",
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

export function TestimonialFanDeck({
  cards,
  testimonials,
  cardWidth = 280,
  cardHeight = 390,
  cardRadius = 20,
  cardPadding = 24,
  overlap = 48,
  lift = 28,
  hoverScale = 1.04,
  sectionPadding = 24,
  className = "",
  style,
  enableTableViewToggle = true,
}: TestimonialFanDeckProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeScrollIdx, setActiveScrollIdx] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"deck" | "table">("deck");

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

  const safeCards = useMemo<FanDeckCard[]>(() => {
    if (cards && Array.isArray(cards) && cards.length > 0) {
      return cards;
    }
    if (testimonials && Array.isArray(testimonials) && testimonials.length > 0) {
      return testimonials.map((t, idx) => ({
        id: `t-${idx}`,
        quote: t.quote ?? "",
        author: t.author ?? "",
        role: t.role ?? "",
        avatar: t.avatar,
        color: t.color,
        rotation: typeof t.rotation === "number" ? t.rotation : (idx - Math.floor(testimonials.length / 2)) * 3.5,
      }));
    }
    return DEFAULT_COMPARISON_CARDS;
  }, [cards, testimonials]);

  const count = safeCards.length;

  // Responsive overlap calculation so deck never overflows container on desktop
  const effectiveOverlap = useMemo(() => {
    return calculateFandeckOverlap(count, cardWidth, overlap, containerWidth, isMobile);
  }, [isMobile, count, containerWidth, cardWidth, overlap]);

  const desktopStackWidth = useMemo(() => {
    if (count <= 0) return 0;
    return cardWidth * count - effectiveOverlap * (count - 1);
  }, [count, cardWidth, effectiveOverlap]);

  // Framer hover spring physics
  const hoverSpring = useMemo(
    () => ({
      type: "spring" as const,
      stiffness: 380,
      damping: 26,
    }),
    []
  );

  // Mobile scroll tracking
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
        ...style,
      }}
    >
      {/* Switcher Header (Deck View vs Table View) */}
      {enableTableViewToggle && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginBottom: 24,
            gap: 8,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px",
              borderRadius: "8px",
              background: "var(--mf-soft, #f5f5f5)",
              border: "1px solid var(--mf-line, #d9d9d9)",
              fontSize: "11px",
              fontFamily: "var(--mf-mono, monospace)",
              letterSpacing: "0.04em",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("deck")}
              style={{
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: viewMode === "deck" ? "var(--mf-ink, #0a0a0a)" : "transparent",
                color: viewMode === "deck" ? "var(--mf-bg, #ffffff)" : "var(--mf-ink-2, #595959)",
                fontWeight: viewMode === "deck" ? 600 : 400,
                transition: "all 0.15s ease",
              }}
            >
              Fandeck
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              style={{
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: viewMode === "table" ? "var(--mf-ink, #0a0a0a)" : "transparent",
                color: viewMode === "table" ? "var(--mf-bg, #ffffff)" : "var(--mf-ink-2, #595959)",
                fontWeight: viewMode === "table" ? 600 : 400,
                transition: "all 0.15s ease",
              }}
            >
              Table View
            </button>
          </div>
        </div>
      )}

      {viewMode === "table" ? (
        /* Accessible Table Fallback */
        <div style={{ overflowX: "auto", width: "100%" }}>
          <table className="feat-matrix">
            <thead>
              <tr>
                <th>Task</th>
                <th>IDE search / grep</th>
                <th>Generic LLM chat</th>
                <th>DevLens AST Engine</th>
              </tr>
            </thead>
            <tbody>
              {safeCards.map((card, idx) => (
                <tr key={card.id ?? idx}>
                  <td>{card.task ?? card.author}</td>
                  <td className="mf-muted">{card.grepFlaw ?? "Manual text search"}</td>
                  <td className="mf-muted">{card.llmFlaw ?? "Unindexed inference"}</td>
                  <td>
                    <strong>{card.devlensAdvantage ?? card.quote}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Interactive Fan Deck Experience */
        <div
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: `${sectionPadding}px 0`,
            boxSizing: "border-box",
            overflow: "visible",
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
              paddingTop: isMobile ? 16 : 40,
              paddingBottom: isMobile ? 24 : 40,
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
            {safeCards.map((card, idx) => {
              const marginLeft = isMobile ? 0 : idx === 0 ? 0 : -Math.abs(effectiveOverlap);
              const baseRotate = isMobile ? 0 : card.rotation ?? 0;
              const isHovered = hoveredIndex === idx;
              const isSelected = selectedIndex === idx;
              const isTargeted = isHovered || isSelected;

              return (
                <motion.div
                  key={card.id ?? `card-${idx}`}
                  role="listitem"
                  tabIndex={0}
                  aria-label={card.task ?? card.author ?? `Card ${idx + 1}`}
                  initial={{ opacity: 0, y: 24, rotate: baseRotate }}
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
                    width: isMobile ? "clamp(260px, 80vw, 320px)" : cardWidth,
                    minHeight: cardHeight,
                    flexShrink: 0,
                    marginLeft,
                    padding: cardPadding,
                    boxSizing: "border-box",
                    borderRadius: cardRadius,
                    background: card.color ?? "var(--mf-soft, #f5f5f5)",
                    color: "var(--mf-ink, #0a0a0a)",
                    border: isTargeted
                      ? "1px solid var(--mf-ink, #0a0a0a)"
                      : "1px solid var(--mf-line, #d9d9d9)",
                    boxShadow: isTargeted
                      ? "0 28px 56px -12px rgba(0, 0, 0, 0.16), 0 0 0 1px var(--mf-ink, #0a0a0a)"
                      : "0 10px 24px -8px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--mf-line, #d9d9d9)",
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
                  }}
                >
                  {/* Card Top: Index, Category, and Pill */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 16,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--mf-mono, monospace)",
                          fontSize: "11px",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: isTargeted ? "var(--mf-ink, #0a0a0a)" : "var(--mf-ink-2, #595959)",
                          fontWeight: 600,
                        }}
                      >
                        {card.category ?? `0${idx + 1} / CAPABILITY`}
                      </span>

                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          fontSize: "10px",
                          fontFamily: "var(--mf-mono, monospace)",
                          letterSpacing: "0.04em",
                          background: isTargeted
                            ? "var(--mf-ink, #0a0a0a)"
                            : "var(--mf-soft-2, #ebebeb)",
                          color: isTargeted ? "var(--mf-bg, #ffffff)" : "var(--mf-ink, #0a0a0a)",
                          fontWeight: 600,
                          transition: "all 0.15s ease",
                        }}
                      >
                        AST
                      </span>
                    </div>

                    {/* Task Title */}
                    <h3
                      style={{
                        margin: "0 0 16px 0",
                        fontSize: "18px",
                        lineHeight: 1.28,
                        fontWeight: 600,
                        letterSpacing: "-0.02em",
                        color: "var(--mf-ink, #0a0a0a)",
                      }}
                    >
                      {card.task ?? card.quote}
                    </h3>

                    {/* Contrast Breakdown: Legacy Grep & LLM Flaws */}
                    {card.grepFlaw && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          marginBottom: 16,
                        }}
                      >
                        {/* IDE Grep Flaw */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            fontSize: "12px",
                            lineHeight: 1.4,
                            color: "var(--mf-ink-2, #595959)",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--mf-mono, monospace)",
                              fontSize: "10px",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              background: "rgba(220, 38, 38, 0.1)",
                              color: "#dc2626",
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            GREP
                          </span>
                          <span>{card.grepFlaw}</span>
                        </div>

                        {/* Generic LLM Flaw */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            fontSize: "12px",
                            lineHeight: 1.4,
                            color: "var(--mf-ink-2, #595959)",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--mf-mono, monospace)",
                              fontSize: "10px",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              background: "rgba(220, 38, 38, 0.1)",
                              color: "#dc2626",
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            LLM
                          </span>
                          <span>{card.llmFlaw}</span>
                        </div>
                      </div>
                    )}

                    {/* DevLens AST Resolution Pill Box */}
                    {card.devlensAdvantage && (
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: "12px",
                          background: "var(--mf-bg, #ffffff)",
                          border: isTargeted
                            ? "1px solid var(--mf-ink, #0a0a0a)"
                            : "1px solid var(--mf-line, #d9d9d9)",
                          marginTop: 8,
                          transition: "border-color 0.15s ease",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontFamily: "var(--mf-mono, monospace)",
                            fontSize: "10px",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: "var(--mf-ink, #0a0a0a)",
                            fontWeight: 700,
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ color: "#059669", fontWeight: 700 }}>✓</span>
                          DEVLENS AST
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "var(--mf-ink, #0a0a0a)",
                            lineHeight: 1.35,
                          }}
                        >
                          {card.devlensAdvantage}
                        </div>
                      </div>
                    )}

                    {/* Detailed explanation */}
                    {card.detail && (
                      <p
                        style={{
                          margin: "12px 0 0 0",
                          fontSize: "12px",
                          lineHeight: 1.45,
                          color: "var(--mf-ink-2, #595959)",
                        }}
                      >
                        {card.detail}
                      </p>
                    )}

                    {/* Testimonial Author & Role (Framer Mode) */}
                    {card.author && (
                      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
                        {card.avatar?.src && (
                          <img
                            src={card.avatar.src}
                            alt={card.avatar.alt ?? card.author}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "999px",
                              objectFit: "cover",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--mf-ink, #0a0a0a)" }}>
                            {card.author}
                          </div>
                          {card.role && (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "var(--mf-ink-2, #595959)",
                                marginTop: 2,
                              }}
                            >
                              {card.role}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom: Technical Tag Badge */}
                  <div
                    style={{
                      borderTop: "1px solid var(--mf-line, #d9d9d9)",
                      paddingTop: 14,
                      marginTop: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--mf-mono, monospace)",
                        fontSize: "11px",
                        letterSpacing: "0.04em",
                        color: "var(--mf-ink-2, #595959)",
                      }}
                    >
                      {card.badge ?? "Exact AST Precision"}
                    </span>

                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "var(--mf-mono, monospace)",
                        color: isTargeted
                          ? "var(--mf-ink, #0a0a0a)"
                          : "var(--mf-ink-3, #7a7a7a)",
                        transition: "color 0.15s ease",
                      }}
                    >
                      {isTargeted ? "Pinned" : "Hover / Tap"}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Mobile Reel Pagination Dots */}
          {isMobile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 16,
              }}
            >
              {safeCards.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollToCard(i)}
                  aria-label={`Jump to comparison card ${i + 1}`}
                  style={{
                    width: activeScrollIdx === i ? 20 : 6,
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

          {/* Interactive Hint for Desktop */}
          {!isMobile && (
            <div
              style={{
                marginTop: 20,
                fontFamily: "var(--mf-mono, monospace)",
                fontSize: "11px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--mf-ink-3, #7a7a7a)",
                textAlign: "center",
              }}
            >
              Hover card to inspect · Click to lock in focus
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TestimonialFanDeck;
