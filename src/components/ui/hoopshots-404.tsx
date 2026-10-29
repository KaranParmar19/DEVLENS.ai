import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

/* -------------------------------------------------------------------------- */
/*                                 Constants                                  */
/* -------------------------------------------------------------------------- */

export interface Hoopshots404Props {
  playTitle?: string;
  playText?: string;
  instruction?: string;
  shotsLabel?: string;
  madeLabel?: string;
  madeText?: string;
  missText?: string;
  safeText?: string;
  outText?: string;
  lastShotLabel?: string;
  lastShotText?: string;
  lastShotSafeText?: string;
  showConfetti?: boolean;
  showWalkthrough?: boolean;
  responsiveType?: boolean;
  retryLimit?: number;
  glassColor?: string;
  glassBlur?: number;
  totalShots?: number;
  winThreshold?: number;
  difficulty?: "easy" | "normal" | "hard";
  ballPositions?: "rotate" | "center";
  ballSpread?: number;
  winTitle?: string;
  winText?: string;
  loseTitle?: string;
  loseText?: string;
  homeLabel?: string;
  homeLink?: string;
  showReplay?: boolean;
  replayLabel?: string;
  backgroundImage?: { src?: string; srcSet?: string };
  wallColor?: string;
  numeralColor?: string;
  textColor?: string;
  mutedColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonIconColor?: string;
  buttonActiveColor?: string;
  buttonActiveTextColor?: string;
  buttonActiveIconColor?: string;
  showIcon?: boolean;
  iconPack?: "line" | "solid" | "bold" | "filled";
  iconPlay?: string;
  iconResult?: string;
  iconPosition?: "auto" | "left" | "right";
  rimColor?: string;
  ballColor?: string;
  netColor?: string;
  boardColor?: string;
  trajectoryColor?: string;
  ballSize?: number;
  ballShadow?: boolean;
  shadowColor?: string;
  shadowDistance?: number;
  topPadding?: number;
  radius?: number | string;
  headingFont?: { fontFamily?: string; fontSize?: string | number; fontWeight?: string | number; letterSpacing?: string; lineHeight?: string | number; fontStyle?: string };
  bodyFont?: { fontFamily?: string; fontSize?: string | number; fontWeight?: string | number; letterSpacing?: string; lineHeight?: string | number; fontStyle?: string };
  instructionFont?: { fontFamily?: string; fontSize?: string | number; fontWeight?: string | number; letterSpacing?: string; lineHeight?: string | number; fontStyle?: string };
  buttonFont?: { fontFamily?: string; fontSize?: string | number; fontWeight?: string | number; letterSpacing?: string; lineHeight?: string | number; fontStyle?: string };
  counterFont?: { fontFamily?: string; fontSize?: string | number; fontWeight?: string | number; letterSpacing?: string; lineHeight?: string | number; fontStyle?: string };
  numeralFont?: { fontFamily?: string; fontSize?: string | number; fontWeight?: string | number; letterSpacing?: string; lineHeight?: string | number; fontStyle?: string };
  style?: React.CSSProperties;
  className?: string;
}

const DEFAULTS = {
  playTitle: "Oops! Airball.",
  playText:
    "We couldn't find the page you're looking for.\nWhile you're here, why not take a shot?",
  instruction:
    "Drag the ball back and aim along the dotted line, then let go. Make {threshold} of {total} to win.",
  shotsLabel: "SHOTS LEFT",
  madeLabel: "MADE",
  madeText:
    "Swish! That's {made} of {total}. Make {needed} more to win, {left} shots left.",
  missText:
    "Missed it. You have {made} of {total}. Make {needed} more to win, {left} shots left.",
  safeText:
    "Swish! That's {made} of {total}. You're already in the win zone, {left} shots left.",
  outText:
    "{made} of {total} so far. Reaching {threshold} isn't possible now, but keep shooting.",
  lastShotLabel: "Last shot",
  lastShotText: "You have {made} of {total}. Make this one to win.",
  lastShotSafeText: "You have {made} of {total} and the win. Make it count.",
  showConfetti: true,
  showWalkthrough: false,
  responsiveType: true,
  retryLimit: 3,
  glassColor: "rgba(255,255,255,0.3)",
  glassBlur: 16,
  totalShots: 5,
  winThreshold: 3,
  difficulty: "normal" as const,
  ballPositions: "rotate" as const,
  ballSpread: 22,
  winTitle: "SWISH!",
  winText: "Maybe you should be looking for a basketball career instead.",
  loseTitle: "Nothing but air.",
  loseText:
    "That's {made} out of {total}. The page you're looking for is still missing, and so is your jump shot.",
  homeLabel: "Back to Home",
  homeLink: "/",
  showReplay: true,
  replayLabel: "Try again",
  wallColor: "#F5EEE9",
  numeralColor: "#202226",
  textColor: "#1B1C20",
  mutedColor: "#5A5A62",
  buttonColor: "#1B1C20",
  buttonTextColor: "#FFFFFF",
  buttonIconColor: "#FFFFFF",
  buttonActiveColor: "#E8501E",
  buttonActiveTextColor: "#FFFFFF",
  buttonActiveIconColor: "#FFFFFF",
  showIcon: true,
  iconPack: "line" as const,
  iconPlay: "arrow-right",
  iconResult: "home",
  iconPosition: "auto" as const,
  rimColor: "#E8501E",
  ballColor: "#E8772E",
  netColor: "#FFFFFF",
  boardColor: "#9A9A9E",
  trajectoryColor: "#E8501E",
  ballSize: 100,
  ballShadow: true,
  shadowColor: "rgba(40,25,15,0.38)",
  shadowDistance: 45,
  topPadding: 60,
  radius: 0,
};

const DEFAULT_FONT = "var(--mf-font, 'Geist', 'Inter', system-ui, sans-serif)";
const FLOOR_TOP = 0.69;
const MAX_BOUNCES = 2;
const RESTITUTION = 0.34;
const POSITION_SEQUENCE = [0, -1, 1];
const GRAVITY_FACTOR = 1.8;
const MIN_PULL_RATIO = 0.3;
const ASSIST_STRENGTH = 0.65;
const ASSIST_WINDOW: Record<"easy" | "normal" | "hard", number> = {
  easy: 2.2,
  normal: 1.6,
  hard: 1,
};
const SCORE_RATIO = 0.78;
const PREVIEW_STEP = 0.05;
const MAX_FLIGHT_SECONDS = 5;
const RESULT_DELAY_MS = 900;

