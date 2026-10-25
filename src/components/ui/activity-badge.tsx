import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, type Transition } from "motion/react";

const PRESET_COLORS = {
  green: "#31EE33",
  orange: "#FFBB00",
  red: "#FF0000",
} as const;

export interface ActivityBadgeProps {
  type?: "activity" | "custom";
  preset?: "green" | "orange" | "red";
  customColor?: string;
  animation?: "circle" | "shake" | "glow";
  transition?: Transition;
  minOpacity?: number;
  scaleAmount?: number;
  rings?: number;
  blurAmount?: number;
  radius?: string;
  glow?: boolean;
  glowSize?: number;
  glowOpacity?: number;
  label?: string;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ActivityBadge
 * Framer native component port (NextSmoothScroll / Framer parity)
 * URL: https://framer.com/m/ActivityBadge-6erXNt.js@ha4lfrMiuiij5FEkEqjn
 */
export function ActivityBadge({
  type = "activity",
  preset = "green",
  customColor = "#1B82CC",
  animation = "circle",
  transition: transitionProp = { duration: 0.9, ease: "easeOut", delay: 0.4 },
  minOpacity = 0.75,
  scaleAmount = 1.3,
  rings = 1,
  blurAmount = 3,
  radius = "999px",
  glow = true,
  glowSize = 10,
  glowOpacity = 0.28,
  label = "Activity status",
  size,
  className,
  style,
}: ActivityBadgeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const inView = useInView(ref, { amount: 0.1 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const color = useMemo(() => {
    if (type === "custom") return customColor;
    return PRESET_COLORS[preset] || PRESET_COLORS.green;
  }, [type, preset, customColor]);

  const shouldAnimate = mounted && inView;

  const containerStyle = useMemo<React.CSSProperties>(() => {
    const s = size !== undefined ? { width: size, height: size } : {};
    return {
      position: "relative",
      width: style?.width ?? s.width ?? 10,
      height: style?.height ?? s.height ?? 10,
      display: "inline-block",
      lineHeight: 0,
      fontSize: 0,
      flexShrink: 0,
      verticalAlign: "middle",
      overflow: "visible",
      ...style,
    };
  }, [style, size]);

  const dotStyle = useMemo<React.CSSProperties>(
    () => ({
      position: "absolute",
      inset: 0,
      borderRadius: radius,
      background: color,
      transformOrigin: "50% 50%",
      boxShadow: glow
        ? `0 0 ${glowSize}px ${color}${Math.round(Math.min(1, Math.max(0, glowOpacity)) * 255)
            .toString(16)
            .padStart(2, "0")}`
        : "none",
    }),
    [color, radius, glow, glowSize, glowOpacity]
  );

  const glowStyle = useMemo<React.CSSProperties>(
    () => ({
      position: "absolute",
      inset: 0,
      borderRadius: radius,
      background: color,
      filter: "none",
      opacity: 0,
      transformOrigin: "50% 50%",
      pointerEvents: "none",
    }),
    [color, radius]
  );

  const blurStyle = useMemo<React.CSSProperties>(
    () => ({
      position: "absolute",
      inset: 0,
      borderRadius: radius,
      background: color,
      filter: `blur(${Math.max(0, blurAmount)}px)`,
      opacity: 0,
      transformOrigin: "50% 50%",
      pointerEvents: "none",
    }),
    [color, radius, blurAmount]
  );

  const loopBaseTransition: Transition | undefined = useMemo(() => {
    if (!shouldAnimate) return undefined;
    const base = transitionProp && typeof transitionProp === "object" ? transitionProp : {};
    const repeatDelay = Math.max(0, Number(base.delay) || 0);
    const { delay: _d, ...rest } = base;
    return { ...rest, repeat: Infinity, repeatDelay } as Transition;
  }, [shouldAnimate, transitionProp]);

  const circleTransition: Transition | undefined = useMemo(() => {
    if (!loopBaseTransition) return undefined;
    return { ...loopBaseTransition, times: [0, 0.02, 0.8, 1] } as Transition;
  }, [loopBaseTransition]);

  const animateDot = useMemo(() => {
    if (!shouldAnimate) return undefined;
    if (animation === "shake") {
      return { x: [0, -1.5, 1.5, -1.5, 1.5, 0] };
    }
    return undefined;
  }, [shouldAnimate, animation]);

  const dotTransition: Transition | undefined = useMemo(() => {
    if (!loopBaseTransition) return undefined;
    if (animation === "shake") {
      return { ...loopBaseTransition, times: [0, 0.18, 0.36, 0.54, 0.72, 1] } as Transition;
    }
    return loopBaseTransition;
  }, [loopBaseTransition, animation]);

  const animateGlow = useMemo(() => {
    if (!shouldAnimate || animation !== "circle") return undefined;
    const start = Math.max(0, Math.min(1, minOpacity));
    const endScale = Math.max(1, scaleAmount);
    return { opacity: [0, start, 0, 0], scale: [1, 1, endScale, 1] };
  }, [shouldAnimate, animation, minOpacity, scaleAmount]);

  const animateBlurGlow = useMemo(() => {
    if (!shouldAnimate || animation !== "glow") return undefined;
    const start = Math.max(0, Math.min(1, minOpacity));
    const endScale = Math.max(1, scaleAmount);
    return { opacity: [0, start, 0], scale: [0, endScale, 0] };
  }, [shouldAnimate, animation, minOpacity, scaleAmount]);

  const blurTransition: Transition | undefined = useMemo(() => {
    if (!loopBaseTransition || animation !== "glow") return undefined;
    return { ...loopBaseTransition, times: [0, 0.6, 1] } as Transition;
  }, [loopBaseTransition, animation]);

  const glowTransitions: Transition[] = useMemo(() => {
    if (!shouldAnimate || animation !== "circle" || !circleTransition) return [];
    const base = transitionProp && typeof transitionProp === "object" ? transitionProp : {};
    const duration = Math.max(0.01, Number(base.duration) || 0.7);
    const ringCount = Math.max(1, Math.min(3, Number(rings) || 1));
    const ringStagger = duration / (ringCount + 1);
    const baseDelay = Math.max(0, Number(base.delay) || 0);
    return Array.from({ length: ringCount }).map((_, i) => ({
      ...circleTransition,
      delay: baseDelay + i * ringStagger,
    })) as Transition[];
  }, [shouldAnimate, animation, transitionProp, rings, circleTransition]);

  return (
    <div
      ref={ref}
      style={containerStyle}
      className={className}
      role="img"
      aria-label={label}
      title={label}
    >
      {animation === "circle" &&
        (glowTransitions.length ? glowTransitions : circleTransition ? [circleTransition] : []).map(
          (t, i) => (
            <motion.div
              key={i}
              style={glowStyle}
              animate={animateGlow ?? { opacity: 0, scale: 1 }}
              transition={t}
              aria-hidden="true"
            />
          )
        )}
      {animation === "glow" && (
        <motion.div
          style={blurStyle}
          animate={animateBlurGlow ?? { opacity: 0, scale: 0 }}
          transition={blurTransition}
          aria-hidden="true"
        />
      )}
      <motion.div style={dotStyle} animate={animateDot} transition={dotTransition} />
    </div>
  );
}

export default ActivityBadge;
