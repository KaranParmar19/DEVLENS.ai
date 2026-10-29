import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { Pill, Reveal, SiteLayout } from "./site-layout";
import { MorphText } from "@/components/ui/morph-text";
import { FAQSection } from "@/components/ui/faq-section";
import { normalizeRepoUrl } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CREATIVE INTERACTIVE DATA
   ═══════════════════════════════════════════════════════════════════════════ */

const TRY_REPOS = [
  { label: "facebook/react", tag: "UI Core" },
  { label: "vercel/next.js", tag: "Framework" },
  { label: "fastapi/fastapi", tag: "Python" },
  { label: "tailwindlabs/tailwindcss", tag: "Engine" },
];

/* Nodes inside the Hero X-Ray Lens */
const LENS_ITEMS = [
  { id: "n1", raw: "import { verify } from './jwt'", clean: "JWT Guard", cluster: "Security", x: 18, y: 26, color: "#10b981" },
  { id: "n2", raw: "export async function login()", clean: "Auth Flow", cluster: "Security", x: 34, y: 62, color: "#10b981" },
  { id: "n3", raw: "router.post('/api/v1/checkout')", clean: "API Gateway", cluster: "Ingress", x: 52, y: 28, color: "#3b82f6" },
  { id: "n4", raw: "await stripe.paymentIntents.create()", clean: "Billing Core", cluster: "Payments", x: 56, y: 70, color: "#f59e0b" },
  { id: "n5", raw: "db.query('SELECT * FROM users')", clean: "Postgres Store", cluster: "Data Layer", x: 82, y: 36, color: "#a855f7" },
  { id: "n6", raw: "redis.setEx(sessionId, 3600)", clean: "Session Cache", cluster: "Data Layer", x: 78, y: 72, color: "#ec4899" },
];

const LENS_EDGES: [number, number][] = [
  [0, 1],
  [2, 0],
  [2, 3],
  [1, 4],
  [1, 5],
  [3, 4],
];

/* 4-Stage Interactive Scrubber Morph States */
interface MorphPhase {
  id: string;
  step: string;
  timeRange: string;
  progress: number;
  title: string;
  italic: string;
  caption: string;
  badge: string;
}

const MORPH_PHASES: MorphPhase[] = [
  {
    id: "drop",
    step: "01",
    timeRange: "0.0s — 1.2s",
    progress: 18,
    title: "Drop a link.",
    italic: "Noise disappears.",
    caption:
      "Paste any GitHub URL. DevLens instantly strips away heavy lockfiles, build folders, and clutter—keeping only pure source files.",
    badge: "STEP 01 · INSTANT FETCH",
  },
  {
    id: "cluster",
    step: "02",
    timeRange: "1.2s — 3.6s",
    progress: 46,
    title: "Files snap into",
    italic: "living neighborhoods.",
    caption:
      "Disconnected folders magnetically group themselves into visual domains—Auth, API, Billing, and Data—so you see the big picture immediately.",
    badge: "STEP 02 · MAGNETIC CLUSTERING",
  },
  {
    id: "pulse",
    step: "03",
    timeRange: "3.6s — 5.6s",
    progress: 74,
    title: "Every connection",
    italic: "lights up.",
    caption:
      "DevLens traces how functions call each other across files and highlights your most critical hubs before you touch a single line.",
    badge: "STEP 03 · RIPPLE & FLOW",
  },
  {
    id: "ask",
    step: "04",
    timeRange: "5.6s — 7.4s",
    progress: 100,
    title: "Ask anything.",
    italic: "Jump to the line.",
    caption:
      "Type a question in plain English and watch DevLens pinpoint the exact file and line number that answers it.",
    badge: "STEP 04 · CITED ANSWERS",
  },
];