const SPARKS = [
  { dx: -107, dy: -118, angle: 60, len: 14, hot: true },
  { dx: -82, dy: -104, angle: 70, len: 7, hot: false },
  { dx: 80, dy: -122, angle: 105, len: 14, hot: true },
  { dx: 110, dy: -100, angle: 130, len: 14, hot: false },
  { dx: 117, dy: -58, angle: 90, len: 7, hot: true },
  { dx: 140, dy: 94, angle: 55, len: 14, hot: true },
  { dx: 196, dy: 134, angle: 55, len: 14, hot: true },
  { dx: -222, dy: 123, angle: 125, len: 14, hot: true },
  { dx: -191, dy: 166, angle: 60, len: 10, hot: false },
  { dx: -155, dy: 128, angle: 30, len: 9, hot: true },
];

/* -------------------------------------------------------------------------- */
/*                               Pure helpers                                 */
/* -------------------------------------------------------------------------- */

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const pad2 = (value: number) => String(value).padStart(2, "0");

function fillTemplate(text: string, vars: Record<string, string | number>) {
  return Object.keys(vars).reduce(
    (out, key) => out.split(`{${key}}`).join(String(vars[key])),
    text,
  );
}

function resolveColor(probe: HTMLElement, value: string): string {
  probe.style.color = "";
  probe.style.color = value;
  return getComputedStyle(probe).color || value;
}

function layoutScale(w: number, h: number) {
  return clamp(Math.min(w / 760, h / 794), 0.5, 1.6);
}

interface LayoutRect {
  w: number;
  h: number;
  zx: number;
  zy: number;
  zw: number;
  zh: number;
}

interface Geometry extends LayoutRect {
  hx: number;
  hy: number;
  rx: number;
  ry: number;
  netH: number;
  baseR: number;
  startY: number;
  g: number;
  maxPull: number;
  pullVisual: number;
  hMax: number;
  vxMax: number;
}

function getGeometry(layout: LayoutRect, ballScale: number): Geometry {
  const { w, h, zx, zy, zw, zh } = layout;
  const hx = zx + zw / 2;
  const hy = zy + zh * 0.45;
  const rx = zw * 0.4;
  const baseR = clamp(
    Math.min(Math.max(w * 0.042, 22), h * 0.068) * ballScale,
    8,
    120,
  );
  const floorTop = h * FLOOR_TOP;
  const startY = Math.max(hy + baseR * 3, floorTop + (h - floorTop) * 0.45);
  const g = Math.max(h, 240) * GRAVITY_FACTOR;
  const maxPull = clamp(baseR * 2.6, 50, 140);
  const room = Math.max(h - startY - baseR * 1.15, 20);
  return {
    w,
    h,
    zx,
    zy,
    zw,
    zh,
    hx,
    hy,
    rx,
    ry: rx * 0.17,
    netH: zh * 0.4,
    baseR,
    startY,
    g,
    maxPull,
    pullVisual: clamp(room / maxPull, 0.25, 0.7),
    hMax: Math.max(startY - (baseR * 0.6 + 4), 60),
    vxMax: w * 0.5,
  };
}

function getStart(
  geo: Geometry,
  index: number,
  mode: "rotate" | "center",
  spread: number,
) {
  const side =
    mode === "center"
      ? 0
      : (POSITION_SEQUENCE[index % POSITION_SEQUENCE.length] ?? 0);
  return {
    x: clamp(
      geo.hx + side * geo.w * (spread / 100),
      geo.baseR * 1.5,
      geo.w - geo.baseR * 1.5,
    ),
    y: geo.startY,
  };
}

function canLaunch(geo: Geometry, pull: { x: number; y: number }) {
  return pull.y >= geo.maxPull * MIN_PULL_RATIO;
}

function radiusAt(geo: Geometry, y: number) {
  const t = clamp((y - geo.hy) / Math.max(geo.startY - geo.hy, 1), 0, 1.2);
  return geo.baseR * (0.6 + 0.4 * t);
}

function limitPull(
  geo: Geometry,
  start: { x: number; y: number },
  dx: number,
  dy: number,
) {
  let x = dx;
  let y = Math.max(0, dy);
  const length = Math.hypot(x, y);
  if (length > geo.maxPull) {
    x = (x * geo.maxPull) / length;
    y = (y * geo.maxPull) / length;
  }
  x = clamp(x, geo.baseR - start.x, geo.w - geo.baseR - start.x);
  return { x, y };
}

function solveCrossing(
  geo: Geometry,
  start: { x: number; y: number },
  vx: number,
  vy: number,
) {
  const discriminant = vy * vy - 2 * geo.g * (start.y - geo.hy);
  if (discriminant < 0) return null;
  const t = (-vy + Math.sqrt(discriminant)) / geo.g;
  if (t <= 0) return null;
  return { t, x: start.x + vx * t };
}

function computeVelocity(
  geo: Geometry,
  start: { x: number; y: number },
  pull: { x: number; y: number },
  difficulty: "easy" | "normal" | "hard",
) {
  let vx = -pull.x * (geo.vxMax / geo.maxPull);
  const power = clamp(pull.y / geo.maxPull, 0, 1);
  const vy = -Math.sqrt(2 * geo.g * geo.hMax * (0.45 + 0.55 * power));
  const crossing = solveCrossing(geo, start, vx, vy);
  if (crossing) {
    const error = crossing.x - geo.hx;
    if (Math.abs(error) <= ASSIST_WINDOW[difficulty] * geo.rx) {
      vx -= (error * ASSIST_STRENGTH) / crossing.t;
    }
  }
  return { x: vx, y: vy };
}

function buildPreview(
  geo: Geometry,
  start: { x: number; y: number },
  v: { x: number; y: number },
) {
  const crossing = solveCrossing(geo, start, v.x, v.y);
  const tEnd = Math.min(
    crossing ? crossing.t : Math.max(0, (-2 * v.y) / geo.g),
    2.2,
  );
  const points: { x: number; y: number }[] = [];
  for (let t = PREVIEW_STEP; t < tEnd; t += PREVIEW_STEP) {
    points.push({
      x: clamp(start.x + v.x * t, geo.baseR, geo.w - geo.baseR),
      y: start.y + v.y * t + 0.5 * geo.g * t * t,
    });
  }
  points.push({
    x: clamp(start.x + v.x * tEnd, geo.baseR, geo.w - geo.baseR),
    y: start.y + v.y * tEnd + 0.5 * geo.g * tEnd * tEnd,
  });
  return points;
}

function resolveInstantly(
  geo: Geometry,
  start: { x: number; y: number },
  v: { x: number; y: number },
) {
  const crossing = solveCrossing(geo, start, v.x, v.y);
  return (
    crossing !== null && Math.abs(crossing.x - geo.hx) <= geo.rx * SCORE_RATIO
  );
}

interface FlightState {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  crossed: boolean;
  scored: boolean;
  netSway: number;
  bounces: number;
}

