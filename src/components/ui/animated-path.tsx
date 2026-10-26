import React, { useRef, useState, useEffect, useLayoutEffect, useId } from "react";

export interface AnimatedPathPoint {
  x: number;
  y: number;
}

export interface AnimatedPathProps {
  path?: string;
  points?: AnimatedPathPoint[];
  viewWidth?: number;
  viewHeight?: number;
  lineColor?: string;
  dotColor?: string;
  strokeWidth?: number;
  dashLength?: number;
  gapLength?: number;
  dotSize?: number;
  speed?: number;
  trailLength?: number;
  startDelay?: number;
  startOnView?: boolean;
  showBase?: boolean;
  baseOpacity?: number;
  preserveAspectRatio?: string;
  className?: string;
  style?: React.CSSProperties;
}

/*
 * Default 5-cell harmonic wave traversing:
 * 01 Architecture map → 02 Code flow tracer → 03 Drift timeline → 04 Ask DevLens → 05 Onboarding doc
 */
const DEFAULT_5_CELL_PATH = `
  M 30 46
  L 100 46
  C 180 46, 220 66, 300 66
  C 380 66, 420 46, 500 46
  C 580 46, 620 66, 700 66
  C 780 66, 820 46, 900 46
  L 970 46
`;

const DEFAULT_5_CELL_POINTS: AnimatedPathPoint[] = [
  { x: 100, y: 46 },
  { x: 300, y: 66 },
  { x: 500, y: 46 },
  { x: 700, y: 66 },
  { x: 900, y: 46 },
];

export function AnimatedPath({
  path = DEFAULT_5_CELL_PATH,
  points = DEFAULT_5_CELL_POINTS,
  viewWidth = 1000,
  viewHeight = 120,
  lineColor = "var(--mf-ink, #111111)",
  dotColor = "var(--mf-ink, #111111)",
  strokeWidth = 1.25,
  dashLength = 7,
  gapLength = 7,
  dotSize = 9,
  speed = 130,
  trailLength = 0.28,
  startDelay = 0,
  startOnView = true,
  showBase = true,
  baseOpacity = 0.18,
  preserveAspectRatio = "none",
  className,
  style,
}: AnimatedPathProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measurementPathRef = useRef<SVGPathElement>(null);
  const [started, setStarted] = useState(!startOnView);
  const [pathLength, setPathLength] = useState(800);

  const rawId = useId();
  const uniqueId = rawId.replace(/:/g, "");
  const animationName = `smooth-process-flow-${uniqueId}`;
  const animationClass = `smooth-process-path-${uniqueId}`;

  // Measure the real curve so the speed stays consistent across viewboxes
  useLayoutEffect(() => {
    const el = measurementPathRef.current;
    if (!el) return;
    try {
      const measured = el.getTotalLength();
      if (measured > 0) {
        setPathLength(measured);
      }
    } catch {
      // Fallback
    }
  }, [path]);

  // Viewport intersection trigger
  useEffect(() => {
    if (!startOnView) {
      setStarted(true);
      return;
    }
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setStarted(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [startOnView]);

  // Higher speed value = faster movement
  const animationDuration = Math.max(pathLength / Math.max(speed, 1), 0.4);

  // Normalize trail length between 0.01 and 0.9999 for SVG stroke-dasharray
  const normalizedTrail = Math.max(0.01, Math.min(trailLength, 0.9999));
  const normalizedGap = 1 - normalizedTrail;

  const animationStyles = `
    @keyframes ${animationName} {
      from {
        stroke-dashoffset: 0;
      }
      to {
        stroke-dashoffset: -1;
      }
    }

    .${animationClass} {
      animation-name: ${animationName};
      animation-duration: ${animationDuration}s;
      animation-delay: ${Math.max(startDelay, 0)}s;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
      animation-fill-mode: both;
      will-change: stroke-dashoffset;
    }

    @media (prefers-reduced-motion: reduce) {
      .${animationClass} {
        animation: none !important;
        stroke-dashoffset: 0 !important;
      }
    }
  `;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 1,
        ...style,
      }}
    >
      <style>{animationStyles}</style>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio={preserveAspectRatio}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          overflow: "visible",
        }}
      >
        {/* Invisible measurement path to compute exact totalLength */}
        <path
          ref={measurementPathRef}
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={1}
          pointerEvents="none"
        />

        <defs>
          {/* Moving trail mask that smoothly loops from start to finish */}
          <mask
            id={`moving-trail-mask-${uniqueId}`}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            x={-100}
            y={-100}
            width={viewWidth + 200}
            height={viewHeight + 200}
          >
            <path
              d={path}
              pathLength={1}
              fill="none"
              stroke="white"
              strokeWidth={Math.max(strokeWidth + 14, 18)}
              strokeLinecap="round"
              strokeDasharray={`${normalizedTrail} ${normalizedGap}`}
              strokeDashoffset={0}
              className={started ? animationClass : undefined}
            />
          </mask>
        </defs>

        {/* 1. Static/Subtle base dashed path */}
        {showBase && (
          <path
            d={path}
            fill="none"
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${gapLength}`}
            strokeLinecap="round"
            opacity={baseOpacity}
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* 2. Active illuminated pulse masked by the moving trail */}
        <path
          d={path}
          fill="none"
          stroke={lineColor}
          strokeWidth={strokeWidth * 1.3}
          strokeDasharray={`${dashLength} ${gapLength}`}
          strokeLinecap="round"
          opacity={0.95}
          vectorEffect="non-scaling-stroke"
          mask={`url(#moving-trail-mask-${uniqueId})`}
        />

        {/* 3. Station dots at each cell waypoint */}
        {points.map((pt, i) => (
          <g key={`point-${i}`}>
            {/* Outer halo */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={dotSize / 2 + 3}
              fill={dotColor}
              opacity={0.12}
            />
            {/* Core dot */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={dotSize / 2}
              fill={dotColor}
              opacity={0.85}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

export default AnimatedPath;
