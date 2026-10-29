import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { Pill, Reveal, SiteLayout } from "./site-layout";
import { MorphText } from "@/components/ui/morph-text";
import { FAQSection, type FAQItemData } from "@/components/ui/faq-section";
import { normalizeRepoUrl } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   BEGINNER-FRIENDLY INTERACTIVE DATA (PLAIN, SIMPLE ENGLISH)
   ═══════════════════════════════════════════════════════════════════════════ */

const TRY_REPOS = [
  { label: "facebook/react", tag: "Popular App" },
  { label: "vercel/next.js", tag: "Web Starter" },
  { label: "fastapi/fastapi", tag: "Python App" },
  { label: "tailwindlabs/tailwindcss", tag: "Design Tool" },
];

/* Nodes inside the Hero Magic Lens */
const LENS_ITEMS = [
  {
    id: "n1",
    raw: "folder_1 / check_password_v2.js",
    clean: "User Login",
    cluster: "Checks passwords",
    x: 18,
    y: 26,
    color: "#10b981",
  },
  {
    id: "n2",
    raw: "old_files / signup_helper_final.js",
    clean: "Sign-Up Page",
    cluster: "Welcomes new users",
    x: 34,
    y: 62,
    color: "#10b981",
  },
  {
    id: "n3",
    raw: "core / main_routes_index.js",
    clean: "Main Menu",
    cluster: "Connects every page",
    x: 52,
    y: 28,
    color: "#3b82f6",
  },
  {
    id: "n4",
    raw: "helpers / pay_button_stripe.js",
    clean: "Checkout Box",
    cluster: "Handles payments",
    x: 56,
    y: 70,
    color: "#f59e0b",
  },
  {
    id: "n5",
    raw: "storage / save_user_list.js",
    clean: "Saved Data",
    cluster: "Stores user info",
    x: 82,
    y: 36,
    color: "#a855f7",
  },
  {
    id: "n6",
    raw: "utils / keep_logged_in.js",
    clean: "Quick Memory",
    cluster: "Keeps you signed in",
    x: 78,
    y: 72,
    color: "#ec4899",
  },
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
    progress: 25,
    title: "Paste a link.",
    italic: "We clean the clutter.",
    caption:
      "Just copy and paste any GitHub project link. DevLens automatically skips junk files and extra clutter so you only see the files that actually matter.",
    badge: "STEP 01 · PASTE YOUR LINK",
  },
  {
    id: "cluster",
    step: "02",
    timeRange: "1.2s — 3.6s",
    progress: 50,
    title: "Files group into",
    italic: "simple topics.",
    caption:
      "Instead of a scary list of hundreds of files, DevLens neatly groups related parts together—like Login, Checkout, and Saved Data—just like a city map.",
    badge: "STEP 02 · AUTO-ORGANIZE",
  },
  {
    id: "pulse",
    step: "03",
    timeRange: "3.6s — 5.6s",
    progress: 75,
    title: "See what connects",
    italic: "to what.",
    caption:
      "Lines appear between cards so you can see how the whole app works together—and which important files you shouldn't accidentally break.",
    badge: "STEP 03 · SEE CONNECTIONS",
  },
  {
    id: "ask",
    step: "04",
    timeRange: "5.6s — 7.4s",
    progress: 100,
    title: "Ask in plain English.",
    italic: "Find the exact spot.",
    caption:
      "Stuck or curious? Ask a normal question like “How does login work?” and DevLens points you straight to the exact file and line.",
    badge: "STEP 04 · ASK ANYTHING",
  },
];

/* Coordinates of the 5 friendly visual cards across the 4 steps */
const MORPH_NODE_COORDS: {
  id: string;
  label: string;
  file: string;
  color: string;
  pos: { x: number; y: number; scale?: number }[];
}[] = [
  {
    id: "url",
    label: "Home Page",
    file: "pages/home.js (Line 14)",
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
    label: "Login Check",
    file: "login/check.js (Line 24)",
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
    label: "Main Brain",
    file: "app/main.js (Line 88)",
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
    label: "Payment Box",
    file: "shop/pay.js (Line 41)",
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
    label: "Saved Users",
    file: "data/users.js (Line 62)",
    color: "#a855f7",
    pos: [
      { x: 84, y: 76, scale: 0.92 },
      { x: 74, y: 70, scale: 1 },
      { x: 80, y: 68, scale: 1.04 },
      { x: 80, y: 66, scale: 1.08 },
    ],
  },
];