/* Coordinates of the 6 visual nodes across the 4 morph phases */
const MORPH_NODE_COORDS: {
  id: string;
  label: string;
  file: string;
  color: string;
  pos: { x: number; y: number; scale?: number }[];
}[] = [
  {
    id: "url",
    label: "Entry Router",
    file: "src/api/router.ts:14",
    color: "#3b82f6",
    pos: [
      { x: 16, y: 22, scale: 0.92 },
      { x: 24, y: 30, scale: 1 },
      { x: 20, y: 50, scale: 1.05 },
      { x: 20, y: 50, scale: 0.95 },
    ],
  },
  {
    id: "auth",
    label: "Auth Guard",
    file: "src/auth/session.ts:24",
    color: "#10b981",
    pos: [
      { x: 82, y: 20, scale: 0.92 },
      { x: 28, y: 68, scale: 1 },
      { x: 48, y: 32, scale: 1.12 },
      { x: 50, y: 42, scale: 1.22 },
    ],
  },
  {
    id: "core",
    label: "Core Engine",
    file: "src/core/engine.ts:88",
    color: "#ffffff",
    pos: [
      { x: 48, y: 82, scale: 0.92 },
      { x: 52, y: 48, scale: 1.08 },
      { x: 50, y: 68, scale: 1.08 },
      { x: 48, y: 76, scale: 0.95 },
    ],
  },
  {
    id: "billing",
    label: "Checkout",
    file: "src/billing/stripe.ts:41",
    color: "#f59e0b",
    pos: [
      { x: 20, y: 78, scale: 0.92 },
      { x: 76, y: 32, scale: 1 },
      { x: 78, y: 34, scale: 1 },
      { x: 78, y: 34, scale: 0.92 },
    ],
  },
  {
    id: "db",
    label: "User Store",
    file: "src/db/users.ts:62",
    color: "#a855f7",
    pos: [
      { x: 84, y: 76, scale: 0.92 },
      { x: 74, y: 70, scale: 1 },
      { x: 80, y: 68, scale: 1.04 },
      { x: 80, y: 66, scale: 1.08 },
    ],
  },
];

