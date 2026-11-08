import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";

export interface PolaroidSlide {
  index: string;
  pill?: string;
  prefix?: string;
  value: string | number;
  suffix?: string;
  label: string;
  description: string;
  snippetType: "chips" | "lenses" | "citation" | "security";
  snippetItems?: string[];
  snippetText?: string;
  snippetSubtext?: string;
}

export const DEVLENS_POLAROID_SLIDES: PolaroidSlide[] = [
  {
    index: "01",
    value: 8,
    suffix: "",
    label: "Languages supported",
    description: "Resolves imports and symbols across TypeScript, JavaScript, Python, Go, Java, Rust, Ruby, and PHP.",
    snippetType: "chips",
    snippetItems: ["TS", "JS", "PY", "GO", "RS", "JAVA", "RUBY", "PHP"],
    snippetSubtext: "Tree-sitter AST support",
  },
  {
    index: "02",
    value: 5,
    suffix: "",
    label: "Interactive views",
    description: "Switch between the dependency map, request tracer, commit history, Q&A, and onboarding notes.",
    snippetType: "lenses",
    snippetItems: ["Dependency Map", "Request Tracer", "Commit History", "Code Q&A", "Onboarding Notes"],
    snippetSubtext: "One shared syntax graph",
  },
  {
    index: "03",
    value: 100,
    suffix: "%",
    label: "Answers linked to code",
    description: "Every Q&A response cites the exact repository file path and line range it used.",
    snippetType: "citation",
    snippetText: "src/auth.ts:42-88",
    snippetSubtext: "Exact file and line citations",
  },
  {
    index: "04",
    value: 0,
    suffix: "MB",
    label: "Code kept on disk",
    description: "Repositories clone into a temporary directory for parsing and are deleted when your session ends.",
    snippetType: "security",
    snippetText: "Temporary parse directory",
    snippetSubtext: "Deleted when session ends",
  },
  {
    index: "05",
    value: 14,
    suffix: "+",
    label: "Transitive blast radius",
    description: "Traces reverse dependency paths before PRs merge to predict cascading breakage across shared modules.",
    snippetType: "security",
    snippetText: "HIGH BLAST: +14 sinks",
    snippetSubtext: "Downstream sink impact audit",
  },
  {
    index: "06",
    prefix: "< ",
    value: 2,
    suffix: "s",
    label: "Deterministic AST parsing",
    description: "Tree-sitter syntax engines extract callers, callees, and type definitions without compiling the project.",
    snippetType: "chips",
    snippetItems: ["Tree-sitter", "Symbol Graph", "Call Trees", "Zero Build Step"],
    snippetSubtext: "Sub-second syntax indexing",
  },
];

export interface PolaroidLineCarouselProps {
  slides?: PolaroidSlide[];
  height?: string | number;
  cardWidth?: number;
  sag?: number;
  swing?: number;
  autoplay?: number;
  stringColor?: string;
  backgroundColor?: string;
  inkColor?: string;
  className?: string;
}

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

function stringY(x: number, w: number, y0: number, sag: number): number {
  const t = clamp(x / w, 0, 1);
  return y0 + 4 * sag * t * (1 - t);
}

function springStep(x: number, v: number, target: number, dt: number, k = 70): [number, number] {
  const c = 2 * Math.sqrt(k);
  const nv = v + (k * (target - x) - c * v) * dt;
  return [x + nv * dt, nv];
}

function swingStep(a: number, w: number, lineVel: number, dt: number, gain: number): [number, number] {
  const nw = w + (-38 * a - 4.2 * w + lineVel * 0.0034 * gain) * dt;
  return [clamp(a + nw * dt, -0.55, 0.55), nw];
}