/* "Follow the Story" Beginner-Friendly Step Chains */
const THREAD_CHAINS = [
  {
    id: "login",
    trigger: "When someone logs in",
    nodes: [
      {
        step: "01",
        role: "On the Screen",
        name: "Login Box",
        line: "Line 12",
        note: "Where a user types their email and password.",
      },
      {
        step: "02",
        role: "Quick Check",
        name: "Password Checker",
        line: "Line 24",
        note: "Checks if the email and password match.",
      },
      {
        step: "03",
        role: "Stay Signed In",
        name: "Welcome Pass",
        line: "Line 40",
        note: "Gives the browser a pass so they stay logged in.",
      },
      {
        step: "04",
        role: "Saved List",
        name: "User Storage",
        line: "Line 68",
        note: "Saves their login time in the user list.",
      },
    ],
  },
  {
    id: "payment",
    trigger: "When someone buys an item",
    nodes: [
      {
        step: "01",
        role: "Click Button",
        name: "Buy Now Button",
        line: "Line 15",
        note: "Customer clicks Pay Now at checkout.",
      },
      {
        step: "02",
        role: "Charge Card",
        name: "Payment Helper",
        line: "Line 53",
        note: "Safely processes the card payment.",
      },
      {
        step: "03",
        role: "Send Email",
        name: "Receipt Sender",
        line: "Line 31",
        note: "Emails a receipt to the customer.",
      },
      {
        step: "04",
        role: "Save Order",
        name: "Order History",
        line: "Line 94",
        note: "Adds the purchase to their account page.",
      },
    ],
  },
  {
    id: "search",
    trigger: "When you ask a question",
    nodes: [
      {
        step: "01",
        role: "Ask Anything",
        name: "Question Box",
        line: "Line 10",
        note: "You type a normal question in plain English.",
      },
      {
        step: "02",
        role: "Smart Search",
        name: "Map Scanner",
        line: "Line 32",
        note: "Finds the exact files related to your question.",
      },
      {
        step: "03",
        role: "Check Links",
        name: "Connection Finder",
        line: "Line 48",
        note: "Sees what other pages connect to those files.",
      },
      {
        step: "04",
        role: "Plain Answer",
        name: "Simple Guide",
        line: "Line 75",
        note: "Explains the answer clearly and links to the line.",
      },
    ],
  },
];

