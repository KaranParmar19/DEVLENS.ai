import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

// Isomorphic layout effect for SSR safety
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const PUSH = 12000; // px/s² at pointer centre
const SIDE = 0.25; // share of push applied sideways
const RIPPLE_SPEED = 1400; // px/s
const RIPPLE_KICK = 900; // px/s

export interface FooterFieldProps {
  wordmark?: string;
  radius?: number;
  strength?: number;
  stiffness?: number;
  damping?: number;
  touchRipple?: boolean;
}

export function FooterField({
  wordmark = "devlens",
  radius = 150,
  strength = 1,
  stiffness = 170,
  damping = 16,
  touchRipple = true,
}: FooterFieldProps) {
  const letters = Array.from(wordmark);
  const rootRef = useRef<HTMLElement>(null);
  const wmRef = useRef<HTMLDivElement>(null);
  const letterEls = useRef<(HTMLSpanElement | null)[]>([]);
  const physics = useRef({ radius, strength, stiffness, damping, touchRipple });

  useEffect(() => {
    physics.current = { radius, strength, stiffness, damping, touchRipple };
  }, [radius, strength, stiffness, damping, touchRipple]);

  const [reduce, setReduce] = useState<boolean | null>(null);

  useIsoLayoutEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setReduce(true);
      return;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const sync = () => setReduce(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const active = reduce === false && letters.length > 0;

  useIsoLayoutEffect(() => {
    if (!active) {
      for (const el of letterEls.current) {
        if (el) {
          el.style.transform = "";
          el.style.willChange = "";
        }
      }
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    const n = letters.length;
    const els = letterEls.current.slice(0, n);
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    const vx = new Float64Array(n);
    const vy = new Float64Array(n);
    const cx = new Float64Array(n);
    const cy = new Float64Array(n);
    const kickT = new Float64Array(n).fill(-1);
    const kickX = new Float64Array(n);
    const kickY = new Float64Array(n);

    let rootLeft = 0;
    let rootTop = 0;
    let rectStale = true;
    let px = 0;
    let py = 0;
    let inside = false;
    let raf = 0;
    let prev = 0;
    let running = false;

    const readRect = () => {
      const r = root.getBoundingClientRect();
      rootLeft = r.left;
      rootTop = r.top;
      rectStale = false;
    };

    const measure = () => {
      for (let i = 0; i < n; i++) {
        const el = els[i];
        if (!el) continue;
        let left = 0;
        let top = 0;
        let node: HTMLElement | null = el;
        while (node && node !== root) {
          left += node.offsetLeft;
          top += node.offsetTop;
          const parent: Element | null = node.offsetParent;
          node = parent instanceof HTMLElement && root.contains(parent) ? parent : null;
        }
        cx[i] = left + el.offsetWidth / 2;
        cy[i] = top + el.offsetHeight / 2;
      }
      rectStale = true;
    };

    measure();

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(root);
    if (wmRef.current) ro.observe(wmRef.current);

    const write = (i: number, clear: boolean) => {
      const el = els[i];
      if (!el) return;
      if (clear) {
        el.style.transform = "";
        el.style.willChange = "";
        return;
      }
      el.style.transform = `translate3d(${x[i].toFixed(2)}px, ${y[i].toFixed(2)}px, 0)`;
    };

    const stop = (snap: boolean) => {
      running = false;
      raf = 0;
      for (let i = 0; i < n; i++) {
        if (snap) {
          x[i] = 0;
          y[i] = 0;
          vx[i] = 0;
          vy[i] = 0;
          write(i, true);
        } else {
          const el = els[i];
          if (el) el.style.willChange = "";
        }
      }
    };

    const tick = (now: number) => {
      const dt = prev ? Math.min((now - prev) / 1000, 1 / 30) : 1 / 60;
      prev = now;

      const { radius: rParam, strength: sParam, stiffness: k, damping: c } = physics.current;
      const r = Math.max(1, rParam);

      let maxX = 0;
      let maxV = 0;
      let maxA = 0;
      let pending = false;

      for (let i = 0; i < n; i++) {
        if (kickT[i] >= 0) {
          kickT[i] -= dt;
          pending = true;
          if (kickT[i] < 0) {
            vx[i] += kickX[i];
            vy[i] += kickY[i];
          }
        }

        let fx = 0;
        let fy = 0;

        if (inside && sParam > 0) {
          const dx = cx[i] + x[i] - px;
          const dy = cy[i] + y[i] - py;
          const d = Math.hypot(dx, dy);

          if (d < r) {
            const f = PUSH * sParam * (1 - d / r);
            fx = d > 0.001 ? (dx / d) * f * SIDE : 0;
            fy = (dy > 0 ? 1 : -1) * f;
          }
        }

        const ax = -k * x[i] - c * vx[i] + fx;
        const ay = -k * y[i] - c * vy[i] + fy;

        vx[i] += ax * dt;
        vy[i] += ay * dt;
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;

        maxX = Math.max(maxX, Math.abs(x[i]), Math.abs(y[i]));
        maxV = Math.max(maxV, Math.abs(vx[i]), Math.abs(vy[i]));
        maxA = Math.max(maxA, Math.abs(ax), Math.abs(ay));

        write(i, false);
      }

      if (!pending) {
        if (!inside && maxX < 0.05 && maxV < 0.05) return stop(true);
        if (inside && maxV < 0.05 && maxA < 1) return stop(false);
      }

      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      prev = 0;
      for (const el of els) {
        if (el) el.style.willChange = "transform";
      }
      raf = requestAnimationFrame(tick);
    };

    const onEnter = (e: PointerEvent) => {
      readRect();
      if (e.pointerType === "touch") return;
      px = e.clientX - rootLeft;
      py = e.clientY - rootTop;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (rectStale) readRect();
      px = e.clientX - rootLeft;
      py = e.clientY - rootTop;
      inside = true;
      start();
    };

    const onLeave = () => {
      if (!inside) return;
      inside = false;
      start();
    };

    const onWheel = () => {
      rectStale = true;
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !physics.current.touchRipple) return;
      readRect();
      const tx = e.clientX - rootLeft;
      const ty = e.clientY - rootTop;
      const reach = Math.max(1, physics.current.radius) * 4;
      const s = physics.current.strength;

      for (let i = 0; i < n; i++) {
        const dx = cx[i] - tx;
        const dy = cy[i] - ty;
        const d = Math.hypot(dx, dy);
        const fall = Math.max(0, 1 - d / reach);
        if (fall <= 0 || s <= 0) continue;
        const ux = d > 0.001 ? dx / d : 0;
        const uy = d > 0.001 ? dy / d : -1;
        kickT[i] = d / RIPPLE_SPEED;
        kickX[i] = ux * RIPPLE_KICK * s * fall * SIDE;
        kickY[i] = (uy > 0 ? 1 : -1) * RIPPLE_KICK * s * fall;
      }
      start();
    };

    root.addEventListener("pointerenter", onEnter, { passive: true });
    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave, { passive: true });
    root.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("scroll", onWheel, { passive: true });

    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onWheel);
    };
  }, [active, letters.length]);

  const scrollToTop = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      const lenis = (window as any).lenisInstance;
      if (lenis && typeof lenis.scrollTo === "function") {
        lenis.scrollTo(0, { immediate: false });
      }
    } catch (err) {
      console.warn("Lenis scrollTo error:", err);
    }

    if (typeof window !== "undefined") {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      } catch {
        window.scrollTo(0, 0);
      }
      if (document.documentElement) {
        try {
          document.documentElement.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        } catch {
          document.documentElement.scrollTop = 0;
        }
      }
      if (document.body) {
        try {
          document.body.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        } catch {
          document.body.scrollTop = 0;
        }
      }
    }
  };

  return (
    <footer
      ref={rootRef}
      className="mf-dark fffp-root"
      data-theme="dark"
      style={{
        paddingTop: "clamp(64px, 8vw, 112px)",
        paddingBottom: "clamp(24px, 4vw, 48px)",
        background: "var(--mf-dark, #0a0a0a)",
        color: "#ffffff",
        overflow: "hidden",
      }}
    >
      <div className="mf-wrap">
        {/* Top: Call to Action & Navigation Columns */}
        <div className="fffp-cols">
          {/* Main CTA */}
          <div className="fffp-col fffp-col-lead">
            <h3 className="mf-h2" style={{ maxWidth: "11em", lineHeight: 1.05 }}>
              Read any codebase like you wrote it.
            </h3>
            <div style={{ marginTop: 28 }}>
              <Link to="/dashboard" className="mf-btn inv">
                Start mapping <span className="mf-arrow">↗</span>
              </Link>
            </div>
          </div>

          {/* Product Links */}
          <div className="fffp-col">
            <div className="fffp-h">Product</div>
            <ul className="fffp-list">
              <li>
                <Link to="/features">Features</Link>
              </li>
              <li>
                <Link to="/how-it-works">How it works</Link>
              </li>
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
            </ul>
          </div>

          {/* Views Links */}
          <div className="fffp-col">
            <div className="fffp-h">Views</div>
            <ul className="fffp-list">
              <li>
                <Link to="/dashboard">Architecture map</Link>
              </li>
              <li>
                <Link to="/dashboard">Code flow</Link>
              </li>
              <li>
                <Link to="/dashboard">Onboarding doc</Link>
              </li>
              <li>
                <Link to="/dashboard">Ask DevLens</Link>
              </li>
            </ul>
          </div>

          {/* Elsewhere Links */}
          <div className="fffp-col">
            <div className="fffp-h">Elsewhere</div>
            <ul className="fffp-list">
              <li>
                <a
                  href="https://github.com/KaranParmar19/devlens-AI"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="fffp-rule" aria-hidden="true" />

        {/* Live Magnetic Kinetic Typography Wordmark */}
        <div className="fffp-wm" ref={wmRef} aria-label="DevLens interactive footer wordmark">
          <span className="fffp-sr">devlens</span>
          <div className="fffp-wm-line" aria-hidden="true">
            {letters.map((ch, i) => (
              <span
                key={i}
                className="fffp-l"
                ref={(el) => {
                  letterEls.current[i] = el;
                }}
              >
                {ch}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Bar: Copyright, Tagline & Back-to-Top */}
        <div className="fffp-bottom">
          <div className="fffp-copy-wrap">
            <span className="fffp-copy">© {new Date().getFullYear()} DevLens AI</span>
            <span className="fffp-dot-sep">·</span>
            <span className="fffp-copy">Built for engineers who inherit code</span>
          </div>

          <button
            type="button"
            className="fffp-top"
            onClick={scrollToTop}
            aria-label="Scroll to top of page"
          >
            <span>Back to top</span>
            <span aria-hidden="true">↑</span>
          </button>
        </div>
      </div>
    </footer>
  );
}

export default FooterField;
