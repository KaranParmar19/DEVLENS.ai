import React, { useEffect, useId, useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export interface MorphTextProps {
  words?: string[];
  trigger?: "loop" | "once";
  morphTime?: number;
  holdTime?: number;
  startDelay?: number;
  strength?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function MorphText({
  words = ["shape", "flows", "graph", "logic", "depth"],
  trigger = "loop",
  morphTime = 1.1,
  holdTime = 1.8,
  startDelay = 0.4,
  strength = 8,
  className = "",
  style,
}: MorphTextProps) {
  const n = words.length;
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLSpanElement>(null);
  const aRef = useRef<HTMLSpanElement>(null);
  const bRef = useRef<HTMLSpanElement>(null);
  const layerRef = useRef<HTMLSpanElement>(null);
  const rawId = useId();
  const filterId = "morph-" + rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  const paint = (i: number, f: number, wrap: boolean) => {
    const a = aRef.current;
    const b = bRef.current;
    const layer = layerRef.current;
    if (!a || !b || !layer) return;

    const from = words[(i % n + n) % n];
    const toIndex = wrap ? (i + 1) % n : Math.min(i + 1, n - 1);
    const to = words[toIndex];

    if (a.textContent !== from) a.textContent = from;
    if (b.textContent !== to) b.textContent = to;

    f = clamp(f);

    if (reduced) {
      layer.style.filter = "none";
      a.style.filter = b.style.filter = "none";
      a.style.opacity = String(1 - f);
      b.style.opacity = String(f);
      return;
    }

    const s = strength;
    const morphing = f > 0.001 && f < 0.999;

    // Threshold matrix filter is engaged only while actively morphing,
    // ensuring resting text stays razor sharp in its serif font!
    layer.style.filter = morphing ? `url(#${filterId})` : "none";

    const blurIn = f <= 0 ? 100 : Math.min(s / f - s, 100);
    const blurOut = f >= 1 ? 100 : Math.min(s / (1 - f) - s, 100);

    b.style.filter = `blur(${blurIn}px)`;
    b.style.opacity = String(Math.pow(f, 0.4));
    a.style.filter = `blur(${blurOut}px)`;
    a.style.opacity = String(Math.pow(1 - f, 0.4));
  };

  const visible = useInView(rootRef, { margin: "100px 0px 100px 0px" });

  useEffect(() => {
    if (!visible) return;

    const hold = Math.max(0, holdTime) * 1000;
    const morph = Math.max(0.05, morphTime) * 1000;
    const delay = Math.max(0, startDelay) * 1000;
    const cycle = hold + morph;
    const wrap = trigger === "loop";

    let raf = 0;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const t = now - start - delay;

      if (t < 0) {
        paint(0, 0, wrap);
      } else {
        const i = Math.floor(t / cycle);
        const local = t - i * cycle;
        if (!wrap && i >= n - 1) {
          paint(n - 1, 0, false);
          return;
        }
        const f = local < hold ? 0 : (local - hold) / morph;
        paint(wrap ? i % n : i, f, wrap);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, morphTime, holdTime, startDelay, strength, reduced, trigger, n]);

  const cell: React.CSSProperties = {
    gridArea: "1 / 1",
    justifySelf: "start",
    whiteSpace: "nowrap",
    userSelect: "none",
    willChange: "filter, opacity",
  };

  return (
    <span
      ref={rootRef}
      role="text"
      aria-label={words.join(", ")}
      className={`morph-text-inline ${className}`}
      style={{
        ...style,
        position: "relative",
        display: "inline-grid",
        alignItems: "center",
        verticalAlign: "baseline",
        lineHeight: "inherit",
      }}
    >
      {/* Invisible spacer words to preserve natural layout dimensions */}
      {words.map((w, k) => (
        <span
          key={k}
          aria-hidden="true"
          style={{
            ...cell,
            visibility: "hidden",
            pointerEvents: "none",
            willChange: "auto",
          }}
        >
          {w}
        </span>
      ))}

      {/* Morphing visual layer */}
      <span
        ref={layerRef}
        aria-hidden="true"
        style={{
          gridArea: "1 / 1",
          display: "grid",
          justifySelf: "stretch",
          alignSelf: "stretch",
          alignItems: "center",
        }}
      >
        <span ref={aRef} style={cell}>
          {words[0]}
        </span>
        <span ref={bRef} style={{ ...cell, opacity: 0 }}>
          {words[1 % n]}
        </span>
      </span>

      {/* SVG feColorMatrix threshold filter */}
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
      >
        <defs>
          <filter id={filterId}>
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>
    </span>
  );
}
