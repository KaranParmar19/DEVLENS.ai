/**
 * Layer 3 — Breathing UI Physics
 *
 * Wraps children in a two-layer container:
 *  • Outer div: mouse-tracked parallax (spring-lerp in rAF)
 *  • Inner div: organic sway CSS animation (handheld camera)
 *
 * The two transforms compose cleanly because they live on
 * separate DOM elements — no conflict between `animation`
 * and inline `transform`.
 */

import { useEffect, useRef, type ReactNode } from "react";

const SWAY_NAME = "dl-organic-sway";

const injectKeyframes = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === "undefined") return;
    injected = true;
    const style = document.createElement("style");
    style.textContent = `
      @keyframes ${SWAY_NAME} {
        0%   { transform: translate(0px, 0px)      rotate(0deg);     }
        15%  { transform: translate(1.4px, -0.6px)  rotate(0.15deg);  }
        30%  { transform: translate(-0.8px, 1.2px)  rotate(-0.10deg); }
        50%  { transform: translate(0.6px, 0.5px)   rotate(0.08deg);  }
        70%  { transform: translate(-1.2px, -0.8px)  rotate(-0.12deg); }
        85%  { transform: translate(0.4px, -0.3px)   rotate(0.05deg);  }
        100% { transform: translate(0px, 0px)        rotate(0deg);     }
      }
    `;
    document.head.appendChild(style);
  };
})();

interface BreathingUIProps {
  children: ReactNode;
  /** Parallax multiplier (default 0.02) */
  parallax?: number;
}

export function BreathingUI({ children, parallax = 0.02 }: BreathingUIProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const lerped = useRef({ x: 0, y: 0 });
  const raf = useRef<number>(0);

  useEffect(() => {
    injectKeyframes();

    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    const loop = () => {
      // Low-frequency spring lerp — feels heavy / cinematic
      const k = 0.035;
      lerped.current.x += (mouse.current.x - lerped.current.x) * k;
      lerped.current.y += (mouse.current.y - lerped.current.y) * k;

      if (outerRef.current) {
        const px = lerped.current.x * parallax * 100;
        const py = lerped.current.y * parallax * 100;
        outerRef.current.style.transform =
          `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0)`;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf.current);
    };
  }, [parallax]);

  return (
    /* Outer: parallax (inline transform via rAF) */
    <div ref={outerRef} style={{ willChange: "transform" }}>
      {/* Inner: organic sway (CSS animation) */}
      <div
        style={{
          animation: `${SWAY_NAME} 14s cubic-bezier(0.45, 0, 0.55, 1) infinite`,
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
