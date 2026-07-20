/**
 * Layer 4 — Film Grain Overlay
 *
 * Renders an animated, low-opacity noise texture over the entire
 * viewport to break the flat digital look.  Uses a canvas element
 * that re-renders at ~12 fps for a flickering, cinematic grain.
 *
 * Opacity is kept at 2–3 % as specified.
 */

import { useEffect, useRef } from "react";

const GRAIN_FPS = 12;
const GRAIN_OPACITY = 0.025; // 2.5 %

export function FilmGrain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Use a smaller canvas and CSS-scale it up (pixelated) for performance
    const W = 256;
    const H = 256;
    canvas.width = W;
    canvas.height = H;

    const imageData = ctx.createImageData(W, H);
    const buf = imageData.data;
    let lastFrame = 0;
    const interval = 1000 / GRAIN_FPS;

    const render = (now: number) => {
      rafRef.current = requestAnimationFrame(render);
      if (now - lastFrame < interval) return;
      lastFrame = now;

      // Write random luminance into every pixel
      for (let i = 0; i < buf.length; i += 4) {
        const v = Math.random() * 255;
        buf[i]     = v;   // R
        buf[i + 1] = v;   // G
        buf[i + 2] = v;   // B
        buf[i + 3] = 255; // A — we control final opacity via CSS
      }
      ctx.putImageData(imageData, 0, 0);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 5,
        pointerEvents: "none",
        opacity: GRAIN_OPACITY,
        mixBlendMode: "overlay",
        imageRendering: "pixelated",
      }}
    />
  );
}