/* "Pull the Thread" Interactive Chain Data */
const THREAD_CHAINS = [
  {
    id: "login",
    trigger: "When a user clicks Sign In",
    nodes: [
      { step: "01", role: "UI Component", name: "LoginForm.tsx", line: "L42", note: "Captures credentials & dispatches POST" },
      { step: "02", role: "API Route", name: "authController.ts", line: "L19", note: "Validates payload & rate-limits IP" },
      { step: "03", role: "Security Gate", name: "verifyToken.ts", line: "L24", note: "Signs Ed25519 JWT session token" },
      { step: "04", role: "Database", name: "sessionStore.ts", line: "L68", note: "Persists active session in Postgres" },
    ],
  },
  {
    id: "payment",
    trigger: "When an order is paid",
    nodes: [
      { step: "01", role: "Webhook Ingress", name: "stripeWebhook.ts", line: "L15", note: "Verifies cryptographic Stripe signature" },
      { step: "02", role: "Domain Service", name: "orderFulfill.ts", line: "L53", note: "Transitions order state to PAID" },
      { step: "03", role: "Queue Worker", name: "receiptMailer.ts", line: "L31", note: "Dispatches PDF invoice email job" },
      { step: "04", role: "Ledger Sink", name: "ledgerRepo.ts", line: "L94", note: "Commits immutable audit record" },
    ],
  },
  {
    id: "search",
    trigger: "When someone asks Copilot",
    nodes: [
      { step: "01", role: "Prompt Input", name: "AskBar.tsx", line: "L28", note: "Captures question & @pinned file" },
      { step: "02", role: "Vector Search", name: "pgvector.ts", line: "L61", note: "Finds closest AST function chunks" },
      { step: "03", role: "Graph Hop", name: "neighborExpand.ts", line: "L39", note: "Pulls 1-hop callers & callees" },
      { step: "04", role: "Cited Stream", name: "answerStream.ts", line: "L82", note: "Streams answer with exact file:line links" },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   HERO INTERACTIVE X-RAY LENS COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function InteractiveXRayLens() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [lensPos, setLensPos] = useState<{ x: number; y: number }>({ x: 54, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  // Subtle autonomous float when the user isn't hovering
  useEffect(() => {
    if (isHovering) return;
    let frame = 0;
    let t = 0;
    const animate = () => {
      t += 0.018;
      setLensPos({
        x: 50 + Math.cos(t) * 24,
        y: 50 + Math.sin(t * 1.4) * 18,
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isHovering]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(12, Math.min(88, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(18, Math.min(82, ((e.clientY - rect.top) / rect.height) * 100));
    setLensPos({ x, y });
  };

  return (
    <div
      ref={boxRef}
      className="hwc-xray-stage"
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => setIsHovering(false)}
      onPointerMove={handlePointerMove}
    >
      {/* Top Floating Instruction Pill */}
      <div className="hwc-xray-bar">
        <span className="mf-mono">
          <span className="hwc-pulse-dot" /> MOVE CURSOR TO SCAN RAW CODE THROUGH THE DEVLENS X-RAY
        </span>
        <span className="mf-mono hwc-xray-coords">
          LENS // X:{Math.round(lensPos.x)}% Y:{Math.round(lensPos.y)}%
        </span>
      </div>

      {/* LAYER 1: Raw Unstructured Code Background (Outside the Lens) */}
      <div className="hwc-xray-raw-layer" aria-hidden="true">
        {LENS_ITEMS.map((item) => (
          <div
            key={item.id}
            className="hwc-raw-snippet mf-mono"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            <div className="hwc-raw-file">unindexed_blob_{item.id}.ts</div>
            <code>{item.raw}</code>
          </div>
        ))}
      </div>

      {/* LAYER 2: Illuminated Architectural Graph (Clipped to the Moving X-Ray Lens!) */}
      <div
        className="hwc-xray-clean-layer"
        style={{
          clipPath: `circle(155px at ${lensPos.x}% ${lensPos.y}%)`,
          WebkitClipPath: `circle(155px at ${lensPos.x}% ${lensPos.y}%)`,
        }}
      >
        <svg className="hwc-xray-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {LENS_EDGES.map(([a, b], idx) => (
            <line
              key={idx}
              x1={LENS_ITEMS[a].x}
              y1={LENS_ITEMS[a].y}
              x2={LENS_ITEMS[b].x}
              y2={LENS_ITEMS[b].y}
              stroke="#10b981"
              strokeWidth="0.45"
              strokeDasharray="1.2 1.2"
            />
          ))}
        </svg>

        {LENS_ITEMS.map((item) => (
          <div
            key={item.id}
            className="hwc-clean-node"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            <span className="hwc-clean-dot" style={{ background: item.color }} />
            <div>
              <div className="hwc-clean-title">{item.clean}</div>
              <div className="hwc-clean-cluster mf-mono">{item.cluster}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Physical Glass Ring Cursor Follower */}
      <div
        className="hwc-lens-ring"
        style={{ left: `${lensPos.x}%`, top: `${lensPos.y}%` }}
      >
        <span className="hwc-lens-badge mf-mono">DEVLENS AST VIEW</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HOW IT WORKS PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export function HowItWorksPage() {
  const navigate = useNavigate();

  // Interactive Morph Theatre state
  const [phaseIdx, setPhaseIdx] = useState<number>(2);
  const [autoCycle, setAutoCycle] = useState<boolean>(true);

  // Interactive "Pull the Thread" state
  const [chainIdx, setChainIdx] = useState<number>(0);
  const [activeHopIdx, setActiveHopIdx] = useState<number>(2);

  // Repo launcher state
  const [repoInput, setRepoInput] = useState<string>("");

  useEffect(() => {
    if (!autoCycle) return;
    const id = window.setInterval(() => {
      setPhaseIdx((p) => (p + 1) % MORPH_PHASES.length);
    }, 3600);
    return () => window.clearInterval(id);
  }, [autoCycle]);

  const currentPhase = MORPH_PHASES[phaseIdx];
  const currentChain = THREAD_CHAINS[chainIdx];

  const launchRepo = (value: string) => {
    const normalized = normalizeRepoUrl(value);
    if (!normalized) {
      navigate({ to: "/dashboard" });
      return;
    }
    navigate({ to: "/dashboard", search: { repo: normalized } });
  };

  return (
    <SiteLayout>
      {/* ═══════════════════════════════════════════════════════════════════
          00 · EDITORIAL HERO + INTERACTIVE X-RAY LOUPE
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-hero" data-theme="light" style={{ paddingBottom: "clamp(56px, 7vw, 96px)" }}>
        <div className="mf-hero-grid-bg" />
        <div className="mf-wrap">
          <motion.div
            className="mf-hero-top"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Pill live>Interactive Architecture Lens · Ready in 7.4s</Pill>
            <span className="mf-mono mf-muted">URL IN // LIVING MAP OUT</span>
          </motion.div>

          <div className="hwc-hero-split">
            <motion.h1
              className="mf-mega hwc-hero-mega"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              Turn raw code into{" "}
              <span className="mf-serif-i">
                <MorphText
                  words={["clarity.", "motion.", "insight.", "vision."]}
                  morphTime={1.1}
                  holdTime={1.9}
                  strength={8}
                />
              </span>
            </motion.h1>

            <motion.div
              className="hwc-hero-lead-wrap"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.14 }}
            >
              <p className="mf-lead" style={{ margin: 0 }}>
                Move your cursor across the canvas below. What looks like thousands of tangled lines of code becomes a living, connected map the moment you look through DevLens.
              </p>
            </motion.div>
          </div>

          {/* Interactive X-Ray Code Loupe */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <InteractiveXRayLens />
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          01 · DARK INTERACTIVE MORPH THEATRE (SCRUB FROM 0.0s TO 7.4s)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section mf-dark" data-theme="dark">
        <div className="mf-wrap">
          <div className="mf-sec-bar">
            <span className="idx">[01 / THE 7.4-SECOND TRANSFORMATION]</span>
            <Pill>Interactive Time Scrubber</Pill>
            <span className="tag">CLICK ANY STAGE OR SCRUB THROUGH TIME</span>
          </div>

          <div className="hwc-theatre">
            {/* Left: Dynamic Editorial Story + Scrubber Controls */}
            <div className="hwc-theatre-left">
              <div className="hwc-phase-pill mf-mono">{currentPhase.badge}</div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPhase.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="mf-h1 hwc-theatre-title">
                    {currentPhase.title}
                    <br />
                    <span className="mf-serif-i" style={{ fontWeight: 400, color: "#10b981" }}>
                      {currentPhase.italic}
                    </span>
                  </h2>
                  <p className="mf-lead hwc-theatre-desc">{currentPhase.caption}</p>
                </motion.div>
              </AnimatePresence>

              {/* Tactile Step Scrubber Pills */}
              <div className="hwc-scrubber-steps">
                {MORPH_PHASES.map((ph, idx) => {
                  const active = idx === phaseIdx;
                  return (
                    <button
                      key={ph.id}
                      type="button"
                      className="hwc-scrubber-btn"
                      data-active={active}
                      onClick={() => {
                        setAutoCycle(false);
                        setPhaseIdx(idx);
                      }}
                    >
                      <div className="hwc-scrubber-top mf-mono">
                        <span>{ph.step}</span>
                        <span>{ph.timeRange}</span>
                      </div>
                      <div className="hwc-scrubber-name">{ph.title}</div>
                      <div className="hwc-scrubber-bar">
                        <span
                          style={{
                            width: active ? "100%" : idx < phaseIdx ? "100%" : "0%",
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Live Physics Morph Canvas */}
            <div className="hwc-theatre-canvas">
              <div className="hwc-canvas-chrome mf-mono">
                <span>LIVE VISUALIZATION // STAGE {currentPhase.step} OF 04</span>
                <button
                  type="button"
                  className="hwc-autoplay-btn mf-mono"
                  onClick={() => setAutoCycle((v) => !v)}
                >
                  {autoCycle ? "❚❚ PAUSE" : "▶ AUTO-CYCLE"}
                </button>
              </div>

              <div className="hwc-morph-stage">
                {/* Ambient Domain Rings in Phase 2+ */}
                {phaseIdx >= 1 && (
                  <div className="hwc-domain-halos" aria-hidden="true">
                    <div className="hwc-halo h1" />
                    <div className="hwc-halo h2" />
                  </div>
                )}

                {/* Synaptic Connection Lines in Phase 3 & 4 */}
                {phaseIdx >= 2 && (
                  <svg className="hwc-morph-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line
                      x1={MORPH_NODE_COORDS[0].pos[phaseIdx].x}
                      y1={MORPH_NODE_COORDS[0].pos[phaseIdx].y}
                      x2={MORPH_NODE_COORDS[1].pos[phaseIdx].x}
                      y2={MORPH_NODE_COORDS[1].pos[phaseIdx].y}
                      stroke="#10b981"
                      strokeWidth="0.6"
                      strokeDasharray="1.5 1.5"
                    />
                    <line
                      x1={MORPH_NODE_COORDS[1].pos[phaseIdx].x}
                      y1={MORPH_NODE_COORDS[1].pos[phaseIdx].y}
                      x2={MORPH_NODE_COORDS[2].pos[phaseIdx].x}
                      y2={MORPH_NODE_COORDS[2].pos[phaseIdx].y}
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth="0.5"
                    />
                    <line
                      x1={MORPH_NODE_COORDS[1].pos[phaseIdx].x}
                      y1={MORPH_NODE_COORDS[1].pos[phaseIdx].y}
                      x2={MORPH_NODE_COORDS[4].pos[phaseIdx].x}
                      y2={MORPH_NODE_COORDS[4].pos[phaseIdx].y}
                      stroke="#10b981"
                      strokeWidth="0.6"
                    />
                    <line
                      x1={MORPH_NODE_COORDS[2].pos[phaseIdx].x}
                      y1={MORPH_NODE_COORDS[2].pos[phaseIdx].y}
                      x2={MORPH_NODE_COORDS[3].pos[phaseIdx].x}
                      y2={MORPH_NODE_COORDS[3].pos[phaseIdx].y}
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="0.5"
                    />
                  </svg>
                )}

                {/* Floating Magnetic Nodes */}
                {MORPH_NODE_COORDS.map((node) => {
                  const target = node.pos[phaseIdx];
                  const isSpotlight = phaseIdx === 3 && node.id === "auth";
                  return (
                    <motion.div
                      key={node.id}
                      className="hwc-morph-node"
                      data-spotlight={isSpotlight}
                      animate={{
                        left: `${target.x}%`,
                        top: `${target.y}%`,
                        scale: target.scale ?? 1,
                      }}
                      transition={{ type: "spring", stiffness: 180, damping: 22 }}
                    >
                      <span className="hwc-node-dot" style={{ background: node.color }} />
                      <div>
                        <div className="hwc-node-title">{node.label}</div>
                        <div className="hwc-node-file mf-mono">{node.file}</div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Phase 01 Center Drop Badge */}
                {phaseIdx === 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="hwc-center-pill mf-mono"
                  >
                    git://github.com/vercel/next.js
                  </motion.div>
                )}

                {/* Phase 04 Floating Copilot Citation Bubble */}
                {phaseIdx === 3 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="hwc-copilot-toast"
                  >
                    <div className="mf-mono" style={{ fontSize: "0.64rem", color: "#10b981" }}>
                      ✓ CITED ANSWER · 100% VERIFIED
                    </div>
                    <div style={{ fontSize: "0.86rem", color: "#fff", marginTop: 4 }}>
                      “Session tokens are validated inside <code>Auth Guard</code> at{" "}
                      <span style={{ color: "#10b981" }}>src/auth/session.ts:24</span>.”
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          02 · "PULL THE THREAD" — INTERACTIVE EXECUTION CHAIN (LIGHT)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section" data-theme="light">
        <div className="mf-wrap">
          <div className="mf-sec-bar">
            <span className="idx">[02 / PULL THE THREAD]</span>
            <Pill>Interactive Call Chain</Pill>
            <span className="tag">FOLLOW ANY FEATURE FROM UI TO DATABASE</span>
          </div>

          <div className="hwc-thread-head">
            <Reveal>
              <h2 className="mf-h1" style={{ maxWidth: "13em", margin: 0 }}>
                Pull one thread.{" "}
                <span className="mf-serif-i" style={{ fontWeight: 400 }}>
                  Watch the whole path unfold.
                </span>
              </h2>
            </Reveal>

            <div className="hwc-thread-tabs">
              {THREAD_CHAINS.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  className="hwc-thread-tab"
                  data-active={idx === chainIdx}
                  onClick={() => {
                    setChainIdx(idx);
                    setActiveHopIdx(2);
                  }}
                >
                  {c.trigger}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive 4-Hop Chain Reaction */}
          <div className="hwc-chain-track">
            {currentChain.nodes.map((hop, idx) => {
              const isLit = idx <= activeHopIdx;
              const isCurrent = idx === activeHopIdx;
              return (
                <motion.button
                  key={hop.name}
                  type="button"
                  className="hwc-hop-card"
                  data-lit={isLit}
                  data-current={isCurrent}
                  onMouseEnter={() => setActiveHopIdx(idx)}
                  onClick={() => setActiveHopIdx(idx)}
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 360, damping: 26 }}
                >
                  <div className="hwc-hop-top mf-mono">
                    <span>HOP {hop.step}</span>
                    <span className="hwc-hop-role">{hop.role}</span>
                  </div>
                  <div className="hwc-hop-name">{hop.name}</div>
                  <p className="hwc-hop-note">{hop.note}</p>
                  <div className="hwc-hop-line mf-mono">
                    <span>↳ JUMP TO SOURCE</span>
                    <strong>{hop.line}</strong>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* 2-Card Asymmetric Architectural Promises */}
          <div className="hwc-promise-grid">
            <Reveal>
              <div className="hwc-promise-card hwc-promise-card--dark">
                <span className="mf-mono" style={{ fontSize: "0.68rem", color: "#10b981" }}>
                  ZERO DISK FOOTPRINT // PRIVACY BY DESIGN
                </span>
                <h3>Your code never lingers on a server.</h3>
                <p>
                  Repositories are analyzed in an ephemeral memory space that evaporates the moment your visual map is ready. No source files are stored on disk—ever.
                </p>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="hwc-promise-card hwc-promise-card--light">
                <span className="mf-mono" style={{ fontSize: "0.68rem", color: "var(--mf-ink-3)" }}>
                  DETERMINISTIC TRUTH // ZERO HALLUCINATION
                </span>
                <h3>Every answer points to a real line of code.</h3>
                <p>
                  Because DevLens maps actual syntax trees before you ask a question, every explanation includes clickable file and line citations you can verify in one click.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          03 · FAQ + SIGNATURE REPOSITORY LAUNCHER
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section" data-theme="light" style={{ paddingTop: 0 }}>
        <div className="mf-wrap">
          <Reveal>
            <FAQSection />
          </Reveal>

          <Reveal>
            <div className="hwc-finale">
              <div>
                <Pill live>Ready in Under 8 Seconds</Pill>
                <h2 className="mf-h1" style={{ margin: "18px 0 0", fontSize: "clamp(2.2rem, 4.8vw, 4.2rem)" }}>
                  Try it on a repository{" "}
                  <span className="mf-serif-i" style={{ fontWeight: 400 }}>
                    right now.
                  </span>
                </h2>
              </div>

              <div>
                <form
                  className="mf-ingest"
                  style={{ width: "100%" }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    launchRepo(repoInput);
                  }}
                >
                  <span className="mf-mono mf-muted">github.com/</span>
                  <input
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    placeholder="owner/repo or full URL"
                    aria-label="Repository URL"
                    spellCheck={false}
                  />
                  <button type="submit" className="mf-btn">
                    Analyze <span className="mf-arrow">↗</span>
                  </button>
                </form>

                <div className="mf-chips" style={{ marginTop: 14 }}>
                  {TRY_REPOS.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      className="mf-pill mf-chip"
                      onClick={() => launchRepo(t.label)}
                    >
                      <span>{t.label}</span>
                      <span style={{ opacity: 0.5, fontSize: "0.625rem" }}>({t.tag})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}

export default HowItWorksPage;