const BEGINNER_FAQS: FAQItemData[] = [
  {
    id: "01",
    question: "Do I need to install anything to use DevLens?",
    answer:
      "Not at all. Everything runs right in your browser. Just copy a GitHub link, paste it in, and your visual map is ready in about 7 seconds.",
  },
  {
    id: "02",
    question: "I'm new to coding—will this help me understand a big project?",
    answer:
      "Yes! That is exactly why DevLens exists. Instead of opening hundreds of confusing folders, you get a clean visual map and a chat helper that explains how things work in plain English.",
  },
  {
    id: "03",
    question: "Does DevLens keep or save my code?",
    answer:
      "No. DevLens only reads your project long enough to draw your visual map, and then immediately clears the files from memory.",
  },
  {
    id: "04",
    question: "What programming languages work with DevLens?",
    answer:
      "All popular languages—including JavaScript, TypeScript, Python, Java, Go, Rust, Ruby, and PHP—work right out of the box.",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   HERO INTERACTIVE MAGIC LENS COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function InteractiveXRayLens() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [lensPos, setLensPos] = useState<{ x: number; y: number }>({ x: 54, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  // Gentle movement when the user isn't moving the mouse
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
      {/* Top Friendly Instruction Pill */}
      <div className="hwc-xray-bar">
        <span className="mf-mono">
          <span className="hwc-pulse-dot" /> MOVE YOUR MOUSE HERE TO TURN MESSY FILES INTO A VISUAL MAP
        </span>
        <span className="mf-mono hwc-xray-coords">MAGIC LENS ACTIVE</span>
      </div>

      {/* LAYER 1: Confusing File Names (Outside the Lens) */}
      <div className="hwc-xray-raw-layer" aria-hidden="true">
        {LENS_ITEMS.map((item) => (
          <div
            key={item.id}
            className="hwc-raw-snippet mf-mono"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            <div className="hwc-raw-file">confusing file</div>
            <code>{item.raw}</code>
          </div>
        ))}
      </div>

      {/* LAYER 2: Friendly Visual Map (Inside the Moving Circle!) */}
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
        <span className="hwc-lens-badge mf-mono">DEVLENS VIEW</span>
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

  // Interactive "Follow the Story" state
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
          00 · EDITORIAL HERO + INTERACTIVE MAGIC LENS
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
            <Pill live>How DevLens Works · Ready in 7 Seconds</Pill>
            <span className="mf-mono mf-muted">PASTE A LINK // GET A VISUAL MAP</span>
          </motion.div>

          <div className="hwc-hero-split">
            <motion.h1
              className="mf-mega hwc-hero-mega"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              Turn messy code into{" "}
              <span className="mf-serif-i">
                <MorphText
                  words={["clarity.", "pictures.", "answers.", "stories."]}
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
                New to a codebase? Move your mouse over the box below. DevLens works like a magic magnifying glass—turning hundreds of confusing files into a clean visual map anyone can understand.
              </p>
            </motion.div>
          </div>

          {/* Interactive Magic Lens */}
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
          01 · DARK INTERACTIVE 4-STEP STORY (0.0s TO 7.4s)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section mf-dark" data-theme="dark">
        <div className="mf-wrap">
          <div className="mf-sec-bar">
            <span className="idx">[01 / 4 SIMPLE STEPS]</span>
            <Pill>How It Works</Pill>
            <span className="tag">CLICK ANY STEP TO WATCH</span>
          </div>

          <div className="hwc-theatre">
            {/* Left: Friendly Story + Step Buttons */}
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

              {/* Step Selector Pills */}
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
                        <span>STEP {ph.step}</span>
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

            {/* Right: Live Animated Visual Canvas */}
            <div className="hwc-theatre-canvas">
              <div className="hwc-canvas-chrome mf-mono">
                <span>LIVE PREVIEW // STEP {currentPhase.step} OF 04</span>
                <button
                  type="button"
                  className="hwc-autoplay-btn mf-mono"
                  onClick={() => setAutoCycle((v) => !v)}
                >
                  {autoCycle ? "❚❚ PAUSE" : "▶ AUTO-PLAY"}
                </button>
              </div>

              <div className="hwc-morph-stage">
                {/* Ambient Topic Circles in Step 2+ */}
                {phaseIdx >= 1 && (
                  <div className="hwc-domain-halos" aria-hidden="true">
                    <div className="hwc-halo h1" />
                    <div className="hwc-halo h2" />
                  </div>
                )}

                {/* Connection Lines in Step 3 & 4 */}
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

                {/* Floating Visual Topic Cards */}
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

                {/* Step 01 Center Link Pill */}
                {phaseIdx === 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="hwc-center-pill mf-mono"
                  >
                    github.com/vercel/next.js
                  </motion.div>
                )}

                {/* Step 04 Friendly Answer Bubble */}
                {phaseIdx === 3 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="hwc-copilot-toast"
                  >
                    <div className="mf-mono" style={{ fontSize: "0.64rem", color: "#10b981" }}>
                      ✓ CLEAR ANSWER · EXACT FILE FOUND
                    </div>
                    <div style={{ fontSize: "0.86rem", color: "#fff", marginTop: 4 }}>
                      “Users sign in through the <code>Login Check</code> card inside{" "}
                      <span style={{ color: "#10b981" }}>login/check.js (Line 24)</span>.”
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          02 · "FOLLOW ANY ACTION" — STEP-BY-STEP STORY (LIGHT)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section" data-theme="light">
        <div className="mf-wrap">
          <div className="mf-sec-bar">
            <span className="idx">[02 / FOLLOW ANY ACTION]</span>
            <Pill>Step-by-Step Story</Pill>
            <span className="tag">SEE HOW ONE CLICK TRAVELS THROUGH AN APP</span>
          </div>

          <div className="hwc-thread-head">
            <Reveal>
              <h2 className="mf-h1" style={{ maxWidth: "13em", margin: 0 }}>
                Pick an everyday action.{" "}
                <span className="mf-serif-i" style={{ fontWeight: 400 }}>
                  Watch how it works.
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

          {/* Interactive 4-Step Story Cards */}
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
                    <span>STEP {hop.step}</span>
                    <span className="hwc-hop-role">{hop.role}</span>
                  </div>
                  <div className="hwc-hop-name">{hop.name}</div>
                  <p className="hwc-hop-note">{hop.note}</p>
                  <div className="hwc-hop-line mf-mono">
                    <span>↳ EXACT SPOT</span>
                    <strong>{hop.line}</strong>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* 2 Simple, Friendly Promise Cards */}
          <div className="hwc-promise-grid">
            <Reveal>
              <div className="hwc-promise-card hwc-promise-card--dark">
                <span className="mf-mono" style={{ fontSize: "0.68rem", color: "#10b981" }}>
                  100% SAFE &amp; PRIVATE
                </span>
                <h3>Your code stays private and temporary.</h3>
                <p>
                  We only read your project long enough to draw your visual map, then immediately clear it from memory. Nothing is saved on our computers—ever.
                </p>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="hwc-promise-card hwc-promise-card--light">
                <span className="mf-mono" style={{ fontSize: "0.68rem", color: "var(--mf-ink-3)" }}>
                  NO GUESSWORK
                </span>
                <h3>Real answers, never made up.</h3>
                <p>
                  Every time DevLens explains how a feature works, it points you to the exact file and line number so you can see the real code for yourself.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          03 · BEGINNER FAQ + ONE-CLICK PROJECT LAUNCHER
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section" data-theme="light" style={{ paddingTop: 0 }}>
        <div className="mf-wrap">
          <Reveal>
            <FAQSection items={BEGINNER_FAQS} />
          </Reveal>

          <Reveal>
            <div className="hwc-finale">
              <div>
                <Pill live>Ready in About 7 Seconds</Pill>
                <h2 className="mf-h1" style={{ margin: "18px 0 0", fontSize: "clamp(2.2rem, 4.8vw, 4.2rem)" }}>
                  Try it on a project{" "}
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
                    placeholder="owner/project or paste link"
                    aria-label="GitHub project link"
                    spellCheck={false}
                  />
                  <button type="submit" className="mf-btn">
                    Explore <span className="mf-arrow">↗</span>
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
