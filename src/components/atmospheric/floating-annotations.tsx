/**
 * Layer 2 — Floating Code Annotations
 *
 * Translucent "hand-drawn" code snippet cards that drift through
 * 3D space using Brownian motion physics.  Each element has an
 * independent velocity + damping, and a virtual Z-depth that
 * controls a CSS blur() filter for cinematic depth-of-field.
 */

import { useEffect, useRef, useState, useCallback } from "react";

/* ── Code fragments (realistic, multi-language) ── */
const CODE_SNIPPETS = [
  `const graph = buildDependencyTree(ast);`,
  `import { useEffect, useRef } from "react";`,
  `export async function analyze(repo: string) {`,
  `fn resolve_imports(path: &str) -> Vec<Node>`,
  `class SemanticParser extends BaseNode {`,
  `interface CodeBlock { hash: string; depth: number; }`,
  `SELECT embedding FROM vectors WHERE cosine_sim > 0.85`,
  `const pipeline = new TransformStream();`,
  `def traverse_ast(node, depth=0):`,
  `pub struct GraphEdge { source: usize, target: usize }`,
  `const clusters = await kMeans(embeddings, 8);`,
  `type ArchMap = Record<string, ModuleNode[]>;`,
];

/* ── Physics state for one floating card ── */
interface CardState {
  x: number;
  y: number;
  z: number;          // virtual depth (0 = closest, 1 = farthest)
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  snippet: string;
  opacity: number;
  scale: number;
}

function initCard(snippet: string, idx: number): CardState {
  const z = Math.random();
  return {
    x: Math.random() * 100,
    y: Math.random() * 100,
    z,
    vx: (Math.random() - 0.5) * 0.15,
    vy: (Math.random() - 0.5) * 0.1,
    rot: (Math.random() - 0.5) * 8,
    vrot: (Math.random() - 0.5) * 0.03,
    snippet,
    opacity: 0.04 + (1 - z) * 0.10,       // closer = more opaque
    scale: 0.55 + (1 - z) * 0.5,           // closer = larger
  };
}

export function FloatingAnnotations() {
  const [cards, setCards] = useState<CardState[]>(() =>
    CODE_SNIPPETS.map((s, i) => initCard(s, i))
  );
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const rafRef = useRef<number>(0);

  /* ── Brownian-motion loop ── */
  const tick = useCallback(() => {
    setCards((prev) =>
      prev.map((c) => {
        // Random impulse (Brownian)
        const ix = (Math.random() - 0.5) * 0.04;
        const iy = (Math.random() - 0.5) * 0.03;
        const irot = (Math.random() - 0.5) * 0.015;

        // Gentle restoration toward centre (prevents escape)
        const rx = (50 - c.x) * 0.0003;
        const ry = (50 - c.y) * 0.0003;

        let vx = (c.vx + ix + rx) * 0.992;   // damping
        let vy = (c.vy + iy + ry) * 0.992;
        let vrot = (c.vrot + irot) * 0.985;

        let x = c.x + vx;
        let y = c.y + vy;
        let rot = c.rot + vrot;

        // Soft wrap
        if (x < -15) x = 115;
        if (x > 115) x = -15;
        if (y < -10) y = 110;
        if (y > 110) y = -10;

        return { ...c, x, y, vx, vy, rot, vrot };
      })
    );
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {cards.map((c, i) => {
        // Depth-of-field blur: furthest cards get more blur
        const blur = c.z * 4 + 0.5;  // 0.5px – 4.5px
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${c.x}%`,
              top: `${c.y}%`,
              transform: `rotate(${c.rot}deg) scale(${c.scale})`,
              opacity: c.opacity,
              filter: `blur(${blur}px)`,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.65rem",
              letterSpacing: "0.04em",
              color: "rgba(0, 255, 255, 0.6)",
              whiteSpace: "nowrap",
              padding: "6px 12px",
              borderRadius: 4,
              border: "1px solid rgba(0, 255, 255, 0.06)",
              background: "rgba(0, 255, 255, 0.015)",
              backdropFilter: c.z < 0.3 ? "blur(1px)" : "none",
              willChange: "transform, left, top",
              transition: "opacity 0.3s",
            }}
          >
            {c.snippet}
          </div>
        );
      })}
    </div>
  );
}
