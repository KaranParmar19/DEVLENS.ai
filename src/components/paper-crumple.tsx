/**
 * PaperCrumple — captures the actual landing page with html2canvas,
 * slices it into a tile grid, then animates each tile folding/rotating
 * into crumpling paper balls that shrink to reveal pure black.
 */
import { useEffect, useRef, useCallback } from "react";
import html2canvas from "html2canvas";

interface Tile {
  // Source rect in the snapshot
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  // Screen position
  x: number;
  y: number;
  w: number;
  h: number;
  // Physics
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  totalRotX: number;
  totalRotY: number;
  totalRotZ: number;
  scale: number;
  opacity: number;
  delay: number; // ms before this tile starts moving
  crinkle: number; // 0-1 how crumpled it looks
}

interface Props {
  active: boolean;
  captureTarget: HTMLElement | null;
  onComplete: () => void;
}

const COLS = 14;
const ROWS = 9;
// Animation phases (ms)
const LIFT_START   = 0;
const LIFT_END     = 50;
const CRUMPLE_END  = 1200;
const SHRINK_END   = 1600;
const TOTAL        = 1650;

export function PaperCrumple({ active, captureTarget, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const startRef  = useRef<number>(0);
  const doneRef   = useRef(false);
  const snapshotRef = useRef<HTMLCanvasElement | null>(null);
  const tilesRef    = useRef<Tile[]>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // ─── Build tiles once we have the snapshot ───────────────────────────────
  const buildTiles = useCallback((snap: HTMLCanvasElement, W: number, H: number) => {
    const tiles: Tile[] = [];
    const tW = W / COLS;
    const tH = H / ROWS;

    // Single crumple center in the middle of the screen
    const centers = [
      { x: W * 0.5, y: H * 0.5 },
    ];

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = col * tW;
        const y = row * tH;

        // Assign to nearest crumple center
        let best = 0, bestDist = Infinity;
        const cx = x + tW / 2, cy = y + tH / 2;
        centers.forEach((c, i) => {
          const d = Math.hypot(c.x - cx, c.y - cy);
          if (d < bestDist) { bestDist = d; best = i; }
        });

        const center = centers[best];
        // Stagger based on distance to center (closer goes later — sucked in)
        const normDist = Math.min(1, bestDist / (Math.max(W, H) * 0.5));
        const delay = Math.random() * 50; // Almost immediate start for all tiles

        tiles.push({
          sx: col * (snap.width  / COLS),
          sy: row * (snap.height / ROWS),
          sw: snap.width  / COLS,
          sh: snap.height / ROWS,
          x, y, w: tW, h: tH,
          vx: 0, vy: 0,
          targetX: center.x - tW / 2 + (Math.random() - 0.5) * 80,
          targetY: center.y - tH / 2 + (Math.random() - 0.5) * 80,
          rotX: 0, rotY: 0, rotZ: 0,
          totalRotX: (Math.random() - 0.5) * 720,
          totalRotY: (Math.random() - 0.5) * 720,
          totalRotZ: (Math.random() - 0.5) * 360,
          scale: 1,
          opacity: 1,
          delay,
          crinkle: 0,
        });
      }
    }
    tilesRef.current = tiles;
  }, []);

  // ─── Canvas draw loop ─────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const snap   = snapshotRef.current;
    if (!canvas || !snap) return;

    const ctx = canvas.getContext("2d")!;
    const W   = canvas.width;
    const H   = canvas.height;
    const now     = performance.now();
    const elapsed = now - startRef.current;

    // Black background (always solid — the crumple reveals it)
    ctx.fillStyle = "#080809";
    ctx.fillRect(0, 0, W, H);

    const tiles = tilesRef.current;

    for (const t of tiles) {
      const tElapsed = elapsed - t.delay;
      if (tElapsed <= 0) {
        // Not started yet — draw at original position, fully visible
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.drawImage(snap, t.sx, t.sy, t.sw, t.sh, t.x, t.y, t.w, t.h);
        ctx.restore();
        continue;
      }

      // ── Phase 1: Lift off (0 → LIFT_END ms after delay) ──────────────────
      const liftProgress = Math.min(1, tElapsed / (LIFT_END - LIFT_START));

      // ── Phase 2: Crumple toward center ────────────────────────────────────
      const crumpleElapsed = Math.max(0, tElapsed - LIFT_END);
      const crumpleProgress = Math.min(1, crumpleElapsed / (CRUMPLE_END - LIFT_END));
      // Buttery smooth easeInOutQuart
      const easedCrumple = crumpleProgress < 0.5 
        ? 8 * Math.pow(crumpleProgress, 4) 
        : 1 - Math.pow(-2 * crumpleProgress + 2, 4) / 2;

      // ── Phase 3: Shrink to nothing ────────────────────────────────────────
      const shrinkElapsed = Math.max(0, tElapsed - CRUMPLE_END);
      const shrinkProgress = Math.min(1, shrinkElapsed / (SHRINK_END - CRUMPLE_END));
      // Smooth easeInCubic for shrinking
      const easedShrink = Math.pow(shrinkProgress, 3);

      // Interpolated position
      const px = t.x + (t.targetX - t.x) * easedCrumple;
      const py = t.y + (t.targetY - t.y) * easedCrumple;

      // Scale: normal → crumple point → gone
      const baseScale = 1 - easedShrink;
      const crumpleScale = 1 - easedCrumple * 0.4; // compress softly while flying
      const finalScale = crumpleScale * baseScale;

      // Frame-rate independent rotation bound to the easing curve
      const rotZ = t.totalRotZ * easedCrumple;
      const rotX = t.totalRotX * easedCrumple;
      const rotY = t.totalRotY * easedCrumple;

      // Keep colors solid and vibrant, only fade at the absolute very end of the shrink phase
      const opacity = easedShrink > 0.8 ? 1 - ((easedShrink - 0.8) * 5) : 1;

      if (opacity <= 0.01 || finalScale <= 0.01) continue;

      ctx.save();

      // Centre transform pivot
      const cx = px + t.w / 2;
      const cy = py + t.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(rotZ * Math.PI / 180);
      ctx.scale(
        finalScale * Math.abs(Math.cos(rotY * Math.PI / 180)),
        finalScale * Math.abs(Math.cos(rotX * Math.PI / 180))
      );
      ctx.globalAlpha = opacity;

      // Draw the page tile
      ctx.drawImage(snap, t.sx, t.sy, t.sw, t.sh, -t.w / 2, -t.h / 2, t.w, t.h);

      // Crinkle overlay — subtle specular and shadow to preserve dark theme colors
      const crinkleAmount = Math.min(1, crumpleProgress * 2.5);
      if (crinkleAmount > 0.05) {
        ctx.save();
        ctx.globalAlpha = opacity * crinkleAmount * 0.3; // Much lighter alpha
        
        // Subtle highlight/shadow fold to give 3D depth without washing out colors
        const grad = ctx.createLinearGradient(-t.w / 2, -t.h / 2, t.w / 2, t.h / 2);
        grad.addColorStop(0, "rgba(255,255,255,0.0)");
        grad.addColorStop(0.3, "rgba(255,255,255,0.08)"); // Hint of specular highlight
        grad.addColorStop(0.4 + Math.sin(rotZ * 0.1) * 0.1, "rgba(0,0,0,0.4)"); // Faint shadow
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(-t.w / 2, -t.h / 2, t.w, t.h);

        // Very faint crease lines
        ctx.strokeStyle = `rgba(255,255,255,${0.05 * crinkleAmount})`;
        ctx.lineWidth = 0.5;
        const numCreases = Math.floor(crinkleAmount * 3) + 1;
        for (let i = 0; i < numCreases; i++) {
          const ly = -t.h / 2 + (i / numCreases) * t.h + Math.sin(rotZ + i) * 3;
          ctx.beginPath();
          ctx.moveTo(-t.w / 2, ly);
          ctx.lineTo(t.w / 2, ly);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();
    }

    // ── Check completion ──────────────────────────────────────────────────
    if (elapsed >= TOTAL && !doneRef.current) {
      doneRef.current = true;
      ctx.fillStyle = "#080809";
      ctx.fillRect(0, 0, W, H);
      onCompleteRef.current();
      return;
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  // ─── Activation: capture, build tiles, start loop ────────────────────────
  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    doneRef.current = false;

    const target = captureTarget || document.body;

    html2canvas(target, {
      backgroundColor: null,
      useCORS: true,
      scale: 1, // Force scale to 1 for much faster screenshot processing
      width:  window.innerWidth,
      height: window.innerHeight,
      x: window.scrollX,
      y: window.scrollY,
      logging: false,
    }).then((snap) => {
      snapshotRef.current = snap;
      buildTiles(snap, canvas.width, canvas.height);
      startRef.current = performance.now();
      rafRef.current = requestAnimationFrame(draw);
    }).catch(() => {
      // Fallback: skip to navigation if capture fails
      onCompleteRef.current();
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, captureTarget, buildTiles, draw]);

  // Always mounted but invisible when inactive
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        width:  "100vw",
        height: "100vh",
        display: active ? "block" : "none",
        pointerEvents: active ? "all" : "none",
      }}
    />
  );
}