function nearestAt(off: number, spacing: number, n: number): number {
  return clamp(Math.round(off / spacing), 0, Math.max(0, n - 1));
}

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function parseMetric(val: string | number, suff?: string, pref?: string) {
  let raw = String(val).trim();
  let prefix = pref || "";
  let suffix = suff || "";

  if (!prefix && raw.startsWith("<")) {
    prefix = "< ";
    raw = raw.replace(/^<\s*/, "");
  }

  if (!suffix) {
    const match = raw.match(/^([0-9]+)(.*)$/);
    if (match) {
      raw = match[1];
      suffix = match[2].trim();
    }
  } else {
    const match = raw.match(/^([0-9]+)(.*)$/);
    if (match) {
      raw = match[1];
      const extra = match[2].trim();
      if (extra && !suffix.startsWith(extra)) {
        suffix = extra + suffix;
      }
    }
  }

  return { prefix, digits: raw, suffix };
}

export function PolaroidLineCarousel({
  slides = DEVLENS_POLAROID_SLIDES,
  height = "clamp(500px, 58vh, 560px)",
  cardWidth = 330,
  sag = 28,
  swing = 1,
  autoplay = 0,
  stringColor = "rgba(10, 10, 10, 0.24)",
  backgroundColor = "transparent",
  inkColor = "var(--mf-ink, #0a0a0a)",
  className = "",
}: PolaroidLineCarouselProps) {
  const n = slides.length;
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState({ w: 1200, h: 540, cw: cardWidth });

  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const sim = useRef<{
    off: number;
    vel: number;
    target: number;
    a: number[];
    w: number[];
  }>({
    off: 0,
    vel: 0,
    target: 0,
    a: new Array(n).fill(0),
    w: new Array(n).fill(0),
  });

  const drag = useRef<{
    x: number;
    off: number;
    lx: number;
    lt: number;
    v: number;
    moved: boolean;
  } | null>(null);

  const lastTouch = useRef(0);
  const activeRef = useRef(0);
  const opts = useRef({ sag, swing });
  opts.current = { sag, swing };

  const spacing = size.cw * 1.15;

  const goTo = useCallback(
    (i: number) => {
      const idx = clamp(i, 0, n - 1);
      sim.current.target = idx * spacing;
    },
    [n, spacing]
  );

  // ResizeObserver to adapt dynamically to container width
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const ro = new ResizeObserver(() => {
      const r = root.getBoundingClientRect();
      const cw = Math.round(Math.max(260, Math.min(cardWidth, r.width - 48, r.height * 0.62)));
      setSize({ w: r.width, h: r.height, cw });
    });

    ro.observe(root);
    return () => ro.disconnect();
  }, [cardWidth]);

  useEffect(() => {
    sim.current.target = activeRef.current * spacing;
    sim.current.off = activeRef.current * spacing;
  }, [spacing]);

  // Main Physics Simulation Loop (Parabolic string sag + swinging clothespins)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let visible = true;
    let raf = 0;
    let prev = performance.now();
    const S = sim.current;

    const frame = (now: number) => {
      raf = 0;
      if (!visible) return;

      const dt = Math.min(0.033, (now - prev) / 1000);
      prev = now;

      const { w, h, cw } = size;
      const y0 = Math.max(28, Math.min(38, Math.round(h * 0.065)));
      const d = drag.current;
      let lineVel: number;

      if (d && d.moved) {
        lineVel = d.v * 1000;
      } else {
        const before = S.off;
        [S.off, S.vel] = springStep(S.off, S.vel, S.target, dt);
        lineVel = -(S.off - before) / Math.max(dt, 0.001);
      }

      const o = opts.current;
      const g = reduce ? 0 : o.swing;
      const near = nearestAt(S.off, spacing, n);

      for (let i = 0; i < n; i++) {
        const el = cards.current[i];
        if (!el) continue;

        const x = w / 2 + i * spacing - S.off;
        if (x < -cw * 1.5 || x > w + cw * 1.5) {
          el.style.visibility = "hidden";
          continue;
        }

        el.style.visibility = "visible";
        let a = S.a[i] || 0;
        let av = S.w[i] || 0;
        [a, av] = swingStep(a, av, lineVel, dt, g);

        // Ambient idle breeze
        if (g) {
          a += Math.sin(now / 1400 + i * 1.7) * 0.0007 * g;
        }

        S.a[i] = a;
        S.w[i] = av;

        const y = stringY(x, w, y0, o.sag) - 6;
        el.style.transform = `translate(${(x - cw / 2).toFixed(1)}px, ${y.toFixed(1)}px) rotate(${a.toFixed(4)}rad)`;
        el.style.zIndex = String(i === near ? n + 2 : n - Math.abs(i - near));
      }

      pathRef.current?.setAttribute(
        "d",
        `M0 ${y0} Q${w / 2} ${y0 + 2 * o.sag} ${w} ${y0}`
      );

      if (near !== activeRef.current) {
        activeRef.current = near;
        setActive(near);
      }

      raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) {
        prev = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });

    io.observe(root);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [size, spacing, n]);

  // Autoplay support if enabled
  useEffect(() => {
    if (!autoplay || n < 2) return;
    const t = window.setInterval(() => {
      if (
        typeof document !== "undefined" &&
        (document.hidden ||
          drag.current ||
          performance.now() - lastTouch.current < autoplay)
      ) {
        return;
      }
      goTo(activeRef.current >= n - 1 ? 0 : activeRef.current + 1);
    }, autoplay);

    return () => window.clearInterval(t);
  }, [autoplay, n, goTo]);

  // Pointer Drag Handlers
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".pl-bar, .pl-btn, button")) return;
    lastTouch.current = performance.now();
    drag.current = {
      x: e.clientX,
      off: sim.current.off,
      lx: e.clientX,
      lt: e.timeStamp,
      v: 0,
      moved: false,
    };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;

    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 5) {
      d.moved = true;
      setDragging(true);
      rootRef.current?.setPointerCapture(e.pointerId);
    }

    if (!d.moved) return;

    const dt = Math.max(1, e.timeStamp - d.lt);
    d.v = 0.7 * ((e.clientX - d.lx) / dt) + 0.3 * d.v;
    d.lx = e.clientX;
    d.lt = e.timeStamp;

    const max = (n - 1) * spacing;
    let off = d.off - dx;

    // Boundary rubber-band dampening
    if (off < 0) off *= 0.35;
    if (off > max) off = max + (off - max) * 0.35;

    sim.current.off = off;
  };

  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    lastTouch.current = performance.now();

    if (!d) return;

    if (d.moved) {
      setDragging(false);
      sim.current.vel = -d.v * 1000;
      goTo(nearestAt(sim.current.off - d.v * 180, spacing, n));
      return;
    }

    const card = (e.target as HTMLElement).closest("[data-i]");
    if (card) {
      const idx = Number(card.getAttribute("data-i"));
      goTo(idx);
    }
  };

  const step = (dir: number) => {
    lastTouch.current = performance.now();
    goTo(clamp(activeRef.current + dir, 0, n - 1));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
    else return;
    e.preventDefault();
  };

  const currentSlide = slides[active] ?? slides[0];

  return (
    <div className={`pl-carousel-section ${className}`}>
      {/* Hanging Stage with Wire & Cards */}
      <div
        ref={rootRef}
        className="pl-root"
        style={{
          height,
          ["--pl-bg" as any]: backgroundColor,
          ["--pl-ink" as any]: inkColor,
          ["--pl-cw" as any]: `${size.cw}px`,
        }}
        data-drag={dragging ? "1" : "0"}
        role="region"
        aria-roledescription="carousel"
        aria-label="DevLens Architecture Line Carousel"
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* Hanging Suspension Wire String */}
        <svg className="pl-string" aria-hidden="true">
          <path
            ref={pathRef}
            fill="none"
            stroke={stringColor}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        {/* Hanging Spec Cards */}
        {slides.map((sl, i) => (
          <div
            key={sl.index}
            className="pl-card"
            data-i={i}
            data-on={i === active ? "1" : "0"}
            ref={(el) => {
              cards.current[i] = el;
            }}
            aria-hidden={i === active ? undefined : true}
          >
            {/* Hanging Clothespin Peg */}
            <div className="pl-peg" aria-hidden="true" />

            {/* Polaroid Spec Card Content */}
            <div className="pl-print">
              {/* Top Row: Index */}
              <div className="pl-card-top">
                <span className="pl-card-index">{sl.index}</span>
              </div>

              {/* Giant Metric Row with Handwritten Caveat Numerals */}
              <div className="pl-card-metric-row">
                {(() => {
                  const { prefix, digits, suffix } = parseMetric(sl.value, sl.suffix, sl.prefix);
                  return (
                    <span className="pl-card-number">
                      {prefix && <span className="pl-card-prefix">{prefix}</span>}
                      <span className="pl-card-metric-val">{digits}</span>
                      {suffix && <span className="pl-card-suffix">{suffix}</span>}
                    </span>
                  );
                })()}
              </div>

              {/* Label and Narrative */}
              <div className="pl-card-text">
                <h4 className="pl-card-title" style={{ textTransform: "uppercase", fontFamily: '"Boogaloo", sans-serif' }}>{sl.label}</h4>
                <p className="pl-card-desc" style={{ textTransform: "none", fontFamily: '"Boogaloo", sans-serif', fontSize: "1.05rem" }}>{sl.description}</p>
              </div>

              {/* Bottom Micro-Component Rack */}
              <div className="pl-card-foot">
                {sl.snippetType === "chips" && sl.snippetItems && (
                  <div className="pl-chips-rack">
                    <div className="pl-chips-row">
                      {sl.snippetItems.map((chip) => (
                        <span key={chip} className="pl-chip">
                          {chip}
                        </span>
                      ))}
                    </div>
                    {sl.snippetSubtext && (
                      <span className="pl-micro-sub">{sl.snippetSubtext}</span>
                    )}
                  </div>
                )}

                {sl.snippetType === "lenses" && sl.snippetItems && (
                  <div className="pl-lenses-rack">
                    <div className="pl-lenses-row">
                      {sl.snippetItems.map((lens) => (
                        <span key={lens} className="pl-lens-tag">
                          {lens}
                        </span>
                      ))}
                    </div>
                    {sl.snippetSubtext && (
                      <span className="pl-micro-sub">{sl.snippetSubtext}</span>
                    )}
                  </div>
                )}

                {sl.snippetType === "citation" && (
                  <div className="pl-cite-box">
                    <span className="pl-cite-pill">
                      {sl.snippetText}
                    </span>
                    {sl.snippetSubtext && (
                      <span className="pl-micro-sub">{sl.snippetSubtext}</span>
                    )}
                  </div>
                )}

                {sl.snippetType === "security" && (
                  <div className="pl-sec-box">
                    <span className="pl-sec-pill">
                      {sl.snippetText}
                    </span>
                    {sl.snippetSubtext && (
                      <span className="pl-micro-sub">{sl.snippetSubtext}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Status Control Bar — Positioned cleanly below the hanging stage */}
      <div className="pl-bar">
        <div className="pl-cap" key={active}>
          <span className="pl-title" style={{ textTransform: "uppercase", fontFamily: '"Boogaloo", sans-serif' }}>{currentSlide.label}</span>
          <span className="pl-sub" style={{ textTransform: "none", fontFamily: '"Boogaloo", sans-serif', fontSize: "1.05rem" }}>{currentSlide.description}</span>
        </div>

        <div className="pl-count-group mf-mono">
          <span className="pl-count">
            <b>{pad2(active + 1)}</b> / {pad2(n)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default PolaroidLineCarousel;
