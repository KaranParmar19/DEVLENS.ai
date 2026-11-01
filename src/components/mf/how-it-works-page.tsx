import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Pill, Reveal, SiteLayout } from "./site-layout";
import { MorphText } from "@/components/ui/morph-text";
import { FAQSection, type FAQItemData } from "@/components/ui/faq-section";
import { CardShuffleShowcase } from "@/components/ui/card-shuffle-showcase";
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

  // Repo launcher state
  const [repoInput, setRepoInput] = useState<string>("");

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
              <p className="mf-lead mf-scribble mf-serif-i" style={{ margin: 0 }}>
                <span className="hwc-scribble-q">New to a codebase?</span>
                <span className="hwc-scribble-a">
                  Move your mouse over the box below—DevLens works like a magic magnifying glass, turning hundreds of confusing files into a clean visual map anyone can understand.
                </span>
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
          01 · "FOLLOW ANY ACTION" — STEP-BY-STEP STORY (LIGHT)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section" data-theme="light">
        <div className="mf-wrap">
          <div className="mf-sec-bar">
            <span className="idx">[01 / FOLLOW ANY ACTION]</span>
            <Pill>Step-by-Step Story</Pill>
            <span className="tag">SEE HOW ONE CLICK TRAVELS THROUGH AN APP</span>
          </div>

          <div className="hwc-thread-head" style={{ marginBottom: 20 }}>
            <Reveal>
              <h2 className="mf-h1" style={{ maxWidth: "13em", margin: 0 }}>
                Pick an everyday action.{" "}
                <span className="mf-serif-i" style={{ fontWeight: 400 }}>
                  Watch how it works.
                </span>
              </h2>
            </Reveal>
          </div>

          {/* Interactive Card Shuffle on Scroll Component */}
          <CardShuffleShowcase chains={THREAD_CHAINS} />

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
          02 · BEGINNER FAQ + ONE-CLICK PROJECT LAUNCHER
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
