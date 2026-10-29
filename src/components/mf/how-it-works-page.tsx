import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { Pill, Reveal, SiteLayout } from "./site-layout";
import { MorphText } from "@/components/ui/morph-text";

/* ═══════════════════════════════════════════════════════════════════════════
   CLEAN, VISUAL-FIRST DATA (NO DASHBOARD CLUTTER)
   ═══════════════════════════════════════════════════════════════════════════ */

const JOURNEY_STEPS = [
  {
    num: "01)",
    title: "Drop a link",
    subtitle: "Instant fetch",
    desc: "Paste any GitHub repository URL. DevLens pulls only the clean source files in under a second—zero setup or config.",
  },
  {
    num: "02)",
    title: "See the map",
    subtitle: "Living architecture",
    desc: "Flat folders automatically organize into a visual map of modules, showing how every part of your app connects.",
  },
  {
    num: "03)",
    title: "Spot the ripples",
    subtitle: "Impact preview",
    desc: "Hover any file to see what depends on it before you make a change—so nothing breaks by surprise.",
  },
  {
    num: "04)",
    title: "Ask in plain English",
    subtitle: "Direct answers",
    desc: "Ask how a feature works and jump straight to the exact file and line that powers it.",
  },
];

const CONSTELLATION_NODES = [
  { id: "auth", label: "Auth & Login", color: "#10b981", listY: 0, mapX: 22, mapY: 28 },
  { id: "api", label: "API Gateway", color: "#3b82f6", listY: 1, mapX: 50, mapY: 20 },
  { id: "core", label: "Core Engine", color: "#ffffff", listY: 2, mapX: 50, mapY: 54 },
  { id: "billing", label: "Payments", color: "#f59e0b", listY: 3, mapX: 78, mapY: 32 },
  { id: "ui", label: "Web Client", color: "#a855f7", listY: 4, mapX: 26, mapY: 74 },
  { id: "db", label: "Database", color: "#ec4899", listY: 5, mapX: 76, mapY: 74 },
];

const RIPPLE_MODULES = [
  {
    id: "auth",
    name: "Auth Service",
    impactCount: "14 connected files",
    caption: "Touching Auth ripples into Checkout, User Profile, and API Middleware.",
    connected: ["API Router", "Checkout", "User Session"],
  },
  {
    id: "payments",
    name: "Payment Flow",
    impactCount: "6 connected files",
    caption: "Touching Payments affects Webhook Handler, Invoices, and Order State.",
    connected: ["Stripe Webhook", "Invoice PDF", "Order Store"],
  },
  {
    id: "router",
    name: "App Router",
    impactCount: "22 connected files",
    caption: "Core traffic hub—changes here reach almost every screen in the app.",
    connected: ["Auth Guard", "Dashboard", "Settings", "Search"],
  },
];

const SIMPLE_QUESTIONS = [
  {
    q: "How does user login work?",
    a: "When a user signs in, the credentials are verified in the session guard and a secure token is stored for future requests.",
    file: "src/auth/session.ts",
    line: "Line 24",
  },
  {
    q: "Where are webhook events handled?",
    a: "Incoming events are verified by signature in the webhook controller before updating the database state.",
    file: "src/api/webhooks.ts",
    line: "Line 58",
  },
  {
    q: "What happens when a repo is imported?",
    a: "The URL is validated, source files are mapped into nodes, and the visual graph renders in your workspace.",
    file: "src/core/importer.ts",
    line: "Line 12",
  },
];

const PRESET_REPOS = [
  "vercel/next.js",
  "facebook/react",
  "tailwindlabs/tailwindcss",
];

/* ═══════════════════════════════════════════════════════════════════════════
   HOW IT WORKS PAGE — CREATIVE, EFFORTLESS, VISUAL EXPERIENCE
   ═══════════════════════════════════════════════════════════════════════════ */