function stepFlight(f: FlightState, geo: Geometry, dt: number): boolean {
  const steps = 2;
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const prevY = f.y;
    f.vy += geo.g * h;
    f.x += f.vx * h;
    f.y += f.vy * h;
    f.t += h;
    if (!f.crossed && f.vy > 0 && prevY < geo.hy && f.y >= geo.hy) {
      f.crossed = true;
      const error = Math.abs(f.x - geo.hx);
      if (error <= geo.rx * SCORE_RATIO) {
        f.scored = true;
        f.vx *= 0.2;
        f.vy *= 0.7;
        f.netSway = 1;
      } else if (error <= geo.rx * 1.12) {
        f.vy = -Math.abs(f.vy) * 0.45;
        f.vx = (f.x >= geo.hx ? 1 : -1) * geo.rx * 1.6;
      }
    }
    if (f.scored && f.y < geo.hy + geo.netH) {
      f.x += (geo.hx - f.x) * Math.min(1, h * 8);
    }
    f.netSway = Math.max(0, f.netSway - h * 0.9);
    if (f.x < geo.baseR) {
      f.x = geo.baseR;
      f.vx = Math.abs(f.vx) * 0.3;
    } else if (f.x > geo.w - geo.baseR) {
      f.x = geo.w - geo.baseR;
      f.vx = -Math.abs(f.vx) * 0.3;
    }
    if (f.t > 0.15 && f.vy > 0 && f.y >= geo.startY) {
      f.y = geo.startY;
      if (f.bounces >= MAX_BOUNCES) return true;
      f.vy = -f.vy * RESTITUTION;
      f.vx *= 0.6;
      f.bounces += 1;
    }
  }
  return f.t > MAX_FLIGHT_SECONDS;
}

/* -------------------------------------------------------------------------- */
/*                                  Drawing                                   */
/* -------------------------------------------------------------------------- */

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

