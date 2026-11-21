import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  motion,
  AnimatePresence,
  animate,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";

/* ───────────────────────── Math & Geometry Helpers ───────────────────────── */
const RAD = Math.PI / 180;
const SWEEP: [number, number, number, number] = [0.65, 0, 0.35, 1];
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export interface VolvelleLeaf {
  id: string;
  repo: string;
  lens: string;
  title: string;
  subtitle: string;
  lang: string;
  entryFile: string;
  question: string;
  image?: string;
  imageUrl?: string;
  cardImageUrl?: string;
  link?: string;
}

export interface VolvelleDialConfig {
  top: number;
  reach: number;
  cardWidth: number;
  cardHeight: number;
  spacing: number;
  lift: number;
  corner: number;
}

export interface VolvelleTempoConfig {
  autoplay: boolean;
  every: number;
  spin: number;
  bloom: number;
}

export interface VolvelleFinishConfig {
  sideFade: number;
  dimSides: number;
  halo: boolean;
  parallax: boolean;
}

export interface VolvelleProps {
  leaves?: VolvelleLeaf[];
  dial?: Partial<VolvelleDialConfig>;
  tempo?: Partial<VolvelleTempoConfig>;
  finish?: Partial<VolvelleFinishConfig>;
  themeMode?: "light" | "dark";
  showScale?: boolean;
  showSteppers?: boolean;
  linkLabel?: string;
  edge?: number;
  onSelectRepo?: (repo: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

const rows = (t?: string) => (t || "").split("\n").filter((r) => r.length);
const two = (v: number) => String(v).padStart(2, "0");
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const fold = (deg: number, span: number) =>
  ((((deg + span / 2) % span) + span) % span) - span / 2;

const along = (theta: number, reach: number) => ({
  dx: reach * Math.sin(theta * RAD),
  dy: reach - reach * Math.cos(theta * RAD),
});

const dialShape = (d: VolvelleDialConfig, scaleFactor = 1, spacingOverride?: number) => {
  const w = Math.max(24, Math.round(d.cardWidth * scaleFactor));
  const h = Math.max(24, Math.round(d.cardHeight * scaleFactor));
  const reach = Math.max(120, Math.round(d.reach * scaleFactor));
  const step = Math.max(2, spacingOverride ?? d.spacing);
  const ringR = Math.max(20, reach - h / 2 - Math.round(22 * scaleFactor));
  return { w, h, reach, step, ringR };
};

const tickSet = (step: number) => {
  const fine = step / 4;
  const count = Math.min(900, Math.floor(360 / fine));
  return Array.from({ length: count }, (_, k) => ({
    deg: k * fine,
    major: k % 4 === 0,
  }));
};

const edgeFade = (t: number, span: number, step: number, n: number) =>
  n < 3 ? 1 : clamp01((span / 2 - Math.abs(t)) / (step * 0.9));

const sideShade = (t: number, step: number, dim: number) =>
  clamp01(Math.abs(t) / (step * 4)) * (dim / 100);

const drift = (t: number, step: number, w: number) =>
  Math.max(-w * 0.14, Math.min(w * 0.14, (-t / (step * 3)) * w * 0.14));

const sideMask = (fade: number) =>
  fade > 0
    ? `linear-gradient(90deg, transparent 0%, #000 ${fade}%, #000 ${100 - fade}%, transparent 100%)`
    : "none";

/* ───────── Self-Contained Labeled Codebase Diagrams (SVG Data URIs) ───────── */
function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

/**
 * Generates a self-contained 750x270 SVG diagram for each inspection lens.
 * Because the viewBox tightly frames the diagram (0 0 750 270) and is rendered
 * with `object-fit: contain` inside a dedicated responsive layout slot, it
 * scales crisply across desktop, tablet, and phone screens without ever
 * clipping nodes or colliding with the left-hand copy.
 */
function buildDiagramSvg(variant: number, isDark: boolean): string {
  const cardBg = isDark ? "#121217" : "#FAFAFA";
  const activeBg = isDark ? "#FFFFFF" : "#0A0A0A";
  const activeFg = isDark ? "#0A0A0A" : "#FFFFFF";
  const border = isDark ? "rgba(255,255,255,0.16)" : "#E2E2E2";
  const strongBorder = isDark ? "rgba(255,255,255,0.42)" : "#0A0A0A";
  const line = isDark ? "rgba(255,255,255,0.22)" : "#CCCCCC";
  const strongLine = isDark ? "rgba(255,255,255,0.55)" : "#111111";
  const textMain = isDark ? "#F4F4F5" : "#0A0A0A";
  const textMuted = isDark ? "#A1A1AA" : "#666666";
  const pillBg = isDark ? "rgba(255,255,255,0.08)" : "#F2F2F2";

  let diagram = "";

  if (variant === 0) {
    // 01: Blast Radius & Downstream Dependents (facebook/react)
    diagram = `
      <text x="20" y="22" fill="${textMuted}" font-family="monospace" font-size="11" letter-spacing="1.2">IMPACT TRACE // SHARED MODULE -&gt; DOWNSTREAM CALLERS</text>
      <line x1="20" y1="34" x2="730" y2="34" stroke="${border}" stroke-width="1"/>

      <!-- Connector edges -->
      <path d="M 220 150 C 270 150, 285 75, 340 75" fill="none" stroke="${strongLine}" stroke-width="1.6"/>
      <path d="M 220 150 C 275 150, 285 150, 340 150" fill="none" stroke="${strongLine}" stroke-width="1.6"/>
      <path d="M 220 150 C 270 150, 285 225, 340 225" fill="none" stroke="${strongLine}" stroke-width="1.6"/>
      <path d="M 550 75 C 580 75, 590 113, 615 113" fill="none" stroke="${line}" stroke-width="1.4" stroke-dasharray="4 4"/>
      <path d="M 550 150 C 580 150, 590 113, 615 113" fill="none" stroke="${line}" stroke-width="1.4" stroke-dasharray="4 4"/>

      <!-- Source Node (Edited File) -->
      <rect x="20" y="116" width="200" height="68" rx="10" fill="${activeBg}" stroke="${strongBorder}" stroke-width="1.5"/>
      <text x="36" y="140" fill="${activeFg}" opacity="0.7" font-family="monospace" font-size="10">EDITED MODULE · 1 HOP</text>
      <text x="36" y="161" fill="${activeFg}" font-family="monospace" font-weight="600" font-size="12.5">ReactFiberWorkLoop.js</text>
      <text x="36" y="176" fill="${activeFg}" opacity="0.65" font-family="monospace" font-size="10">lines 410-468 · scheduleUpdate</text>

      <!-- Downstream 1 -->
      <rect x="340" y="45" width="210" height="60" rx="9" fill="${cardBg}" stroke="${strongBorder}" stroke-width="1.2"/>
      <text x="356" y="68" fill="${textMuted}" font-family="monospace" font-size="10">IMPORTER · DIRECT</text>
      <text x="356" y="88" fill="${textMain}" font-family="monospace" font-weight="600" font-size="12">ReactFiberBeginWork.js:112</text>

      <!-- Downstream 2 -->
      <rect x="340" y="120" width="210" height="60" rx="9" fill="${cardBg}" stroke="${strongBorder}" stroke-width="1.2"/>
      <text x="356" y="143" fill="${textMuted}" font-family="monospace" font-size="10">IMPORTER · DIRECT</text>
      <text x="356" y="163" fill="${textMain}" font-family="monospace" font-weight="600" font-size="12">ReactFiberCommitWork.js:304</text>

      <!-- Downstream 3 -->
      <rect x="340" y="195" width="210" height="60" rx="9" fill="${cardBg}" stroke="${border}" stroke-width="1.2"/>
      <text x="356" y="218" fill="${textMuted}" font-family="monospace" font-size="10">IMPORTER · DIRECT</text>
      <text x="356" y="238" fill="${textMain}" font-family="monospace" font-weight="600" font-size="12">ReactFiberHooks.js:188</text>

      <!-- 2-Hop Node -->
      <rect x="615" y="85" width="120" height="56" rx="8" fill="${pillBg}" stroke="${border}" stroke-width="1"/>
      <text x="627" y="107" fill="${textMuted}" font-family="monospace" font-size="9.5">2 HOPS OUT</text>
      <text x="627" y="126" fill="${textMain}" font-family="monospace" font-weight="600" font-size="11">ReactDOMRoot.js</text>
    `;
  } else if (variant === 1) {
    // 02: End-to-End Request Execution Trace (fastapi/fastapi)
    diagram = `
      <text x="20" y="22" fill="${textMuted}" font-family="monospace" font-size="11" letter-spacing="1.2">CALL PATH // HTTP ENTRY -&gt; DEPENDENCY SOLVER -&gt; SERIALIZER</text>
      <line x1="20" y1="34" x2="730" y2="34" stroke="${border}" stroke-width="1"/>

      <!-- Step 1 -->
      <rect x="20" y="62" width="225" height="64" rx="10" fill="${activeBg}" stroke="${strongBorder}" stroke-width="1.5"/>
      <text x="36" y="85" fill="${activeFg}" opacity="0.7" font-family="monospace" font-size="10">01 · ROUTE ENTRY</text>
      <text x="36" y="106" fill="${activeFg}" font-family="monospace" font-weight="600" font-size="12.5">routing.py:218</text>
      <text x="228" y="85" fill="${activeFg}" opacity="0.75" font-family="monospace" font-size="10" text-anchor="end">APIRoute</text>

      <!-- Arrow 1 -> 2 -->
      <path d="M 245 94 L 315 94" fill="none" stroke="${strongLine}" stroke-width="1.6"/>
      <polygon points="315,90 323,94 315,98" fill="${strongLine}"/>

      <!-- Step 2 -->
      <rect x="325" y="62" width="235" height="64" rx="10" fill="${cardBg}" stroke="${strongBorder}" stroke-width="1.3"/>
      <text x="341" y="85" fill="${textMuted}" font-family="monospace" font-size="10">02 · INJECT DEPENDS()</text>
      <text x="341" y="106" fill="${textMain}" font-family="monospace" font-weight="600" font-size="12.5">dependencies/utils.py:540</text>

      <!-- Arrow 2 -> 3 -->
      <path d="M 442 126 L 442 162 L 245 162 L 245 190" fill="none" stroke="${strongLine}" stroke-width="1.5"/>
      <polygon points="241,188 245,196 249,188" fill="${strongLine}"/>

      <!-- Step 3 -->
      <rect x="130" y="196" width="230" height="64" rx="10" fill="${cardBg}" stroke="${strongBorder}" stroke-width="1.3"/>
      <text x="146" y="219" fill="${textMuted}" font-family="monospace" font-size="10">03 · VALIDATE &amp; ENCODE</text>
      <text x="146" y="240" fill="${textMain}" font-family="monospace" font-weight="600" font-size="12.5">encoders.py:142</text>

      <!-- Arrow 3 -> 4 -->
      <path d="M 360 228 L 430 228" fill="none" stroke="${strongLine}" stroke-width="1.6"/>
      <polygon points="430,224 438,228 430,232" fill="${strongLine}"/>

      <!-- Step 4 -->
      <rect x="440" y="196" width="230" height="64" rx="10" fill="${pillBg}" stroke="${border}" stroke-width="1.2"/>
      <text x="456" y="219" fill="${textMuted}" font-family="monospace" font-size="10">04 · ASGI RESPONSE</text>
      <text x="456" y="240" fill="${textMain}" font-family="monospace" font-weight="600" font-size="12.5">applications.py:1012</text>
    `;
  } else if (variant === 2) {
    // 03: Circular Dependency Cycle Detection (vercel/next.js)
    diagram = `
      <text x="20" y="22" fill="${textMuted}" font-family="monospace" font-size="11" letter-spacing="1.2">CYCLE DETECTOR // 3-MODULE MUTUAL IMPORT LOOP</text>
      <line x1="20" y1="34" x2="730" y2="34" stroke="${border}" stroke-width="1"/>

      <!-- Node A (Top) -->
      <rect x="255" y="52" width="240" height="60" rx="10" fill="${activeBg}" stroke="${strongBorder}" stroke-width="1.5"/>
      <text x="271" y="75" fill="${activeFg}" opacity="0.7" font-family="monospace" font-size="10">CYCLE NODE A · SERVER</text>
      <text x="271" y="95" fill="${activeFg}" font-family="monospace" font-weight="600" font-size="12">server/base-server.ts:94</text>

      <!-- Node B (Bottom Right) -->
      <rect x="415" y="192" width="250" height="60" rx="10" fill="${cardBg}" stroke="${strongBorder}" stroke-width="1.3"/>
      <text x="431" y="215" fill="${textMuted}" font-family="monospace" font-size="10">CYCLE NODE B · LOADER</text>
      <text x="431" y="235" fill="${textMain}" font-family="monospace" font-weight="600" font-size="12">server/load-components.ts:48</text>

      <!-- Node C (Bottom Left) -->
      <rect x="85" y="192" width="240" height="60" rx="10" fill="${cardBg}" stroke="${strongBorder}" stroke-width="1.3"/>
      <text x="101" y="215" fill="${textMuted}" font-family="monospace" font-size="10">CYCLE NODE C · RENDERER</text>
      <text x="101" y="235" fill="${textMain}" font-family="monospace" font-weight="600" font-size="12">server/render.tsx:215</text>

      <!-- Directed Cycle Arcs -->
      <path d="M 495 82 C 560 82, 560 152, 540 192" fill="none" stroke="${strongLine}" stroke-width="1.6"/>
      <path d="M 415 222 L 325 222" fill="none" stroke="${strongLine}" stroke-width="1.6"/>
      <path d="M 205 192 C 185 152, 190 82, 255 82" fill="none" stroke="${strongLine}" stroke-width="1.6" stroke-dasharray="4 4"/>

      <!-- Center Cycle Badge -->
      <rect x="307" y="138" width="136" height="28" rx="14" fill="${pillBg}" stroke="${strongBorder}" stroke-width="1"/>
      <text x="375" y="156" fill="${textMain}" font-family="monospace" font-weight="600" font-size="10.5" text-anchor="middle">↺ 3-FILE LOOP</text>
    `;
  } else if (variant === 3) {
    // 04: Codebase Q&A with Exact Line Citations (tailwindlabs/tailwindcss)
    diagram = `
      <text x="20" y="22" fill="${textMuted}" font-family="monospace" font-size="11" letter-spacing="1.2">VERIFIED Q&amp;A // NATURAL LANGUAGE QUERY -&gt; CITED SOURCE LINES</text>
      <line x1="20" y1="34" x2="730" y2="34" stroke="${border}" stroke-width="1"/>

      <!-- Question Box -->
      <rect x="20" y="54" width="690" height="46" rx="10" fill="${pillBg}" stroke="${border}" stroke-width="1.2"/>
      <text x="40" y="82" fill="${textMain}" font-family="sans-serif" font-weight="500" font-size="13.5">"Where are utility class candidates scanned and turned into AST rules?"</text>

      <!-- Citation Branch Lines -->
      <path d="M 185 100 L 185 142" fill="none" stroke="${strongLine}" stroke-width="1.5"/>
      <path d="M 545 100 L 545 142" fill="none" stroke="${strongLine}" stroke-width="1.5"/>

      <!-- Cited File 1 -->
      <rect x="20" y="142" width="335" height="108" rx="10" fill="${activeBg}" stroke="${strongBorder}" stroke-width="1.5"/>
      <text x="38" y="166" fill="${activeFg}" opacity="0.7" font-family="monospace" font-size="10">CITATION 01 · RUST SCANNER</text>
      <text x="38" y="187" fill="${activeFg}" font-family="monospace" font-weight="600" font-size="12.5">crates/oxide/src/scanner.rs:128</text>
      <text x="38" y="210" fill="${activeFg}" opacity="0.82" font-family="monospace" font-size="11">pub fn scan_files(&amp;mut self) -&gt; Vec&lt;Candidate&gt;</text>
      <text x="38" y="230" fill="${activeFg}" opacity="0.6" font-family="monospace" font-size="10">Extracts raw tokens from template streams</text>

      <!-- Cited File 2 -->
      <rect x="375" y="142" width="335" height="108" rx="10" fill="${cardBg}" stroke="${strongBorder}" stroke-width="1.3"/>
      <text x="393" y="166" fill="${textMuted}" font-family="monospace" font-size="10">CITATION 02 · RULE COMPILER</text>
      <text x="393" y="187" fill="${textMain}" font-family="monospace" font-weight="600" font-size="12.5">packages/tailwindcss/src/compile.ts:310</text>
      <text x="393" y="210" fill="${textMain}" font-family="monospace" font-size="11">export function compileCandidates(raw)</text>
      <text x="393" y="230" fill="${textMuted}" font-family="monospace" font-size="10">Builds CSS declarations from matched utilities</text>
    `;
  } else if (variant === 4) {
    // 05: Architecture Onboarding Map (denoland/deno)
    diagram = `
      <text x="20" y="22" fill="${textMuted}" font-family="monospace" font-size="11" letter-spacing="1.2">ONBOARDING DOSSIER // ENTRY POINTS &amp; LAYER BOUNDARIES</text>
      <line x1="20" y1="34" x2="730" y2="34" stroke="${border}" stroke-width="1"/>

      <!-- Layer 1: CLI Entry -->
      <rect x="20" y="60" width="200" height="180" rx="10" fill="${activeBg}" stroke="${strongBorder}" stroke-width="1.5"/>
      <text x="38" y="86" fill="${activeFg}" opacity="0.7" font-family="monospace" font-size="10">LAYER 01 · CLI ENTRY</text>
      <text x="38" y="110" fill="${activeFg}" font-family="monospace" font-weight="600" font-size="13">cli/main.rs:1</text>
      <text x="38" y="136" fill="${activeFg}" opacity="0.75" font-family="monospace" font-size="10.5">Flags &amp; subcommands</text>
      <text x="38" y="154" fill="${activeFg}" opacity="0.75" font-family="monospace" font-size="10.5">cli/factory.rs:88</text>
      <text x="38" y="216" fill="${activeFg}" opacity="0.6" font-family="monospace" font-size="10">Primary binary root</text>

      <!-- Arrow 1 -> 2 -->
      <path d="M 220 150 L 265 150" fill="none" stroke="${strongLine}" stroke-width="1.6"/>
      <polygon points="265,146 273,150 265,154" fill="${strongLine}"/>

      <!-- Layer 2: Worker Runtime -->
      <rect x="275" y="60" width="205" height="180" rx="10" fill="${cardBg}" stroke="${strongBorder}" stroke-width="1.3"/>
      <text x="293" y="86" fill="${textMuted}" font-family="monospace" font-size="10">LAYER 02 · WORKER</text>
      <text x="293" y="110" fill="${textMain}" font-family="monospace" font-weight="600" font-size="13">runtime/worker.rs:84</text>
      <text x="293" y="136" fill="${textMuted}" font-family="monospace" font-size="10.5">MainWorker bootstrap</text>
      <text x="293" y="154" fill="${textMuted}" font-family="monospace" font-size="10.5">permissions/lib.rs:42</text>
      <text x="293" y="216" fill="${textMuted}" font-family="monospace" font-size="10">Sandboxed execution</text>

      <!-- Arrow 2 -> 3 -->
      <path d="M 480 150 L 520 150" fill="none" stroke="${strongLine}" stroke-width="1.6"/>
      <polygon points="520,146 528,150 520,154" fill="${strongLine}"/>

      <!-- Layer 3: V8 Op Bridge -->
      <rect x="530" y="60" width="200" height="180" rx="10" fill="${cardBg}" stroke="${border}" stroke-width="1.2"/>
      <text x="548" y="86" fill="${textMuted}" font-family="monospace" font-size="10">LAYER 03 · NATIVE OPS</text>
      <text x="548" y="110" fill="${textMain}" font-family="monospace" font-weight="600" font-size="13">ext/net/ops.rs:42</text>
      <text x="548" y="136" fill="${textMuted}" font-family="monospace" font-size="10.5">#[op2(async)] bindings</text>
      <text x="548" y="154" fill="${textMuted}" font-family="monospace" font-size="10.5">ext/fetch/lib.rs:119</text>
      <text x="548" y="216" fill="${textMuted}" font-family="monospace" font-size="10">Rust &lt;-&gt; V8 FFI boundary</text>
    `;
  } else {
    // 06: Commit Drift & Coupling Diff (vitejs/vite)
    diagram = `
      <text x="20" y="22" fill="${textMuted}" font-family="monospace" font-size="11" letter-spacing="1.2">ARCHITECTURAL DRIFT // MODULE COUPLING DELTA ACROSS COMMITS</text>
      <line x1="20" y1="34" x2="730" y2="34" stroke="${border}" stroke-width="1"/>

      <!-- Modified Core File -->
      <rect x="20" y="118" width="245" height="68" rx="10" fill="${activeBg}" stroke="${strongBorder}" stroke-width="1.5"/>
      <text x="38" y="142" fill="${activeFg}" opacity="0.7" font-family="monospace" font-size="10">MODIFIED IN HEAD~1</text>
      <text x="38" y="164" fill="${activeFg}" font-family="monospace" font-weight="600" font-size="12.5">node/server/index.ts:312</text>

      <!-- Existing Stable Edge -->
      <path d="M 265 138 C 335 138, 355 82, 430 82" fill="none" stroke="${line}" stroke-width="1.4"/>
      <rect x="430" y="52" width="280" height="60" rx="9" fill="${cardBg}" stroke="${border}" stroke-width="1.2"/>
      <text x="448" y="75" fill="${textMuted}" font-family="monospace" font-size="10">UNCHANGED DEPENDENCY</text>
      <text x="448" y="95" fill="${textMain}" font-family="monospace" font-weight="600" font-size="12">node/server/hmr.ts:88</text>

      <!-- Newly Added Cross-Module Edge -->
      <path d="M 265 166 C 335 166, 355 212, 430 212" fill="none" stroke="${strongLine}" stroke-width="1.8" stroke-dasharray="5 4"/>
      <rect x="430" y="180" width="280" height="64" rx="9" fill="${cardBg}" stroke="${strongBorder}" stroke-width="1.5"/>
      <text x="448" y="203" fill="${textMain}" font-family="monospace" font-weight="600" font-size="10">+ NEW CROSS-FOLDER IMPORT</text>
      <text x="448" y="225" fill="${textMain}" font-family="monospace" font-weight="600" font-size="12">node/ssr/ssrModuleLoader.ts:76</text>
    `;
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 270" width="750" height="270">
  ${diagram}
</svg>`;
}

function buildSpokeCardSvg(
  variant: number,
  lens: string,
  repo: string,
): string {
  const miniGraphs = [
    // 01 Blast radius fan-out
    `<circle cx="72" cy="145" r="7" fill="#fff"/><path d="M79 145 L148 112 M79 145 L156 145 M79 145 L148 178" stroke="rgba(255,255,255,0.65)" stroke-width="1.6"/><circle cx="148" cy="112" r="5" fill="#111" stroke="#fff" stroke-width="1.8"/><circle cx="156" cy="145" r="5" fill="#111" stroke="#fff" stroke-width="1.8"/><circle cx="148" cy="178" r="5" fill="#111" stroke="#fff" stroke-width="1.8"/>`,
    // 02 Request flow chain
    `<rect x="46" y="132" width="36" height="24" rx="5" fill="#fff"/><path d="M82 144 L102 144 M138 144 L158 144" stroke="rgba(255,255,255,0.75)" stroke-width="1.6"/><rect x="102" y="132" width="36" height="24" rx="5" fill="none" stroke="#fff" stroke-width="1.6"/><rect x="158" y="132" width="36" height="24" rx="5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/>`,
    // 03 Circular import triangle
    `<path d="M120 105 L164 172 L76 172 Z" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.6" stroke-dasharray="4 3"/><circle cx="120" cy="105" r="6" fill="#fff"/><circle cx="164" cy="172" r="5.5" fill="#111" stroke="#fff" stroke-width="1.8"/><circle cx="76" cy="172" r="5.5" fill="#111" stroke="#fff" stroke-width="1.8"/>`,
    // 04 Cited Q&A lines
    `<rect x="54" y="108" width="132" height="22" rx="5" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.45)"/><path d="M90 130 L90 152 M150 130 L150 152" stroke="#fff" stroke-width="1.5"/><rect x="54" y="152" width="62" height="32" rx="5" fill="#fff"/><rect x="124" y="152" width="62" height="32" rx="5" fill="none" stroke="#fff" stroke-width="1.5"/>`,
    // 05 Onboarding layers
    `<rect x="52" y="114" width="38" height="62" rx="5" fill="#fff"/><rect x="101" y="114" width="38" height="62" rx="5" fill="none" stroke="#fff" stroke-width="1.5"/><rect x="150" y="114" width="38" height="62" rx="5" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>`,
    // 06 Commit drift delta
    `<circle cx="72" cy="145" r="6" fill="#fff"/><path d="M78 145 L154 120" stroke="rgba(255,255,255,0.35)" stroke-width="1.4"/><path d="M78 145 L154 170" stroke="#fff" stroke-width="1.8" stroke-dasharray="4 3"/><circle cx="154" cy="120" r="4.5" fill="rgba(255,255,255,0.45)"/><circle cx="154" cy="170" r="6" fill="#fff"/>`,
  ];

  return svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" width="240" height="320">
  <rect width="240" height="320" fill="#0C0C0F"/>
  <rect x="26" y="12" width="188" height="296" rx="10" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>
  ${miniGraphs[variant % miniGraphs.length]}
  <text x="120" y="236" fill="rgba(255,255,255,0.56)" font-family="monospace" font-size="9.5" text-anchor="middle" letter-spacing="0.5">${repo}</text>
  <text x="120" y="258" fill="#FFFFFF" font-family="sans-serif" font-weight="600" font-size="14" text-anchor="middle" letter-spacing="-0.2">${lens}</text>
</svg>`);
}

export const DEFAULT_VOLVELLE_LEAVES: VolvelleLeaf[] = [
  {
    id: "blast-radius",
    repo: "facebook/react",
    lens: "Blast Radius",
    title: "Check what breaks\nbefore you edit",
    subtitle:
      "Select any shared module to highlight every file that imports it directly or two hops downstream.",
    lang: "JavaScript · Flow",
    entryFile: "ReactFiberWorkLoop.js:410",
    question: "Which reconciler modules break if scheduleUpdateOnFiber changes?",
    link: "/dashboard?repo=facebook/react",
  },
  {
    id: "request-flow",
    repo: "fastapi/fastapi",
    lens: "Request Flow",
    title: "Trace a route\nend to end",
    subtitle:
      "Follow an HTTP request from the route decorator through dependency injection down to the response serializer.",
    lang: "Python",
    entryFile: "fastapi/routing.py:218",
    question: "How does APIRoute resolve nested Depends() before calling the endpoint?",
    link: "/dashboard?repo=fastapi/fastapi",
  },
  {
    id: "circular-imports",
    repo: "vercel/next.js",
    lens: "Circular Imports",
    title: "Catch import loops\nbefore they ship",
    subtitle:
      "Spot files that import each other in a cycle so you can untangle coupled modules before bundling.",
    lang: "TypeScript · Rust",
    entryFile: "server/base-server.ts:94",
    question: "Where do server rendering modules form a mutual import loop?",
    link: "/dashboard?repo=vercel/next.js",
  },
  {
    id: "cited-qa",
    repo: "tailwindlabs/tailwindcss",
    lens: "Line Citations",
    title: "Ask in plain English,\nget exact lines",
    subtitle:
      "Ask how a feature works and jump straight to the file path and line numbers that implement it.",
    lang: "TypeScript · Rust",
    entryFile: "crates/oxide/src/scanner.rs:128",
    question: "Where are utility class candidates scanned and compiled into CSS rules?",
    link: "/dashboard?repo=tailwindlabs/tailwindcss",
  },
  {
    id: "onboarding-map",
    repo: "denoland/deno",
    lens: "Onboarding Map",
    title: "Learn an unfamiliar\nrepo on day one",
    subtitle:
      "Read an auto-generated breakdown of the binary entry points, core folders, and runtime boundaries.",
    lang: "Rust · TypeScript",
    entryFile: "cli/main.rs:1",
    question: "How does the CLI bootstrap MainWorker and bind native Rust ops into V8?",
    link: "/dashboard?repo=denoland/deno",
  },
  {
    id: "commit-drift",
    repo: "vitejs/vite",
    lens: "Commit Drift",
    title: "See how recent commits\nshifted the graph",
    subtitle:
      "Compare module imports across recent commits to see where new cross-folder dependencies were added.",
    lang: "TypeScript",
    entryFile: "node/server/index.ts:312",
    question: "Which recent commits added new imports between the dev server and SSR loader?",
    link: "/dashboard?repo=vitejs/vite",
  },
];

/* ───────────────────────── Live Hooks ───────────────────────── */
function useSeen(ref: React.RefObject<HTMLElement | null>) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setSeen(Boolean(entry && entry.isIntersecting)),
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return seen;
}

function usePageShown() {
  const [shown, setShown] = useState(
    typeof document === "undefined" ? true : document.visibilityState !== "hidden",
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const on = () => setShown(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return shown;
}

function usePrefersStill() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setStill(q.matches);
    on();
    q.addEventListener?.("change", on);
    return () => q.removeEventListener?.("change", on);
  }, []);
  return still;
}

function useMeasure(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 1120, h: 610 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const take = () => {
      const w = el.clientWidth || 1120;
      const h = el.clientHeight || 610;
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    take();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(take);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/* ───────────────────────── Spoke Card on the Rotary Dial ───────────────────────── */
interface SpokeProps {
  turn: MotionValue<number>;
  index: number;
  total: number;
  step: number;
  reach: number;
  w: number;
  h: number;
  top: number;
  lift: number;
  corner: number;
  chosen: boolean;
  awake: boolean;
  still: boolean;
  leaf: VolvelleLeaf;
  cardSrc: string;
  finish: VolvelleFinishConfig;
  labelStyle: React.CSSProperties;
  linkLabel: string;
  onPick: () => void;
}

function Spoke(props: SpokeProps) {
  const {
    turn,
    index,
    total,
    step,
    reach,
    w,
    h,
    top,
    lift,
    corner,
    chosen,
    finish,
    cardSrc,
  } = props;
  const span = total * step;
  const theta = useTransform(turn, (v) => fold(index * step + v, span));
  const x = useTransform(theta, (t) => along(t, reach).dx - w / 2);
  const y = useTransform(theta, (t) => along(t, reach).dy - h / 2);
  const fade = useTransform(theta, (t) => edgeFade(t, span, step, total));
  const shade = useTransform(theta, (t) => sideShade(t, step, finish.dimSides));
  const shift = useTransform(theta, (t) => (finish.parallax ? drift(t, step, w) : 0));
  const [over, setOver] = useState(false);
  const hasLink = Boolean(props.leaf.link || props.leaf.repo);

  return (
    <motion.div
      style={{
        position: "absolute",
        left: "50%",
        top: `${top}%`,
        width: w,
        height: h,
        x,
        y,
        rotate: theta,
        opacity: fade,
        zIndex: chosen ? 3 : 1,
        pointerEvents: "auto",
      }}
    >
      {finish.halo && cardSrc && (
        <motion.img
          src={cardSrc}
          alt=""
          draggable={false}
          initial={false}
          animate={{
            opacity: chosen ? 0.28 : 0,
            scale: chosen ? lift * 1.05 : 0.9,
          }}
          transition={{ duration: props.still ? 0 : 0.9, ease: EASE_OUT }}
          style={{
            position: "absolute",
            inset: "6%",
            width: "88%",
            height: "88%",
            objectFit: "cover",
            filter: "blur(22px)",
            pointerEvents: "none",
            y: 14,
          }}
        />
      )}

      <motion.button
        type="button"
        aria-label={`${props.leaf.lens}: ${props.leaf.repo}`}
        aria-current={chosen ? "true" : undefined}
        onClick={props.onPick}
        onMouseEnter={() => setOver(true)}
        onMouseLeave={() => setOver(false)}
        initial={false}
        animate={{
          scale: chosen ? lift : over && !props.still ? 1.06 : 1,
          opacity: props.awake ? 1 : 0,
          y: props.awake ? (over && !chosen && !props.still ? -8 : 0) : 56,
        }}
        transition={
          props.still
            ? { duration: 0 }
            : {
                scale: { type: "spring", stiffness: 210, damping: 26, mass: 0.9 },
                opacity: { duration: 0.8, ease: EASE_OUT },
                y: { type: "spring", stiffness: 160, damping: 22 },
              }
        }
        style={{
          position: "absolute",
          inset: 0,
          padding: 0,
          border: "none",
          borderRadius: corner,
          overflow: "hidden",
          cursor: "pointer",
          background: "#0C0C0F",
          boxShadow: chosen
            ? "0 26px 60px -18px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(255,255,255,0.28)"
            : "0 12px 30px -14px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.12)",
          transition: "box-shadow 0.5s ease",
        }}
      >
        {cardSrc && (
          <motion.img
            src={cardSrc}
            alt=""
            draggable={false}
            decoding="async"
            width={240}
            height={320}
            style={{
              position: "absolute",
              top: 0,
              left: "-15%",
              width: "130%",
              height: "100%",
              objectFit: "cover",
              pointerEvents: "none",
              x: shift,
            }}
          />
        )}

        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            background: "#000",
            opacity: shade,
            pointerEvents: "none",
          }}
        />

        <motion.div
          initial={false}
          animate={{ opacity: chosen ? 0 : over ? 1 : 0.85 }}
          transition={{ duration: 0.3 }}
          style={{
            ...props.labelStyle,
            color: "#FFFFFF",
            fontSize: w < 85 ? 9 : 10,
            position: "absolute",
            top: 7,
            left: 8,
            textShadow: "0 1px 8px rgba(0,0,0,0.65)",
          }}
        >
          {two(index + 1)}
        </motion.div>

        {hasLink && (
          <motion.div
            initial={false}
            animate={{ opacity: chosen ? 1 : 0, y: chosen ? 0 : 10 }}
            transition={{
              duration: props.still ? 0 : 0.45,
              ease: EASE_OUT,
              delay: chosen ? 0.25 : 0,
            }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: w < 85 ? "14px 4px 6px" : "18px 8px 8px",
              background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.88))",
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                ...props.labelStyle,
                color: "#FFFFFF",
                fontSize: w < 85 ? 7.5 : 9,
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              {props.linkLabel}
            </span>
          </motion.div>
        )}
      </motion.button>
    </motion.div>
  );
}

/* ───────────────────────── Main Volvelle Component ───────────────────────── */
export function Volvelle(props: VolvelleProps) {
  const navigate = useNavigate();
  const leaves = useMemo(
    () => (props.leaves && props.leaves.length > 0 ? props.leaves : DEFAULT_VOLVELLE_LEAVES),
    [props.leaves],
  );
  const n = leaves.length;

  const isDark = props.themeMode === "dark";

  const hostRef = useRef<HTMLDivElement>(null);
  const size = useMeasure(hostRef);
  const seen = useSeen(hostRef);
  const shown = usePageShown();
  const still = usePrefersStill();

  // Continuous 3-tier responsive layout registers: Phone (<560), Tablet (560..919), Desktop (>=920)
  const isPhone = size.w < 560;
  const isTablet = size.w >= 560 && size.w < 920;
  const isDesktop = size.w >= 920;

  const stageHeight = isPhone ? 550 : isTablet ? 640 : 610;
  const responsiveEdge = props.edge ?? 0;

  // Fluid scale factor for the wheel & cards across any viewport width
  const scaleFactor = isPhone
    ? clamp(size.w / 620, 0.56, 0.72)
    : isTablet
      ? clamp(size.w / 960, 0.76, 0.88)
      : clamp(size.w / 1240, 0.92, 1.04);

  const dialConfig: VolvelleDialConfig = {
    top: isPhone ? 76 : isTablet ? 75 : 71,
    reach: 540,
    cardWidth: 116,
    cardHeight: 156,
    spacing: isPhone ? 20 : 18,
    lift: isPhone ? 1.24 : 1.3,
    corner: isPhone ? 10 : 12,
    ...props.dial,
  };

  const tempoConfig: VolvelleTempoConfig = {
    autoplay: true,
    every: 3.2,
    spin: 1.1,
    bloom: 1.15,
    ...props.tempo,
  };

  const finishConfig: VolvelleFinishConfig = {
    sideFade: isPhone ? 6 : 10,
    dimSides: 45,
    halo: true,
    parallax: true,
    ...props.finish,
  };

  const ink = isDark ? "#FFFFFF" : "#0A0A0A";
  const mutedInk = isDark ? "#A1A1AA" : "#525252";
  const borderLine = isDark ? "rgba(255,255,255,0.14)" : "#E5E5E5";
  const ground = isDark ? "var(--mf-bg, #0A0A0A)" : "var(--mf-base, #FFFFFF)";
  const scaleColor = isDark ? "rgba(255,255,255,0.28)" : "rgba(10,10,10,0.24)";
  const showScale = props.showScale ?? true;
  const showSteppers = props.showSteppers ?? true;
  const linkLabel = props.linkLabel || "Open in Studio";

  const { w, h, reach, step, ringR } = dialShape(dialConfig, scaleFactor);
  const span = Math.max(1, n) * step;

  const diagramArts = useMemo(
    () =>
      leaves.map((lf, i) =>
        lf.image || lf.imageUrl || svgToDataUri(buildDiagramSvg(i, isDark)),
      ),
    [leaves, isDark],
  );

  const cardArts = useMemo(
    () =>
      leaves.map((lf, i) =>
        lf.cardImageUrl || buildSpokeCardSvg(i, lf.lens, lf.repo),
      ),
    [leaves],
  );

  const turn = useMotionValue(0);
  const [pick, setPick] = useState(0);
  const pickRef = useRef(0);
  const [pours, setPours] = useState<Array<{ id: number; at: number; live: boolean }>>([
    { id: 0, at: 0, live: false },
  ]);
  const pourSeq = useRef(1);
  const [resting, setResting] = useState(false);
  const grab = useRef<{
    x: number;
    base: number;
    pulling: boolean;
    id: number;
    lastX: number;
    lastT: number;
    v: number;
  } | null>(null);
  const dragged = useRef(false);
  const wheelAt = useRef(0);

  const a = n ? ((pick % n) + n) % n : 0;
  const degPerPx = step / (w + 34);

  const nearestTurn = (idx: number) => {
    const goal = -idx * step;
    const k = Math.round((turn.get() - goal) / span);
    return goal + k * span;
  };

  const glideTo = (idx: number, soft = false) => {
    const target = nearestTurn(idx);
    if (still) {
      turn.set(target);
    } else if (soft) {
      animate(turn, target, { type: "spring", stiffness: 90, damping: 20, mass: 1 });
    } else {
      animate(turn, target, { duration: Math.max(0.2, tempoConfig.spin), ease: SWEEP });
    }
  };

  const choose = (target: number, soft = false) => {
    if (!n) return;
    const next = ((target % n) + n) % n;
    if (next === pickRef.current) {
      glideTo(next, soft);
      return;
    }
    pickRef.current = next;
    setPick(next);
    glideTo(next, soft);
    setPours((s) => [...s.slice(-2), { id: pourSeq.current++, at: next, live: true }]);
  };

  const ticking =
    tempoConfig.autoplay && seen && shown && !still && !resting && n > 1;
  const every = Math.max(1.5, tempoConfig.every);

  useEffect(() => {
    if (!ticking) return;
    const t = window.setTimeout(() => choose(pickRef.current + 1), every * 1000);
    return () => window.clearTimeout(t);
  }, [ticking, every, pick]);

  const handleOpenRepo = (lf: VolvelleLeaf) => {
    if (props.onSelectRepo) {
      props.onSelectRepo(lf.repo);
      return;
    }
    navigate({ to: "/dashboard", search: { repo: lf.repo } });
  };

  if (!n) {
    return <div style={{ width: "100%", height: "100%", background: ground }} />;
  }

  const leaf = leaves[a];
  const ox = size.w / 2;
  const oy = (stageHeight * dialConfig.top) / 100;
  const far = Math.hypot(Math.max(ox, size.w - ox), Math.max(oy, stageHeight - oy)) + 6;
  const lift = Math.max(1, dialConfig.lift);
  const seed = (Math.min(w, h) * lift) / 2;
  const spinT = Math.max(0.2, tempoConfig.spin);
  const bloomT = Math.max(0.2, tempoConfig.bloom);
  const bloomDelay = spinT * 0.45;

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--mf-mono, 'IBM Plex Mono', 'JetBrains Mono', monospace)",
    fontSize: isPhone ? 10 : 11,
    letterSpacing: "0.06em",
    lineHeight: "1.2em",
    color: ink,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  const titleFontSize = isPhone
    ? "clamp(1.45rem, 5.8vw, 1.85rem)"
    : isTablet
      ? "clamp(1.75rem, 3.6vw, 2.3rem)"
      : "clamp(2rem, 3.2vw, 3.05rem)";

  const ticks = showScale ? tickSet(step) : [];
  const notchTop = `calc(${dialConfig.top}% + ${reach - ringR}px)`;

  // Responsive slot for the architectural diagram inside each iris-bloom layer (borderless)
  const diagramSlotStyle: React.CSSProperties = isDesktop
    ? {
        position: "absolute",
        left: "44%",
        right: responsiveEdge,
        top: 0,
        height: "48%",
        paddingLeft: 0,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        pointerEvents: "none",
      }
    : isTablet
      ? {
          position: "absolute",
          left: responsiveEdge,
          right: responsiveEdge,
          top: 205,
          height: 158,
          paddingTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }
      : {
          position: "absolute",
          left: responsiveEdge,
          right: responsiveEdge,
          top: 192,
          height: 122,
          paddingTop: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        };

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={`Interactive Codebase Inspection Dial: ${leaf.lens} on ${leaf.repo}`}
      className={props.className}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") choose(pickRef.current + 1);
        if (e.key === "ArrowLeft") choose(pickRef.current - 1);
      }}
      onWheel={(e) => {
        if (Math.abs(e.deltaX) < 8 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
        const now = Date.now();
        if (now - wheelAt.current < 520) return;
        wheelAt.current = now;
        choose(pickRef.current + (e.deltaX > 0 ? 1 : -1));
      }}
      onPointerDown={(e) => {
        const now = performance.now();
        setResting(true);
        grab.current = {
          x: e.clientX,
          base: turn.get(),
          pulling: false,
          id: e.pointerId,
          lastX: e.clientX,
          lastT: now,
          v: 0,
        };
        dragged.current = false;
        turn.stop();
      }}
      onPointerMove={(e) => {
        const g = grab.current;
        if (!g) return;
        const dx = e.clientX - g.x;
        if (!g.pulling && Math.abs(dx) > 6) {
          g.pulling = true;
          dragged.current = true;
          try {
            hostRef.current?.setPointerCapture(g.id);
          } catch {
            // ignore
          }
        }
        if (!g.pulling) return;
        const now = performance.now();
        const dt = Math.max(1, now - g.lastT);
        g.v = g.v * 0.6 + ((e.clientX - g.lastX) / dt) * 0.4;
        g.lastX = e.clientX;
        g.lastT = now;
        turn.set(g.base + dx * degPerPx);
      }}
      onPointerUp={() => {
        const g = grab.current;
        grab.current = null;
        setResting(false);
        if (!g || !g.pulling) return;
        const thrown = turn.get() + g.v * 220 * degPerPx;
        choose(Math.round(-thrown / step), true);
        window.setTimeout(() => {
          dragged.current = false;
        }, 0);
      }}
      onPointerCancel={() => {
        grab.current = null;
        setResting(false);
        glideTo(pickRef.current, true);
      }}
      style={{
        position: "relative",
        width: "100%",
        height: stageHeight,
        overflow: "hidden",
        background: "transparent",
        borderRadius: 0,
        border: "none",
        boxShadow: "none",
        outline: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "pan-y",
        cursor: "grab",
        transition: "height 0.25s ease",
        ...props.style,
      }}
    >
      {/* 1. Circular Iris Bloom Layers with Responsive Labeled Architectural Diagrams */}
      {pours.map((po) => {
        const idx = ((po.at % n) + n) % n;
        const src = diagramArts[idx];
        const play = po.live && !still;
        return (
          <motion.div
            key={po.id}
            initial={play ? { clipPath: `circle(${seed}px at ${ox}px ${oy}px)` } : false}
            animate={{
              clipPath: play ? `circle(${far}px at ${ox}px ${oy}px)` : "none",
            }}
            transition={
              play
                ? { duration: bloomT, ease: SWEEP, delay: bloomDelay }
                : { duration: 0 }
            }
            onAnimationComplete={() => {
              if (!po.live) return;
              setPours((s) =>
                s[s.length - 1]?.id === po.id ? [{ ...po, live: false }] : s,
              );
            }}
            style={{ position: "absolute", inset: 0, overflow: "hidden" }}
          >
            <div style={{ position: "absolute", inset: 0, background: ground }} />
            {src && (
              <div style={diagramSlotStyle}>
                <motion.img
                  src={src}
                  alt=""
                  draggable={false}
                  decoding="async"
                  width={750}
                  height={270}
                  initial={
                    play ? { scale: 1.08, filter: "blur(5px)", opacity: 0.4 } : false
                  }
                  animate={{ scale: 1, filter: "blur(0px)", opacity: 1 }}
                  transition={{
                    duration: bloomT * 1.15,
                    ease: EASE_OUT,
                    delay: bloomDelay,
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    objectPosition: isDesktop ? "right top" : "center center",
                    pointerEvents: "none",
                  }}
                />
              </div>
            )}
          </motion.div>
        );
      })}

      {/* 2. Expanding SVG Shockwave Ring */}
      <svg
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        {!still &&
          pours
            .filter((po) => po.live)
            .map((po) => (
              <motion.circle
                key={`rim${po.id}`}
                cx={ox}
                cy={oy}
                fill="none"
                stroke={ink}
                initial={{ r: seed, opacity: 0, strokeWidth: 1.5 }}
                animate={{ r: far, opacity: [0, 0.35, 0], strokeWidth: 0.6 }}
                transition={{ duration: bloomT, ease: SWEEP, delay: bloomDelay }}
              />
            ))}
      </svg>

      {/* 3. Top Header: Inspection Lens + Repo Context + Cited Entry File */}
      <div
        style={{
          position: "absolute",
          left: responsiveEdge,
          right: isDesktop ? "57%" : responsiveEdge,
          top: responsiveEdge,
          zIndex: 5,
          pointerEvents: "none",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: isPhone ? 6 : 10,
              marginBottom: isPhone ? 8 : 12,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                ...labelStyle,
                padding: isPhone ? "3px 8px" : "4px 10px",
                borderRadius: 6,
                border: isDark
                  ? "1px solid rgba(255,255,255,0.2)"
                  : "1px solid var(--mf-ink, #0a0a0a)",
                background: isDark ? "rgba(255,255,255,0.08)" : "#0A0A0A",
                color: "#FFFFFF",
                fontWeight: 600,
              }}
            >
              {two(a + 1)} / {two(n)} · {leaf.lens}
            </span>
            <span
              style={{
                ...labelStyle,
                color: mutedInk,
                textTransform: "none",
                letterSpacing: "0.01em",
              }}
            >
              Repo: <strong style={{ color: ink }}>{leaf.repo}</strong>
            </span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`t${a}`}>
              <h3
                style={{
                  fontFamily: "var(--mf-font, 'Geist', sans-serif)",
                  fontSize: titleFontSize,
                  fontWeight: 500,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.02,
                  color: ink,
                  margin: 0,
                }}
              >
                {rows(leaf.title).map((r, ri) => (
                  <span
                    key={ri}
                    style={{
                      display: "block",
                      overflow: "hidden",
                      padding: "0 0.04em 0.06em 0",
                    }}
                  >
                    {Array.from(r).map((ch, ci) => (
                      <motion.span
                        key={ci}
                        initial={
                          still
                            ? false
                            : { y: "105%", opacity: 0, filter: "blur(6px)" }
                        }
                        animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                        exit={
                          still
                            ? { opacity: 0 }
                            : { y: "-60%", opacity: 0, filter: "blur(4px)" }
                        }
                        transition={{
                          duration: still ? 0 : 0.55,
                          ease: EASE_OUT,
                          delay: still
                            ? 0
                            : bloomDelay * 0.45 + ri * 0.07 + ci * 0.016,
                        }}
                        style={{
                          display: "inline-block",
                          whiteSpace: "pre",
                          color:
                            ri === 0
                              ? isDark
                                ? "#A1A1AA"
                                : "var(--mf-ink-3, #737373)"
                              : ink,
                        }}
                      >
                        {ch}
                      </motion.span>
                    ))}
                  </span>
                ))}
              </h3>

              {/* On Desktop: subtitle & cited source stack below title. On Tablet/Phone: flex row to keep header compact above the diagram */}
              <div
                style={{
                  display: "flex",
                  flexDirection: isDesktop ? "column" : "row",
                  alignItems: isDesktop ? "flex-start" : "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: isPhone ? 6 : 10,
                  marginTop: isPhone ? 6 : 10,
                }}
              >
                <motion.p
                  initial={still ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, delay: bloomDelay * 0.55 }}
                  style={{
                    margin: 0,
                    fontSize: isPhone ? "0.8125rem" : "0.9rem",
                    color: mutedInk,
                    maxWidth: isDesktop ? 430 : 480,
                    lineHeight: isPhone ? 1.38 : 1.48,
                  }}
                >
                  {leaf.subtitle}
                </motion.p>

                <motion.div
                  initial={still ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, delay: bloomDelay * 0.65 }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: isPhone ? "4px 9px" : "5px 11px",
                    borderRadius: 8,
                    border: isDark
                      ? "1px solid rgba(255,255,255,0.14)"
                      : "1px solid #E5E5E5",
                    background: isDark ? "#121217" : "#F8F8F8",
                    maxWidth: "100%",
                  }}
                >
                  <span
                    style={{
                      ...labelStyle,
                      fontSize: isPhone ? 9 : 10,
                      color: mutedInk,
                    }}
                  >
                    CITED:
                  </span>
                  <code
                    style={{
                      fontFamily: "var(--mf-mono, monospace)",
                      fontSize: isPhone ? "0.72rem" : "0.78rem",
                      fontWeight: 600,
                      color: ink,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {leaf.entryFile}
                  </code>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* 4. Rotating Mechanical Degree Scale Ring + Top-Dead-Center Reticle */}
      {showScale && (
        <>
          <motion.svg
            width={ringR * 2}
            height={ringR * 2}
            viewBox={`${-ringR} ${-ringR} ${ringR * 2} ${ringR * 2}`}
            style={{
              position: "absolute",
              left: `calc(50% - ${ringR}px)`,
              top: `calc(${dialConfig.top}% + ${reach - ringR}px)`,
              rotate: turn,
              zIndex: 2,
              pointerEvents: "none",
              overflow: "visible",
            }}
          >
            <circle r={ringR} fill="none" stroke={scaleColor} strokeWidth={1} />
            <circle
              r={ringR - 18}
              fill="none"
              stroke={scaleColor}
              strokeWidth={1}
              strokeDasharray="1 5"
              opacity={0.65}
            />
            {ticks.map((t, k) => {
              const len = t.major ? 12 : 5;
              const s = Math.sin(t.deg * RAD);
              const c = -Math.cos(t.deg * RAD);
              return (
                <line
                  key={k}
                  x1={s * ringR}
                  y1={c * ringR}
                  x2={s * (ringR - len)}
                  y2={c * (ringR - len)}
                  stroke={scaleColor}
                  strokeWidth={t.major ? 1.25 : 0.8}
                />
              );
            })}
          </motion.svg>

          <svg
            width={28}
            height={28}
            viewBox="-14 -14 28 28"
            style={{
              position: "absolute",
              left: "50%",
              top: notchTop,
              marginLeft: -14,
              marginTop: -14,
              zIndex: 2,
              pointerEvents: "none",
              overflow: "visible",
            }}
          >
            <circle
              r={10}
              fill="none"
              stroke={ink}
              strokeOpacity={0.22}
              strokeWidth={1}
            />
            {ticking && (
              <motion.circle
                key={`tick${a}`}
                r={10}
                fill="none"
                stroke={ink}
                strokeWidth={1.5}
                strokeLinecap="round"
                transform="rotate(-90)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: every, ease: "linear" }}
              />
            )}
            <circle r={3} fill={ink} />
          </svg>
        </>
      )}

      {/* 5. Rotary Spoke Cards */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          pointerEvents: "none",
          WebkitMaskImage: sideMask(finishConfig.sideFade),
          maskImage: sideMask(finishConfig.sideFade),
        }}
      >
        {leaves.map((lf, i) => (
          <Spoke
            key={lf.id || i}
            turn={turn}
            index={i}
            total={n}
            step={step}
            reach={reach}
            w={w}
            h={h}
            top={dialConfig.top}
            lift={lift}
            corner={dialConfig.corner}
            chosen={i === a}
            awake={true}
            still={still}
            leaf={lf}
            cardSrc={cardArts[i]}
            finish={finishConfig}
            labelStyle={labelStyle}
            linkLabel={linkLabel}
            onPick={() => {
              if (dragged.current) return;
              if (i === a) {
                handleOpenRepo(lf);
              } else {
                choose(i);
              }
            }}
          />
        ))}
      </div>

      {/* 6. Bottom Left/Right Stepper Controls (44x44px accessible touch targets) */}
      {showSteppers && (
        <div
          style={{
            position: "absolute",
            left: responsiveEdge,
            right: responsiveEdge,
            bottom: isPhone ? 14 : 22,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 7,
            pointerEvents: "none",
          }}
        >
          <motion.button
            type="button"
            aria-label="Previous inspection lens"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => choose(pickRef.current - 1)}
            initial={false}
            whileHover={still ? undefined : { scale: 1.06 }}
            whileTap={still ? undefined : { scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: isDark
                ? "1px solid rgba(255,255,255,0.24)"
                : "1px solid #D4D4D4",
              background: isDark ? "#141419" : "#FFFFFF",
              color: ink,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              padding: 0,
              pointerEvents: "auto",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M8.5 2.5 4 7l4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>

          <motion.button
            type="button"
            aria-label="Next inspection lens"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => choose(pickRef.current + 1)}
            initial={false}
            whileHover={still ? undefined : { scale: 1.06 }}
            whileTap={still ? undefined : { scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: isDark
                ? "1px solid rgba(255,255,255,0.24)"
                : "1px solid #D4D4D4",
              background: isDark ? "#141419" : "#FFFFFF",
              color: ink,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              padding: 0,
              pointerEvents: "auto",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M5.5 2.5 10 7l-4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>
        </div>
      )}
    </div>
  );
}

export default Volvelle;