export function HowItWorksPage() {
  const navigate = useNavigate();

  // Interactive visual states (lightweight & playful)
  const [hoveredOrb, setHoveredOrb] = useState<string | null>("core");
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [activeRipple, setActiveRipple] = useState<number>(0);
  const [activeQuestion, setActiveQuestion] = useState<number>(0);
  const [repoUrl, setRepoUrl] = useState<string>("vercel/next.js");

  const currentRipple = RIPPLE_MODULES[activeRipple];
  const currentQA = SIMPLE_QUESTIONS[activeQuestion];

  return (
    <SiteLayout>
      {/* ═══════════════════════════════════════════════════════════════════
          00 · AIRY EDITORIAL HERO + KINETIC VISUAL SCULPTURE
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-hero hwx-hero" data-theme="light">
        <div className="mf-hero-grid-bg" />
        <div className="mf-wrap" style={{ position: "relative", zIndex: 1 }}>
          <div className="hwx-hero-center">
            <Pill live>How DevLens Works · Ready in 7 Seconds</Pill>

            <h1 className="mf-mega hwx-hero-title">
              Paste a link.
              <br />
              Watch it become a{" "}
              <span className="mf-serif-i" style={{ fontWeight: 400 }}>
                <MorphText
                  words={[
                    "living map.",
                    "visual flow.",
                    "clear story.",
                    "smart guide.",
                  ]}
                />
              </span>
            </h1>

            <p className="mf-lead hwx-hero-sub">
              Forget digging through hundreds of folders. Drop any GitHub URL and see your entire codebase transform into an interactive visual map you can explore in seconds.
            </p>
          </div>

          {/* ── Kinetic Visual Sculpture (URL -> Lens -> Living Nodes) ── */}
          <Reveal>
            <div className="hwx-sculpture">
              <svg
                viewBox="0 0 1000 320"
                className="hwx-sculpture-svg"
                aria-label="Visual transformation from GitHub URL to interactive node map"
              >
                <defs>
                  <linearGradient id="hwx-beam" x1="0%" y1="50%" x2="100%" y2="50%">
                    <stop offset="0%" stopColor="#0a0a0a" stopOpacity="0.15" />
                    <stop offset="50%" stopColor="#10b981" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0.25" />
                  </linearGradient>
                  <radialGradient id="hwx-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Soft ambient glow behind the lens */}
                <circle cx="460" cy="160" r="130" fill="url(#hwx-glow)" />

                {/* Flowing curved streams from URL pill through the Lens to the Nodes */}
                <path
                  d="M 230 160 C 330 160, 370 160, 460 160"
                  fill="none"
                  stroke="#0a0a0a"
                  strokeWidth="2"
                  strokeDasharray="6 6"
                  className="hwx-dash-flow"
                />

                {/* Fan-out curves from Lens (460,160) to the 4 visual orbs */}
                <path
                  d="M 460 160 C 560 160, 610 72, 720 72"
                  fill="none"
                  stroke="url(#hwx-beam)"
                  strokeWidth={hoveredOrb === "auth" ? "3" : "1.6"}
                />
                <path
                  d="M 460 160 C 570 160, 640 132, 830 128"
                  fill="none"
                  stroke="url(#hwx-beam)"
                  strokeWidth={hoveredOrb === "core" ? "3" : "1.6"}
                />
                <path
                  d="M 460 160 C 570 160, 620 212, 740 226"
                  fill="none"
                  stroke="url(#hwx-beam)"
                  strokeWidth={hoveredOrb === "api" ? "3" : "1.6"}
                />
                <path
                  d="M 460 160 C 590 160, 700 256, 860 246"
                  fill="none"
                  stroke="url(#hwx-beam)"
                  strokeWidth={hoveredOrb === "ui" ? "3" : "1.6"}
                />

                {/* Subtle constellation links between the output orbs */}
                <line
                  x1="720"
                  y1="72"
                  x2="830"
                  y2="128"
                  stroke="#0a0a0a"
                  strokeOpacity="0.16"
                  strokeDasharray="3 4"
                />
                <line
                  x1="830"
                  y1="128"
                  x2="740"
                  y2="226"
                  stroke="#0a0a0a"
                  strokeOpacity="0.16"
                  strokeDasharray="3 4"
                />
                <line
                  x1="740"
                  y1="226"
                  x2="860"
                  y2="246"
                  stroke="#0a0a0a"
                  strokeOpacity="0.16"
                  strokeDasharray="3 4"
                />

                {/* STEP 1: Left Floating URL Pill */}
                <g transform="translate(36, 128)">
                  <rect
                    x="0"
                    y="0"
                    width="196"
                    height="64"
                    rx="32"
                    fill="#0a0a0a"
                  />
                  <circle cx="28" cy="32" r="5" fill="#10b981" />
                  <text
                    x="44"
                    y="28"
                    fill="#8a8a8a"
                    fontSize="10"
                    fontFamily="var(--mf-mono)"
                    letterSpacing="0.08em"
                  >
                    1. PASTE REPO
                  </text>
                  <text
                    x="44"
                    y="45"
                    fill="#ffffff"
                    fontSize="12.5"
                    fontWeight="500"
                    fontFamily="var(--mf-font)"
                  >
                    vercel/next.js
                  </text>
                </g>

                {/* STEP 2: Center DevLens Prism Ring */}
                <g transform="translate(460, 160)">
                  <circle
                    r="58"
                    fill="#ffffff"
                    stroke="#0a0a0a"
                    strokeWidth="1.5"
                  />
                  <circle
                    r="44"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="5 5"
                    className="hwx-spin-slow"
                  />
                  <circle r="8" fill="#10b981" />
                  <text
                    y="82"
                    textAnchor="middle"
                    fill="#0a0a0a"
                    fontSize="11"
                    fontFamily="var(--mf-mono)"
                    letterSpacing="0.08em"
                  >
                    2. DEVLENS ENGINE
                  </text>
                </g>

                {/* STEP 3: Right Living Architectural Orbs */}
                {[
                  { id: "auth", x: 720, y: 72, label: "Auth", sub: "12 files", color: "#10b981" },
                  { id: "core", x: 830, y: 128, label: "Core Graph", sub: "34 files", color: "#0a0a0a" },
                  { id: "api", x: 740, y: 226, label: "API Routes", sub: "19 files", color: "#3b82f6" },
                  { id: "ui", x: 860, y: 246, label: "UI Views", sub: "28 files", color: "#f59e0b" },
                ].map((orb) => {
                  const active = hoveredOrb === orb.id;
                  return (
                    <g
                      key={orb.id}
                      transform={`translate(${orb.x}, ${orb.y})`}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoveredOrb(orb.id)}
                    >
                      {active && (
                        <circle
                          r="38"
                          fill="none"
                          stroke={orb.color}
                          strokeWidth="1.2"
                          strokeOpacity="0.4"
                        />
                      )}
                      <circle
                        r={active ? "28" : "24"}
                        fill="#ffffff"
                        stroke="#0a0a0a"
                        strokeWidth={active ? "2" : "1.4"}
                      />
                      <circle cx="-26" cy="-18" r="5" fill={orb.color} />
                      <text
                        y="4"
                        textAnchor="middle"
                        fill="#0a0a0a"
                        fontSize="11"
                        fontWeight="600"
                        fontFamily="var(--mf-font)"
                      >
                        {orb.label}
                      </text>
                      <text
                        y="42"
                        textAnchor="middle"
                        fill="#737373"
                        fontSize="10"
                        fontFamily="var(--mf-mono)"
                      >
                        {orb.sub}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="hwx-sculpture-caption">
                <span className="mf-mono">
                  ● HOVER ANY MODULE NODE ABOVE TO TRACE ITS PATH
                </span>
                <button
                  type="button"
                  className="mf-btn sm"
                  onClick={() => navigate({ to: "/dashboard" })}
                >
                  Try Live Map <span className="mf-arrow">↗</span>
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          01 · THE 4-STEP CURVED JOURNEY (CLEAN ARCHED FLOW)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section hwx-journey-sec" data-theme="light">
        <div className="mf-wrap">
          <div className="mf-sec-bar">
            <span className="idx">[01 / THE FLOW]</span>
            <Pill>Four Simple Steps</Pill>
            <span className="tag">ZERO CONFIGURATION REQUIRED</span>
          </div>

          <Reveal>
            <div className="hwx-journey-head">
              <h2 className="mf-h1">
                How a link becomes{" "}
                <span className="mf-serif-i" style={{ fontWeight: 400 }}>
                  instant understanding.
                </span>
              </h2>
            </div>
          </Reveal>

          {/* Curved Arched Progression (Inspired by reference image) */}
          <div className="hwx-arc-stage">
            <svg
              viewBox="0 0 1100 220"
              className="hwx-arc-svg"
              aria-hidden="true"
            >
              {/* Arch 1 -> 2 */}
              <path
                d="M 110 70 Q 245 -25, 380 110"
                fill="none"
                stroke="#0a0a0a"
                strokeWidth="1.6"
                strokeDasharray="6 6"
              />
              {/* Arch 2 -> 3 */}
              <path
                d="M 380 110 Q 515 25, 650 150"
                fill="none"
                stroke="#0a0a0a"
                strokeOpacity="0.45"
                strokeWidth="1.6"
                strokeDasharray="6 6"
              />
              {/* Arch 3 -> 4 */}
              <path
                d="M 650 150 Q 785 65, 920 190"
                fill="none"
                stroke="#0a0a0a"
                strokeOpacity="0.28"
                strokeWidth="1.6"
                strokeDasharray="6 6"
              />

              {/* Step Anchor Dots */}
              <circle cx="110" cy="70" r="7" fill="#0a0a0a" />
              <circle cx="380" cy="110" r="7" fill="#0a0a0a" />
              <circle cx="650" cy="150" r="7" fill="#0a0a0a" />
              <circle cx="920" cy="190" r="7" fill="#10b981" />
            </svg>

            <div className="hwx-arc-grid">
              {JOURNEY_STEPS.map((step, i) => (
                <Reveal key={step.num} delay={i * 70}>
                  <div
                    className="hwx-arc-card"
                    style={{ marginTop: `${i * 36}px` }}
                  >
                    <div className="hwx-arc-title">
                      <span className="hwx-arc-num">{step.num}</span>{" "}
                      <strong>{step.title}</strong>
                    </div>
                    <div className="hwx-arc-sub mf-mono">{step.subtitle}</div>
                    <p className="hwx-arc-desc">{step.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          02 · THREE PLAYFUL VISUAL STORIES (DARK STUDIO — NO COMPLEXITY)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section mf-dark" data-theme="dark">
        <div className="mf-wrap">
          <div className="mf-sec-bar">
            <span className="idx">[02 / INTERACTIVE EXPERIENCE]</span>
            <Pill>See It In Action</Pill>
            <span className="tag">BUILT FOR HUMANS, NOT TERMINALS</span>
          </div>

          <div className="hwx-dark-intro">
            <Reveal>
              <h2 className="mf-h1">
                Three ways DevLens turns{" "}
                <span className="mf-serif-i" style={{ fontWeight: 400, color: "#a3a3a3" }}>
                  complexity into clarity.
                </span>
              </h2>
            </Reveal>
          </div>

          <div className="hwx-stories">
            {/* ── Story 1: Flat Folders ⇄ Living Map ── */}
            <Reveal>
              <div className="hwx-story-card">
                <div className="hwx-story-copy">
                  <span className="hwx-story-idx mf-mono">01 // VISUAL ARCHITECTURE</span>
                  <h3 className="hwx-story-h3">
                    From flat folders to a{" "}
                    <span className="mf-serif-i">living map.</span>
                  </h3>
                  <p>
                    File trees hide how your code actually works together. Flip the switch to see how DevLens turns a static list of files into a connected map.
                  </p>
                  <div className="hwx-toggle-pill">
                    <button
                      type="button"
                      data-active={viewMode === "list"}
                      onClick={() => setViewMode("list")}
                    >
                      Folder List
                    </button>
                    <button
                      type="button"
                      data-active={viewMode === "map"}
                      onClick={() => setViewMode("map")}
                    >
                      Visual Map ✨
                    </button>
                  </div>
                </div>

                <div className="hwx-story-stage">
                  {viewMode === "map" && (
                    <svg className="hwx-constellation-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <line x1="22" y1="28" x2="50" y2="54" stroke="rgba(255,255,255,0.22)" strokeWidth="0.6" />
                      <line x1="50" y1="20" x2="50" y2="54" stroke="rgba(255,255,255,0.22)" strokeWidth="0.6" />
                      <line x1="78" y1="32" x2="50" y2="54" stroke="rgba(255,255,255,0.22)" strokeWidth="0.6" />
                      <line x1="26" y1="74" x2="50" y2="54" stroke="rgba(255,255,255,0.22)" strokeWidth="0.6" />
                      <line x1="76" y1="74" x2="50" y2="54" stroke="rgba(255,255,255,0.22)" strokeWidth="0.6" />
                      <line x1="22" y1="28" x2="50" y2="20" stroke="rgba(16,185,129,0.4)" strokeWidth="0.6" />
                    </svg>
                  )}

                  {CONSTELLATION_NODES.map((node) => {
                    const left = viewMode === "map" ? `${node.mapX}%` : "50%";
                    const top =
                      viewMode === "map"
                        ? `${node.mapY}%`
                        : `${14 + node.listY * 14}%`;
                    return (
                      <motion.div
                        key={node.id}
                        layout
                        transition={{ type: "spring", stiffness: 220, damping: 24 }}
                        className="hwx-floating-node"
                        data-mode={viewMode}
                        style={{ left, top }}
                      >
                        <span
                          className="hwx-node-dot"
                          style={{ background: node.color }}
                        />
                        <span>{node.label}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </Reveal>

            {/* ── Story 2: Touch a File, See the Ripple ── */}
            <Reveal>
              <div className="hwx-story-card">
                <div className="hwx-story-copy">
                  <span className="hwx-story-idx mf-mono">02 // RIPPLE PREVIEW</span>
                  <h3 className="hwx-story-h3">
                    Touch a file,{" "}
                    <span className="mf-serif-i">see the ripple.</span>
                  </h3>
                  <p>
                    Curious what might break if you edit a module? Tap any module below to see its ripple effect across the rest of your app.
                  </p>
                  <div className="hwx-ripple-tabs">
                    {RIPPLE_MODULES.map((m, idx) => (
                      <button
                        key={m.id}
                        type="button"
                        className="hwx-ripple-tab"
                        data-active={idx === activeRipple}
                        onClick={() => setActiveRipple(idx)}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hwx-story-stage hwx-ripple-stage">
                  <div className="hwx-ripple-rings">
                    <span className="ring r1" />
                    <span className="ring r2" />
                    <span className="ring r3" />
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentRipple.id}
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      transition={{ duration: 0.22 }}
                      className="hwx-ripple-center"
                    >
                      <div className="hwx-ripple-core">
                        <strong>{currentRipple.name}</strong>
                        <span className="mf-mono">{currentRipple.impactCount}</span>
                      </div>

                      <div className="hwx-ripple-satellites">
                        {currentRipple.connected.map((item) => (
                          <span key={item} className="hwx-sat-pill">
                            ↗ {item}
                          </span>
                        ))}
                      </div>

                      <p className="hwx-ripple-caption">{currentRipple.caption}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </Reveal>

            {/* ── Story 3: Ask in Plain English ── */}
            <Reveal>
              <div className="hwx-story-card">
                <div className="hwx-story-copy">
                  <span className="hwx-story-idx mf-mono">03 // CONVERSATIONAL GUIDE</span>
                  <h3 className="hwx-story-h3">
                    Ask a question,{" "}
                    <span className="mf-serif-i">jump to the line.</span>
                  </h3>
                  <p>
                    Ask how any feature works in plain English. DevLens gives you a clear, human answer and links straight to the exact file.
                  </p>
                  <div className="hwx-q-pills">
                    {SIMPLE_QUESTIONS.map((item, idx) => (
                      <button
                        key={item.q}
                        type="button"
                        className="hwx-q-pill"
                        data-active={idx === activeQuestion}
                        onClick={() => setActiveQuestion(idx)}
                      >
                        “{item.q}”
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hwx-story-stage hwx-chat-stage">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentQA.q}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.22 }}
                      className="hwx-chat-card"
                    >
                      <div className="hwx-chat-bubble-q">“{currentQA.q}”</div>
                      <p className="hwx-chat-bubble-a">{currentQA.a}</p>
                      <div className="hwx-chat-cite">
                        <span className="hwx-cite-dot" />
                        <span className="mf-mono">{currentQA.file}</span>
                        <span className="hwx-cite-line mf-mono">{currentQA.line}</span>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          03 · THE OLD WAY VS. THE DEVLENS WAY (LIGHT MINIMALIST)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section" data-theme="light">
        <div className="mf-wrap">
          <div className="mf-sec-bar">
            <span className="idx">[03 / WHY IT FEELS DIFFERENT]</span>
            <Pill>Before &amp; After</Pill>
            <span className="tag">DESIGNED FOR FLOW</span>
          </div>

          <Reveal>
            <div className="hwx-compare-grid">
              <div className="hwx-compare-card hwx-compare-card--old">
                <span className="hwx-compare-tag mf-mono">WITHOUT DEVLENS</span>
                <h3>40 open tabs and guesswork.</h3>
                <ul>
                  <li>Jumping between dozens of folders trying to trace one function</li>
                  <li>Outdated READMEs that no longer match the real code</li>
                  <li>Editing a shared file and hoping nothing downstream breaks</li>
                </ul>
              </div>

              <div className="hwx-compare-card hwx-compare-card--new">
                <span className="hwx-compare-tag mf-mono" style={{ color: "#10b981" }}>
                  ● WITH DEVLENS
                </span>
                <h3>One visual map, total clarity.</h3>
                <ul>
                  <li>See your entire architecture in a clean, interactive view</li>
                  <li>Preview the ripple effect of any file before you touch it</li>
                  <li>Ask questions in plain English with direct line links</li>
                </ul>
              </div>
            </div>
          </Reveal>

          {/* ── Minimalist Finale CTA ── */}
          <Reveal>
            <div className="hwx-cta-card">
              <Pill live>Ready When You Are</Pill>
              <h2 className="mf-h1 hwx-cta-title">
                See your codebase{" "}
                <span className="mf-serif-i" style={{ fontWeight: 400 }}>
                  come alive.
                </span>
              </h2>

              <form
                className="mf-ingest hwx-cta-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate({ to: "/dashboard" });
                }}
              >
                <span className="mf-mono mf-muted" style={{ paddingLeft: 16 }}>
                  github.com/
                </span>
                <input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="owner/repository"
                  aria-label="GitHub repository"
                />
                <button type="submit" className="mf-btn">
                  Explore Map <span className="mf-arrow">↗</span>
                </button>
              </form>

              <div className="hwx-cta-presets">
                {PRESET_REPOS.map((repo) => (
                  <button
                    key={repo}
                    type="button"
                    className="mf-pill mf-chip"
                    onClick={() => {
                      setRepoUrl(repo);
                      navigate({ to: "/dashboard" });
                    }}
                  >
                    {repo} ↗
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}

export default HowItWorksPage;