interface ThemeState {
  rim: string;
  ball: string;
  net: string;
  board: string;
  text: string;
  trail: string;
  shadow: string;
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  shadow: { color: string; dx: number; dy: number; blur: number } | null,
) {
  if (shadow) {
    ctx.save();
    ctx.shadowColor = shadow.color;
    ctx.shadowOffsetX = shadow.dx;
    ctx.shadowOffsetY = shadow.dy;
    ctx.shadowBlur = shadow.blur;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  const shade = ctx.createRadialGradient(
    x - r * 0.35,
    y - r * 0.4,
    r * 0.1,
    x,
    y,
    r,
  );
  shade.addColorStop(0, "rgba(255,255,255,0.3)");
  shade.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.strokeStyle = "rgba(45,22,10,0.85)";
  ctx.lineWidth = Math.max(1.2, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 1.35, y, r * 1.05, -0.95, 0.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + r * 1.35, y, r * 1.05, Math.PI - 0.95, Math.PI + 0.95);
  ctx.stroke();
  ctx.restore();
}

function drawBackboard(
  ctx: CanvasRenderingContext2D,
  geo: Geometry,
  theme: ThemeState,
) {
  const left = geo.zx + geo.zw * 0.15;
  const width = geo.zw * 0.7;
  const top = geo.zy + geo.zh * 0.2;
  const height = geo.hy - top + geo.zh * 0.02;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = theme.board;
  roundedRect(ctx, left, top, width, height, geo.zw * 0.04);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = Math.max(1.5, geo.zw * 0.012);
  const boxW = geo.zw * 0.34;
  const boxH = geo.zh * 0.1;
  ctx.strokeRect(geo.hx - boxW / 2, geo.hy - boxH - geo.zh * 0.03, boxW, boxH);
  ctx.restore();
}

function drawNet(
  ctx: CanvasRenderingContext2D,
  geo: Geometry,
  theme: ThemeState,
  offset: number,
) {
  const { hx, hy, rx, ry, netH } = geo;
  const count = 10;
  const bottomRx = rx * 0.58;
  const bottomRy = ry * 0.7;
  const bottomY = hy + netH;
  const ring = (fraction: number) => ({
    rx: rx + (bottomRx - rx) * fraction,
    ry: ry + (bottomRy - ry) * fraction,
    y: hy + netH * fraction,
    dx: offset * fraction,
  });
  const top = (i: number) => {
    const a = (i / count) * Math.PI * 2;
    return { x: hx + rx * Math.cos(a), y: hy + ry * Math.sin(a) };
  };
  const bottom = (i: number) => {
    const a = (i / count) * Math.PI * 2;
    return {
      x: hx + bottomRx * Math.cos(a) + offset,
      y: bottomY + bottomRy * Math.sin(a),
    };
  };
  ctx.save();
  ctx.strokeStyle = theme.net;
  ctx.lineWidth = Math.max(1.1, rx * 0.017);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const from = top(i);
    const a = bottom(i + 1);
    const b = bottom(i - 1);
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(a.x, a.y);
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  for (const fraction of [0.5, 1]) {
    const r = ring(fraction);
    ctx.beginPath();
    ctx.ellipse(hx + r.dx, r.y, r.rx, r.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRim(
  ctx: CanvasRenderingContext2D,
  geo: Geometry,
  theme: ThemeState,
) {
  ctx.save();
  ctx.strokeStyle = theme.rim;
  ctx.lineWidth = Math.max(3, geo.zw * 0.05);
  ctx.beginPath();
  ctx.ellipse(geo.hx, geo.hy, geo.rx, geo.ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

interface SceneState {
  ball: { x: number; y: number } | null;
  scored: boolean;
  netOffset: number;
  preview: { x: number; y: number }[];
  shadowOffset: number | null;
  dpr: number;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  geo: Geometry,
  theme: ThemeState,
  scene: SceneState,
) {
  drawBackboard(ctx, geo, theme);
  const ball = scene.ball;
  const shadowFor = (r: number) =>
    scene.shadowOffset === null
      ? null
      : {
          color: theme.shadow,
          dx: r * scene.shadowOffset * 0.9 * scene.dpr,
          dy: r * scene.shadowOffset * 0.55 * scene.dpr,
          blur: r * 0.55 * scene.dpr,
        };
  const behind = ball !== null && scene.scored && ball.y < geo.hy + geo.netH;
  if (ball && behind) {
    drawBall(
      ctx,
      ball.x,
      ball.y,
      radiusAt(geo, ball.y),
      theme.ball,
      shadowFor(radiusAt(geo, ball.y)),
    );
  }
  drawNet(ctx, geo, theme, scene.netOffset);
  drawRim(ctx, geo, theme);
  if (!ball) return;
  ctx.save();
  ctx.fillStyle = theme.trail;
  const count = scene.preview.length;
  scene.preview.forEach((p, index) => {
    if (Math.hypot(p.x - ball.x, p.y - ball.y) < geo.baseR * 1.1) return;
    const progress = count > 1 ? index / (count - 1) : 0;
    ctx.globalAlpha = 0.95 - progress * 0.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.4 - progress * 1.4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  if (!behind) {
    drawBall(
      ctx,
      ball.x,
      ball.y,
      radiusAt(geo, ball.y),
      theme.ball,
      shadowFor(radiusAt(geo, ball.y)),
    );
  }
}

function textStyle(
  font: Hoopshots404Props["headingFont"] | undefined,
  fallback: { size: number; weight: number | string; letterSpacing?: string; lineHeight?: number | string },
  typeScale: number,
): React.CSSProperties {
  const userSize = parseFloat(String(font?.fontSize ?? ""));
  const fontSize =
    Number.isFinite(userSize) && userSize > 0
      ? Math.max(userSize * typeScale, Math.min(userSize, 14))
      : fallback.size;
  return {
    fontFamily: font?.fontFamily ?? DEFAULT_FONT,
    fontWeight: font?.fontWeight ?? fallback.weight,
    fontStyle: font?.fontStyle,
    fontSize,
    letterSpacing: font?.letterSpacing ?? fallback.letterSpacing,
    lineHeight: font?.lineHeight ?? fallback.lineHeight,
  };
}

/* -------------------------------------------------------------------------- */
/*                               Small UI parts                               */
/* -------------------------------------------------------------------------- */

function Numeral4({ scale, color }: { scale: number; color: string }) {
  return (
    <svg
      aria-hidden="true"
      width={170 * scale}
      height={200 * scale}
      viewBox="0 0 170 200"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Exact architectural geometric 4 matching project typography */}
      <path
        fill={color}
        fillRule="evenodd"
        d="M 5.8 0 L 46.4 0 L 46.4 123.1 L 90.8 123.1 L 90.8 5.8 L 119.8 5.8 L 125.6 11.5 L 125.6 115.4 L 168.1 115.4 L 168.1 136.5 L 125.6 144.2 L 125.6 198.1 L 85.0 198.1 L 85.0 151.9 L 1.9 151.9 L 0 148.1 L 0 5.8 Z"
      />
      {/* Subtle 3D architectural top bevel facets */}
      <path
        fill="currentColor"
        opacity="0.18"
        d="M 0 5.8 L 5.8 0 L 46.4 0 L 40.6 5.8 Z"
      />
      <path
        fill="currentColor"
        opacity="0.32"
        d="M 90.8 5.8 L 119.8 5.8 L 125.6 11.5 L 96.6 11.5 Z"
      />
    </svg>
  );
}

const ICONS: Record<string, { line: string; solid?: string; solidStroke?: string }> = {
  home: {
    line: "M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5",
    solid: "M12 2.5L2 11.5h3V21h5.5v-6h3v6H19V11.5h3z",
  },
  "arrow-right": {
    line: "M5 12h14M13 6l6 6-6 6",
    solid: "M4 10.5h10V6l7 6-7 6v-4.5H4z",
  },
  "arrow-left": {
    line: "M19 12H5M11 6l-6 6 6 6",
    solid: "M20 10.5H10V6l-7 6 7 6v-4.5h10z",
  },
  "arrow-up-right": {
    line: "M7 17L17 7M8 7h9v9",
    solid: "M6.3 15.9L14.4 7.8H8V5.5h11.5V17h-2.3V9.6l-8.1 8.1z",
  },
  play: { line: "M7 4.5v15l12-7.5z", solid: "M6.5 3.5v17L20 12z" },
  refresh: { line: "M23 4v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L23 10" },
  check: { line: "M5 12.5l4.5 4.5L19 7.5" },
};

const TRAILING_ICONS = ["arrow-right", "arrow-up-right"];

function Icon({
  name,
  pack,
  size,
}: {
  name: string;
  pack: "line" | "solid" | "bold" | "filled";
  size: number;
}) {
  const shape = ICONS[name] ?? ICONS["home"];
  const solid = pack === "filled" && shape.solid !== undefined;
  const strokeWidth = pack === "line" ? 1.8 : pack === "bold" ? 2.6 : 2.8;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0 }}
    >
      {solid ? (
        <>
          <path d={shape.solid} fill="currentColor" stroke="none" />
          {shape.solidStroke && <path d={shape.solidStroke} />}
        </>
      ) : (
        <path d={shape.line} />
      )}
    </svg>
  );
}

function Environment({ wall }: { wall: string }) {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, background: wall }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(112deg, rgba(255,255,255,0) 8%, rgba(255,255,255,0.45) 26%, rgba(255,255,255,0) 44%, rgba(255,255,255,0.3) 66%, rgba(255,255,255,0.86) 96%)",
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  age: number;
  phase: number;
}

export function Hoopshots404(rawProps: Hoopshots404Props = {}) {
  const props = { ...DEFAULTS, ...rawProps };
  const {
    playTitle,
    playText,
    instruction,
    shotsLabel,
    madeLabel,
    madeText,
    missText,
    safeText,
    outText,
    lastShotLabel,
    lastShotText,
    lastShotSafeText,
    showConfetti,
    showWalkthrough,
    responsiveType,
    retryLimit,
    glassColor,
    glassBlur,
    totalShots,
    winThreshold,
    difficulty,
    winTitle,
    winText,
    loseTitle,
    loseText,
    homeLabel,
    homeLink,
    showReplay,
    replayLabel,
    backgroundImage,
    wallColor,
    numeralColor,
    textColor,
    mutedColor,
    buttonColor,
    buttonTextColor,
    buttonIconColor,
    buttonActiveColor,
    buttonActiveTextColor,
    buttonActiveIconColor,
    showIcon,
    iconPack,
    iconPlay,
    iconResult,
    iconPosition,
    rimColor,
    ballColor,
    netColor,
    boardColor,
    trajectoryColor,
    ballSize,
    ballShadow,
    shadowColor,
    shadowDistance,
    ballPositions,
    ballSpread,
    topPadding,
    radius,
    headingFont,
    bodyFont,
    instructionFont,
    buttonFont,
    counterFont,
    numeralFont,
    style,
    className,
  } = props;

  const total = clamp(Math.round(totalShots) || DEFAULTS.totalShots, 1, 10);
  const needed = clamp(Math.round(winThreshold) || 1, 1, total);

  const rootRef = useRef<HTMLDivElement>(null);
  const zeroRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const gameRef = useRef<{
    pull: { x: number; y: number };
    dragging: boolean;
    flight: FlightState | null;
    preview: { x: number; y: number }[];
  }>({
    pull: { x: 0, y: 0 },
    dragging: false,
    flight: null,
    preview: [],
  });

  const loopRef = useRef<number | null>(null);
  const drawRafRef = useRef<number | null>(null);
  const resultTimerRef = useRef<number | null>(null);
  const visibleRef = useRef(true);
  const drawRef = useRef<() => void>(() => undefined);
  const finishRef = useRef<(scored: boolean) => void>(() => undefined);
  const geoRef = useRef<Geometry | null>(null);
  const measureRef = useRef<() => void>(() => undefined);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<{ pieces: ConfettiPiece[]; raf: number | null }>({
    pieces: [],
    raf: null,
  });
  const themeRef = useRef<ThemeState | null>(null);

  const [layout, setLayout] = useState<LayoutRect>({
    w: 1280,
    h: 794,
    zx: 546,
    zy: 40,
    zw: 187,
    zh: 200,
  });

  const [results, setResults] = useState<("made" | "missed")[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<"made" | "missed" | null>(null);
  const [flying, setFlying] = useState(false);
  const [retriesUsed, setRetriesUsed] = useState(0);
  const [activeBtn, setActiveBtn] = useState<string | null>(null);
  const [focusBtn, setFocusBtn] = useState<string | null>(null);
  const [hasShot, setHasShot] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);

  const [theme, setTheme] = useState<ThemeState>({
    rim: rimColor,
    ball: ballColor,
    net: netColor,
    board: boardColor,
    text: textColor,
    trail: trajectoryColor,
    shadow: shadowColor,
  });

  const ballScale = clamp(ballSize / 100, 0.4, 2.5);
  const geo = useMemo(
    () => getGeometry(layout, ballScale),
    [layout, ballScale],
  );

  const start = useMemo(
    () =>
      getStart(geo, results.length, ballPositions, clamp(ballSpread, 0, 40)),
    [geo, results.length, ballPositions, ballSpread],
  );

  const scale = layoutScale(layout.w, layout.h);
  const typeScale = responsiveType ? scale : 1;
  const ts = (
    font: Hoopshots404Props["headingFont"] | undefined,
    fallback: { size: number; weight: number | string; letterSpacing?: string; lineHeight?: number | string },
  ) => textStyle(font, fallback, typeScale);

  const parsedNumeralSize =
    parseFloat(String(numeralFont?.fontSize ?? "")) * typeScale;
  const numeralSize =
    Number.isFinite(parsedNumeralSize) && parsedNumeralSize > 0
      ? parsedNumeralSize
      : 250 * scale;
  const ns = numeralSize / 250;
  const customFour = Boolean(numeralFont?.fontFamily);
  const done = results.length >= total;
  const resultVisible = done && showResult;
  const made = results.filter((r) => r === "made").length;
  const won = made >= needed;
  const leftToShoot = Math.max(0, total - results.length);
  const retryAllowance = clamp(Math.round(retryLimit) || 0, 0, 20);
  const retriesLeft = Math.max(0, retryAllowance - retriesUsed);

  const vars = {
    made,
    total,
    left: leftToShoot,
    needed: Math.max(0, needed - made),
    threshold: needed,
  };

  useEffect(() => {
    geoRef.current = geo;
  }, [geo]);

  /* ----------------------------- drawing ------------------------------ */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || layout.w < 2 || layout.h < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelW = Math.round(layout.w * dpr);
    const pixelH = Math.round(layout.h * dpr);
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, layout.w, layout.h);
    const game = gameRef.current;
    let ball: { x: number; y: number } | null = start;
    let scored = false;
    let netOffset = 0;
    let preview: { x: number; y: number }[] = [];
    if (done) {
      ball = null;
    } else if (game.flight) {
      const flight = game.flight;
      ball = { x: flight.x, y: flight.y };
      scored = flight.scored;
      netOffset = flight.netSway * geo.rx * 0.2 * Math.sin(flight.t * 22);
    } else {
      ball = {
        x: start.x + game.pull.x * geo.pullVisual,
        y: start.y + game.pull.y * geo.pullVisual,
      };
      preview = game.preview;
    }
    drawScene(ctx, geo, theme, {
      ball,
      scored,
      netOffset,
      preview,
      shadowOffset: ballShadow ? clamp(shadowDistance, 0, 100) / 100 : null,
      dpr,
    });
  }, [layout, geo, start, theme, done, ballShadow, shadowDistance]);

  useEffect(() => {
    drawRef.current = draw;
    draw();
  }, [draw]);

  const requestDraw = useCallback(() => {
    if (drawRafRef.current !== null) return;
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = null;
      drawRef.current();
    });
  }, []);

  /* ------------------------- flight animation ------------------------- */
  const stopLoop = useCallback(() => {
    if (loopRef.current !== null) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
  }, []);

  const startLoop = useCallback(() => {
    if (loopRef.current !== null) return;
    if (!gameRef.current.flight || !visibleRef.current) return;
    let last: number | null = null;
    const tick = (now: number) => {
      const flight = gameRef.current.flight;
      const currentGeo = geoRef.current;
      if (!flight || !currentGeo || !visibleRef.current) {
        loopRef.current = null;
        return;
      }
      const dt = last === null ? 0 : Math.min((now - last) / 1e3, 1 / 30);
      last = now;
      const finished = stepFlight(flight, currentGeo, dt);
      drawRef.current();
      if (finished) {
        loopRef.current = null;
        gameRef.current.flight = null;
        finishRef.current(flight.scored);
        return;
      }
      loopRef.current = requestAnimationFrame(tick);
    };
    loopRef.current = requestAnimationFrame(tick);
  }, []);

  /* ------------------------------ confetti ----------------------------- */
  const stopConfetti = useCallback(() => {
    const state = confettiRef.current;
    if (state.raf !== null) {
      cancelAnimationFrame(state.raf);
      state.raf = null;
    }
  }, []);

  const clearConfetti = useCallback(() => {
    const canvas = confettiCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const runConfetti = useCallback(() => {
    const state = confettiRef.current;
    if (state.raf !== null || state.pieces.length === 0) return;
    if (!visibleRef.current) return;
    let last: number | null = null;
    const tick = (now: number) => {
      const canvas = confettiCanvasRef.current;
      const g = geoRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !g || !ctx) {
        state.raf = null;
        return;
      }
      const dt = last === null ? 0 : Math.min((now - last) / 1e3, 1 / 30);
      last = now;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelW = Math.round(g.w * dpr);
      const pixelH = Math.round(g.h * dpr);
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW;
        canvas.height = pixelH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);
      const gravity = g.h * 0.9;
      state.pieces = state.pieces.filter((p) => {
        p.age += dt;
        p.vy += gravity * dt;
        p.vx -= p.vx * 3 * dt;
        p.vy -= p.vy * 3 * dt;
        p.x += p.vx * dt + Math.sin(p.age * 4 + p.phase) * 24 * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        return p.y < g.h + 30 && p.age < 6;
      });
      for (const p of state.pieces) {
        ctx.save();
        ctx.globalAlpha = clamp(6 - p.age, 0, 1);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.age * 6 + p.phase));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (state.pieces.length === 0) {
        state.raf = null;
        ctx.clearRect(0, 0, g.w, g.h);
        return;
      }
      state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
  }, []);

  const finishShot = useCallback(
    (madeShot: boolean) => {
      const game = gameRef.current;
      game.pull = { x: 0, y: 0 };
      game.dragging = false;
      game.preview = [];
      setLastResult(madeShot ? "made" : "missed");
      setFlying(false);
      setResults((prev) => {
        if (prev.length >= total) return prev;
        const next = [...prev, madeShot ? ("made" as const) : ("missed" as const)];
        if (next.length >= total) {
          if (resultTimerRef.current !== null) {
            window.clearTimeout(resultTimerRef.current);
          }
          resultTimerRef.current = window.setTimeout(() => {
            resultTimerRef.current = null;
            setShowResult(true);
          }, RESULT_DELAY_MS);
        }
        return next;
      });
    },
    [total],
  );

  useEffect(() => {
    finishRef.current = finishShot;
  }, [finishShot]);

  /* ------------------------------ effects ----------------------------- */
  useEffect(() => {
    const root = rootRef.current;
    const zero = zeroRef.current;
    if (!root || !zero) return;
    const measure = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (w < 2 || h < 2) return;
      const rootRect = root.getBoundingClientRect();
      const zeroRect = zero.getBoundingClientRect();
      const factor = rootRect.width > 0 ? root.clientWidth / rootRect.width : 1;
      const round = (n: number) => Math.round(n * 2) / 2;
      const next = {
        w,
        h,
        zx: round((zeroRect.left - rootRect.left) * factor),
        zy: round((zeroRect.top - rootRect.top) * factor),
        zw: round(zeroRect.width * factor),
        zh: round(zeroRect.height * factor),
      };
      setLayout((prev) =>
        prev.w === next.w &&
        prev.h === next.h &&
        prev.zx === next.zx &&
        prev.zy === next.zy &&
        prev.zw === next.zw &&
        prev.zh === next.zh
          ? prev
          : next,
      );
    };
    measureRef.current = measure;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(zero);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    measureRef.current();
  }, [topPadding, numeralSize, scale]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        visibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          startLoop();
          runConfetti();
        } else {
          stopLoop();
          stopConfetti();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [startLoop, stopLoop, runConfetti, stopConfetti]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;
    const next = {
      rim: resolveColor(probe, rimColor),
      ball: resolveColor(probe, ballColor),
      net: resolveColor(probe, netColor),
      board: resolveColor(probe, boardColor),
      text: resolveColor(probe, textColor),
      trail: resolveColor(probe, trajectoryColor),
      shadow: resolveColor(probe, shadowColor),
    };
    setTheme((prev) =>
      prev.rim === next.rim &&
      prev.ball === next.ball &&
      prev.net === next.net &&
      prev.board === next.board &&
      prev.text === next.text &&
      prev.trail === next.trail &&
      prev.shadow === next.shadow
        ? prev
        : next,
    );
  }, [
    rimColor,
    ballColor,
    netColor,
    boardColor,
    textColor,
    trajectoryColor,
    shadowColor,
  ]);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // Confetti burst on the winning screen.
  useEffect(() => {
    if (reducedMotion || !showConfetti) return;
    if (!resultVisible || !won) return;
    const g = geoRef.current;
    const colors = themeRef.current;
    if (!g || !colors) return;
    const palette = [
      colors.rim,
      colors.ball,
      colors.text,
      "#F6B93B",
      "#FFD9A0",
    ];
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const unit = Math.max(g.h / 794, 0.6);
    const piece = (x: number, y: number, vx: number, vy: number): ConfettiPiece => ({
      x,
      y,
      vx,
      vy,
      rot: rand(0, Math.PI * 2),
      vr: rand(-9, 9),
      w: rand(7, 12) * unit,
      h: rand(4, 7) * unit,
      color: palette[Math.floor(Math.random() * palette.length)] ?? "#F6B93B",
      age: 0,
      phase: rand(0, Math.PI * 2),
    });
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < 90; i++) {
      const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const speed = rand(0.5, 1.3) * g.h * 1.1;
      pieces.push(
        piece(
          g.hx + rand(-20, 20),
          g.hy,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
        ),
      );
    }
    for (let i = 0; i < 70; i++) {
      pieces.push(
        piece(
          rand(0, g.w),
          rand(-0.25 * g.h, -10),
          rand(-60, 60),
          rand(40, 200),
        ),
      );
    }
    confettiRef.current.pieces = pieces;
    runConfetti();
    return () => {
      stopConfetti();
      clearConfetti();
    };
  }, [
    resultVisible,
    won,
    reducedMotion,
    showConfetti,
    runConfetti,
    stopConfetti,
    clearConfetti,
  ]);

  useEffect(() => {
    if (resultVisible) {
      resultRef.current?.focus();
    }
  }, [resultVisible]);

  useEffect(
    () => () => {
      if (loopRef.current !== null) cancelAnimationFrame(loopRef.current);
      if (drawRafRef.current !== null) cancelAnimationFrame(drawRafRef.current);
      if (resultTimerRef.current !== null)
        window.clearTimeout(resultTimerRef.current);
      if (confettiRef.current.raf !== null)
        cancelAnimationFrame(confettiRef.current.raf);
    },
    [],
  );

  /* ----------------------------- interaction -------------------------- */
  const cancelAim = () => {
    const game = gameRef.current;
    game.dragging = false;
    game.pull = { x: 0, y: 0 };
    game.preview = [];
    requestDraw();
  };

  const applyPull = (dx: number, dy: number) => {
    const game = gameRef.current;
    const pull = limitPull(geo, start, dx, dy);
    game.pull = pull;
    game.preview = canLaunch(geo, pull)
      ? buildPreview(geo, start, computeVelocity(geo, start, pull, difficulty))
      : [];
    requestDraw();
  };

  const launch = () => {
    const game = gameRef.current;
    const pull = game.pull;
    game.dragging = false;
    if (!canLaunch(geo, pull)) {
      cancelAim();
      return;
    }
    const v = computeVelocity(geo, start, pull, difficulty);
    game.pull = { x: 0, y: 0 };
    game.preview = [];
    setHasShot(true);
    setFlying(true);
    if (reducedMotion) {
      finishShot(resolveInstantly(geo, start, v));
      requestDraw();
      return;
    }
    game.flight = {
      t: 0,
      x: start.x,
      y: start.y,
      vx: v.x,
      vy: v.y,
      crossed: false,
      scored: false,
      netSway: 0,
      bounces: 0,
    };
    startLoop();
  };

  const toLocal = (e: React.PointerEvent) => {
    const root = rootRef.current;
    if (!root) return null;
    const rect = root.getBoundingClientRect();
    const factor = rect.width > 0 ? root.clientWidth / rect.width : 1;
    return {
      x: (e.clientX - rect.left) * factor,
      y: (e.clientY - rect.top) * factor,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const game = gameRef.current;
    if (done || game.flight) return;
    const point = toLocal(e);
    if (!point) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Optional pointer capture
    }
    game.dragging = true;
    setLastResult(null);
    applyPull(point.x - start.x, point.y - start.y);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!gameRef.current.dragging) return;
    const point = toLocal(e);
    if (!point) return;
    applyPull(point.x - start.x, point.y - start.y);
  };

  const onPointerUp = () => {
    if (!gameRef.current.dragging) return;
    launch();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const game = gameRef.current;
    if (done || game.flight) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      launch();
      return;
    }
    if (e.key === "Escape") {
      cancelAim();
      return;
    }
    const step = geo.maxPull * 0.06;
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;
    e.preventDefault();
    setLastResult(null);
    const base =
      game.pull.x === 0 && game.pull.y === 0
        ? { x: 0, y: geo.maxPull * 0.75 }
        : game.pull;
    applyPull(base.x + dx, base.y + dy);
  };

  const handleReplay = () => {
    if (retriesUsed >= retryAllowance) return;
    setRetriesUsed((count) => count + 1);
    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
    gameRef.current.flight = null;
    cancelAim();
    setResults([]);
    setShowResult(false);
    setLastResult(null);
    setHasShot(false);
    setFlying(false);
  };

  /* ------------------------------ derived UI -------------------------- */
  const s = scale;
  const reach = Math.max(geo.baseR * 1.8, 44);
  const heading = resultVisible ? (won ? winTitle : loseTitle) : playTitle;
  const bodyText = resultVisible
    ? won
      ? fillTemplate(winText, vars)
      : fillTemplate(loseText, vars)
    : playText;

  const buttonBase: React.CSSProperties = {
    ...ts(buttonFont, { size: Math.max(14, 15 * s), weight: 500 }),
    minHeight: Math.max(44, Math.round(44 * s)),
    padding: `0 ${Math.round(26 * s)}px`,
    borderRadius: 999,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    boxSizing: "border-box",
    borderWidth: 2,
    borderStyle: "solid",
    outlineOffset: 2,
    transition: reducedMotion
      ? "none"
      : "background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.18s ease",
  };

  const homeActive = activeBtn === "home" || focusBtn === "home";
  const replayActive = activeBtn === "replay" || focusBtn === "replay";

  const primaryButton: React.CSSProperties = {
    ...buttonBase,
    background: homeActive ? buttonActiveColor : buttonColor,
    borderColor: homeActive ? buttonActiveColor : buttonColor,
    color: homeActive ? buttonActiveTextColor : buttonTextColor,
    outline: focusBtn === "home" ? `2px solid ${buttonActiveColor}` : "none",
  };

  const secondaryButton: React.CSSProperties = {
    ...buttonBase,
    background: replayActive ? buttonActiveColor : "transparent",
    borderColor: replayActive ? buttonActiveColor : buttonColor,
    color: replayActive ? buttonActiveTextColor : textColor,
    outline: focusBtn === "replay" ? `2px solid ${buttonActiveColor}` : "none",
  };

  const buttonHandlers = (id: string) => ({
    onPointerEnter: () => setActiveBtn(id),
    onPointerLeave: () => setActiveBtn(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      try {
        setFocusBtn(e.currentTarget.matches(":focus-visible") ? id : null);
      } catch {
        setFocusBtn(null);
      }
    },
    onBlur: () => setFocusBtn(null),
  });

  const iconName = resultVisible ? iconResult : iconPlay;
  const iconAtEnd =
    iconPosition === "auto"
      ? TRAILING_ICONS.includes(iconName)
      : iconPosition === "right";
  const iconSize = Math.max(16, 17 * s);

  const homeIcon = showIcon ? (
    <span
      style={{
        display: "inline-flex",
        color: homeActive ? buttonActiveIconColor : buttonIconColor,
        transition: reducedMotion ? "none" : "color 0.18s ease",
      }}
    >
      <Icon name={iconName} pack={iconPack} size={iconSize} />
    </span>
  ) : null;

  const stillNeeded = vars.needed;
  const cannotWin = stillNeeded > leftToShoot;

  let feedbackText = "";
  if (lastResult !== null) {
    const template =
      lastResult === "made" && stillNeeded === 0
        ? safeText
        : cannotWin
          ? outText
          : lastResult === "made"
            ? madeText
            : missText;
    feedbackText = fillTemplate(template, vars);
  }

  const isLastShot = !done && leftToShoot === 1 && results.length > 0;
  const lastText = isLastShot
    ? fillTemplate(
        stillNeeded === 0
          ? lastShotSafeText
          : cannotWin
            ? outText
            : lastShotText,
        vars,
      )
    : "";

  const showGuide = !done && results.length === 0 && !hasShot;
  const showLast = !showGuide && isLastShot && !flying;
  const showFeedbackLabel =
    !showGuide && !showLast && !done && !flying && lastResult !== null;

  const labelText = showGuide
    ? fillTemplate(instruction, vars)
    : showLast
      ? lastText
      : showFeedbackLabel
        ? feedbackText
        : "";

  const announce = [feedbackText, showLast ? lastText : ""]
    .filter((part) => part !== "")
    .join(" ");

  const labelOnRight = start.x <= geo.hx + 1;
  const labelGap = geo.baseR * 1.5 + 14;
  const labelEdge = labelOnRight
    ? start.x + labelGap
    : start.x - geo.baseR - 14;

  const fourGlyph = customFour ? (
    <span
      aria-hidden="true"
      style={{
        ...ts(numeralFont, { size: numeralSize, weight: 900 }),
        fontSize: numeralSize,
        lineHeight: 0.75,
        letterSpacing: "normal",
        display: "block",
        flexShrink: 0,
        color: numeralColor,
      }}
    >
      4
    </span>
  ) : (
    <Numeral4 scale={ns} color={numeralColor} />
  );

  const counterSize =
    parseFloat(String(counterFont?.fontSize ?? "")) * typeScale;
  const labelSize = Number.isFinite(counterSize)
    ? Math.max(10, counterSize * 0.65)
    : Math.max(10, 11 * s);

  const pillText = resultVisible
    ? `${pad2(made)}/${pad2(total)}`
    : pad2(leftToShoot);
  const pillLabel = resultVisible ? madeLabel : shotsLabel;

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "100vh",
        boxSizing: "border-box",
        overflow: "hidden",
        background: wallColor,
        color: textColor,
        borderRadius: radius,
        fontFamily: DEFAULT_FONT,
        userSelect: "none",
        ...style,
      }}
    >
      <span ref={probeRef} hidden aria-hidden="true" />

      {backgroundImage?.src ? (
        <img
          src={backgroundImage.src}
          srcSet={backgroundImage.srcSet}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <Environment wall={wallColor} />
      )}

      {/* 404 & Content Container */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          paddingTop: clamp(topPadding, 0, 400),
          paddingLeft: 16,
          paddingRight: 16,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          zIndex: 2,
        }}
      >
        {/* 4 0 4 Glyphs with Center Hoop */}
        <div
          role="img"
          aria-label="404"
          style={{ display: "flex", alignItems: "center", gap: 10 * ns }}
        >
          {fourGlyph}
          <div
            ref={zeroRef}
            style={{
              position: "relative",
              width: 187 * ns,
              height: 200 * ns,
              borderRadius: 187 * ns * 0.42,
              background: numeralColor,
              flexShrink: 0,
            }}
          >
            {resultVisible && won && (
              <svg
                aria-hidden="true"
                width={0}
                height={0}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  overflow: "visible",
                }}
              >
                {SPARKS.map((spark, index) => {
                  const half = (spark.len * ns) / 2;
                  const rad = (spark.angle * Math.PI) / 180;
                  const cx = spark.dx * ns;
                  const cy = spark.dy * ns;
                  return (
                    <line
                      key={index}
                      x1={cx - Math.cos(rad) * half}
                      y1={cy - Math.sin(rad) * half}
                      x2={cx + Math.cos(rad) * half}
                      y2={cy + Math.sin(rad) * half}
                      stroke={spark.hot ? rimColor : numeralColor}
                      strokeWidth={Math.max(2, 3.2 * s)}
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>
            )}
          </div>
          {fourGlyph}
        </div>

        {/* Heading */}
        <h2
          ref={resultRef}
          tabIndex={-1}
          style={{
            margin: 0,
            marginTop: 38 * s,
            ...ts(headingFont, {
              size: 46 * s,
              weight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }),
            color: textColor,
            outline: "none",
          }}
        >
          {heading}
        </h2>

        {/* Body Text */}
        <p
          style={{
            margin: 0,
            marginTop: 14 * s,
            maxWidth: 560 * s,
            whiteSpace: "pre-line",
            ...ts(bodyFont, {
              size: Math.max(14, 19 * s),
              weight: 400,
              lineHeight: 1.5,
            }),
            color: mutedColor,
          }}
        >
          {bodyText}
        </p>

        {/* Action Buttons */}
        <div
          style={{
            marginTop: 30 * s,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
          }}
        >
          <Link
            to={homeLink}
            style={primaryButton}
            {...buttonHandlers("home")}
          >
            {!iconAtEnd && homeIcon}
            <span>{homeLabel}</span>
            {iconAtEnd && homeIcon}
          </Link>

          {resultVisible && showReplay && retriesLeft > 0 && (
            <button
              type="button"
              onClick={handleReplay}
              style={secondaryButton}
              {...buttonHandlers("replay")}
            >
              {fillTemplate(replayLabel, { retries: retriesLeft })}
            </button>
          )}
        </div>
      </div>

      {/* Physics Basketball Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      {/* Confetti Explosion Canvas */}
      <canvas
        ref={confettiCanvasRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 4,
        }}
      />

      {/* Interactive Aim Grab Target */}
      {!done && (
        <div
          role="application"
          tabIndex={0}
          aria-label={`${fillTemplate(instruction, vars)} Use the arrow keys to aim and Enter to shoot.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={cancelAim}
          onKeyDown={onKeyDown}
          onFocus={(e) => {
            try {
              setFocusVisible(e.currentTarget.matches(":focus-visible"));
            } catch {
              setFocusVisible(false);
            }
          }}
          onBlur={() => setFocusVisible(false)}
          style={{
            position: "absolute",
            left: start.x - reach,
            top: start.y - reach,
            width: reach * 2,
            height: reach * 2,
            borderRadius: "50%",
            touchAction: "none",
            cursor: gameRef.current.dragging ? "grabbing" : "grab",
            outline: focusVisible ? `2px solid ${rimColor}` : "none",
            outlineOffset: 2,
            zIndex: 10,
          }}
        />
      )}

      {/* Frosted Glass Instructional Hint */}
      {(showWalkthrough || (!done && results.length === 0)) && labelText !== "" && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: start.y,
            transform: "translateY(-50%)",
            ...(labelOnRight
              ? {
                  left: labelEdge,
                  maxWidth: Math.min(
                    Math.max(layout.w - labelEdge - 12, 90),
                    Math.max(280, 360 * s),
                  ),
                }
              : {
                  right: layout.w - labelEdge,
                  maxWidth: Math.min(
                    Math.max(labelEdge - 12, 90),
                    Math.max(280, 360 * s),
                  ),
                }),
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            padding: `${Math.round(10 * s)}px ${Math.round(18 * s)}px`,
            borderRadius: 22,
            background: glassColor,
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow:
              "0 8px 32px rgba(40,25,15,0.12), inset 0 1px 0 rgba(255,255,255,0.6)",
            backdropFilter: `blur(${clamp(glassBlur, 0, 60)}px) saturate(1.6)`,
            WebkitBackdropFilter: `blur(${clamp(glassBlur, 0, 60)}px) saturate(1.6)`,
            pointerEvents: "none",
            color: textColor,
            zIndex: 6,
            ...ts(instructionFont, { size: Math.max(13, 15 * s), weight: 400 }),
          }}
        >
          <span>
            {showLast && (
              <strong
                style={{
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginRight: 8,
                }}
              >
                {lastShotLabel}
              </strong>
            )}
            {labelText}
          </span>
        </div>
      )}

      {/* Score / Shots Left Counter Pill */}
      <div
        style={{
          position: "absolute",
          left: "4.6%",
          bottom: "5%",
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          padding: `${Math.round(10 * s)}px ${Math.round(18 * s)}px`,
          borderRadius: 999,
          background: "rgba(255,255,255,0.72)",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
          color: textColor,
          zIndex: 6,
        }}
      >
        <span
          style={{
            ...ts(counterFont, { size: Math.max(14, 17 * s), weight: 600 }),
          }}
        >
          {pillText}
        </span>
        <span
          style={{
            ...ts(counterFont, {
              size: Math.max(10, 11 * s),
              weight: 400,
              letterSpacing: "0.16em",
            }),
            fontSize: labelSize,
            fontWeight: 500,
            textTransform: "uppercase",
            opacity: 0.75,
          }}
        >
          {pillLabel}
        </span>
      </div>

      {/* Screen Reader Announcer */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        {announce}
      </div>
    </div>
  );
}

export default Hoopshots404;
