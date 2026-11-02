import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Pill, Reveal, SiteLayout } from "./site-layout";
import { MorphText } from "@/components/ui/morph-text";
import { FAQSection, type FAQItemData } from "@/components/ui/faq-section";
import { CardShuffleShowcase } from "@/components/ui/card-shuffle-showcase";

/* ═══════════════════════════════════════════════════════════════════════════
   BEGINNER-FRIENDLY INTERACTIVE DATA (PLAIN, SIMPLE ENGLISH)
   ═══════════════════════════════════════════════════════════════════════════ */

/* Nodes inside the Hero Magic Lens */
const LENS_ITEMS = [
  {
    id: "n1",
    raw: "folder_1 / check_password_v2.js",
    clean: "User Login",
    cluster: "Checks passwords",
    x: 18,
    y: 26,
    color: "#ffffff",
  },
  {
    id: "n2",
    raw: "old_files / signup_helper_final.js",
    clean: "Sign-Up Page",
    cluster: "Welcomes new users",
    x: 34,
    y: 62,
    color: "#ffffff",
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

/* Verified Architecture Flow Chains (True, Grounded Engineering Data) */
const THREAD_CHAINS = [
  {
    id: "login",
    trigger: "When someone logs in",
    nodes: [
      {
        step: "01",
        role: "Client Ingress",
        name: "Form Validation & CSRF Guard",
        line: "src/routes/auth/login.tsx:42",
        note: "Parses credentials against strict Zod schemas and validates anti-CSRF token nonces before asynchronous network dispatch.",
      },
      {
        step: "02",
        role: "AST Route Resolver",
        name: "Tree-Sitter Symbol Linker",
        line: "backend/core/ast_parser.py:118",
        note: "Traverses concrete syntax trees in-memory, resolving cross-module bindings between TypeScript routes and backend authentication endpoints.",
      },
      {
        step: "03",
        role: "DAG Dependency Engine",
        name: "Cyclomatic Blast Radius",
        line: "backend/core/graph_engine.py:204",
        note: "Computes directed acyclic call edges, determining upstream importers, downstream mutation risks, and pinpointing every file touching session state.",
      },
      {
        step: "04",
        role: "Verified Citation",
        name: "Zero-Retention Code Dossier",
        line: "backend/rag/vector_store.py:89",
        note: "Constructs an audited architecture dossier with exact file and line citations, clearing ephemeral clone buffers immediately upon session close.",
      },
    ],
  },
  {
    id: "payment",
    trigger: "When someone buys an item",
    nodes: [
      {
        step: "01",
        role: "Checkout Ingress",
        name: "Idempotent Intent Dispatch",
        line: "src/features/checkout/api.ts:31",
        note: "Generates an idempotent request key and dispatches client payment parameters to the Stripe API gateway over TLS 1.3.",
      },
      {
        step: "02",
        role: "Webhook Guard",
        name: "HMAC Signature Verification",
        line: "server/routes/webhooks.py:54",
        note: "Computes HMAC-SHA256 digest on raw payload bytes, rejecting unsigned replay requests before passing to the event dispatcher.",
      },
      {
        step: "03",
        role: "Transactional Ledger",
        name: "Postgres Serializable Commit",
        line: "server/db/order_store.py:88",
        note: "Executes serializable database transaction: decrements inventory stock, writes immutable ledger entry, and commits order state.",
      },
      {
        step: "04",
        role: "Event Streaming",
        name: "Kafka Async Fulfillment",
        line: "server/events/producer.py:112",
        note: "Publishes order.fulfilled event to Kafka message partition, triggering background receipt generation and warehouse dispatch.",
      },
    ],
  },
  {
    id: "search",
    trigger: "When you ask a question",
    nodes: [
      {
        step: "01",
        role: "Semantic Ingress",
        name: "Query Vector Normalization",
        line: "backend/rag/retriever.py:36",
        note: "Normalizes query intent and converts prompt tokens into a 1536-dimensional embedding vector via OpenAI text-embedding-3-small.",
      },
      {
        step: "02",
        role: "Vector Index",
        name: "HNSW Cosine Distance Probe",
        line: "backend/rag/vector_store.py:72",
        note: "Executes high-dimensional similarity probe `<=>` in pgvector, retrieving the 6 highest-scoring AST code chunks.",
      },
      {
        step: "03",
        role: "Graph Reasoning",
        name: "Topological Blast Radius",
        line: "backend/agent/devlens_agent.py:145",
        note: "Traverses NetworkX call hierarchy to locate all dependent modules affected by the cited function or interface change.",
      },
      {
        step: "04",
        role: "Grounded Synthesis",
        name: "Line-Cited Answer",
        line: "backend/agent/synthesizer.py:210",
        note: "Streams the answer over WebSocket and links every explanation to clickable file and line numbers.",
      },
    ],
  },
];

const BEGINNER_FAQS: FAQItemData[] = [
  {
    id: "01",
    question: "Do I need to install anything to use DevLens?",
    answer:
      "No. Everything runs in your browser. Paste a GitHub link and your dependency map is ready in a few seconds.",
  },
  {
    id: "02",
    question: "I'm new to coding. Will this help me understand a big project?",
    answer:
      "Yes. Instead of clicking through dozens of folders by hand, you get a visual map of how files connect and a Q&A view that explains features in plain English.",
  },
  {
    id: "03",
    question: "Does DevLens keep or save my code?",
    answer:
      "No. DevLens clones your repository into a temporary folder to build the map and deletes the files when your session ends.",
  },
  {
    id: "04",
    question: "What programming languages work with DevLens?",
    answer:
      "JavaScript, TypeScript, Python, Java, Go, Rust, Ruby, and PHP resolve imports and symbols out of the box.",
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
          <span className="hwc-pulse-dot" /> Move your cursor here to preview the dependency map
        </span>
        <span className="mf-mono hwc-xray-coords">Interactive preview</span>
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
              stroke="#ffffff"
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
        <span className="hwc-lens-badge mf-mono">DevLens view</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HOW IT WORKS PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export function HowItWorksPage() {
  return (
    <SiteLayout>
      {/* 00. Hero + Interactive Lens */}
      <section className="mf-hero" data-theme="light" style={{ paddingBottom: "clamp(20px, 2.5vw, 36px)" }}>
        <div className="mf-wrap">
          <motion.div
            className="mf-hero-top"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Pill live>How DevLens works</Pill>
            <span className="mf-mono mf-muted">From GitHub URL to interactive map</span>
          </motion.div>

          <div className="hwc-hero-split">
            <motion.h1
              className="mf-mega hwc-hero-mega"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              Turn messy code into{" "}
              <MorphText
                words={["clarity.", "pictures.", "answers.", "stories."]}
                morphTime={1.1}
                holdTime={1.9}
                strength={8}
              />
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
                  Move your cursor over the box below to see how DevLens groups raw files into a readable dependency map.
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

      {/* 01. Step-by-Step Story */}
      <section className="mf-section" data-theme="light" style={{ paddingTop: "clamp(20px, 2.5vw, 36px)", paddingBottom: 0 }}>
        <div className="mf-wrap">
          <div className="hwc-thread-head" style={{ textAlign: "center", maxWidth: "44em", margin: "0 auto clamp(24px, 3.5vw, 36px)" }}>
            <Reveal>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <Pill live>Request trace</Pill>
                <span className="mf-mono" style={{ fontSize: "0.72rem", color: "var(--mf-ink-3)" }}>
                  Step-by-step call path
                </span>
              </div>
              <h2 className="mf-h1" style={{ margin: "0 auto", fontSize: "clamp(2rem, 3.8vw, 3.2rem)", lineHeight: 1.15 }}>
                Pick an everyday action.{" "}
                <span className="mf-serif-i" style={{ fontWeight: 400, color: "var(--mf-ink-3, #767676)" }}>
                  Watch how it runs.
                </span>
              </h2>
            </Reveal>
          </div>
        </div>

        {/* Full-Screen Card Shuffle on Scroll */}
        <CardShuffleShowcase chains={THREAD_CHAINS} />

        <div className="mf-wrap" style={{ marginTop: "clamp(24px, 3.5vw, 44px)", marginBottom: 0 }}>
          {/* 2 Promise Cards */}
          <div className="hwc-promise-grid">
            <Reveal>
              <div className="hwc-promise-card hwc-promise-card--dark">
                <span className="mf-mono" style={{ fontSize: "0.72rem", color: "#ffffff" }}>
                  Temporary clone
                </span>
                <h3>Your code stays private and temporary.</h3>
                <p>
                  We only read your project long enough to draw your dependency map, then delete the temporary clone when your session ends. Nothing is kept on disk.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="hwc-promise-card hwc-promise-card--light">
                <span className="mf-mono" style={{ fontSize: "0.72rem", color: "var(--mf-ink-3)" }}>
                  Line-level links
                </span>
                <h3>Backed by your actual source lines.</h3>
                <p>
                  Every time DevLens explains how a feature works, it points to the exact file and line number so you can check the source code yourself.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          02 · BEGINNER FAQ
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mf-section" data-theme="light" style={{ paddingTop: "clamp(36px, 4.5vw, 60px)" }}>
        <div className="mf-wrap">
          <Reveal>
            <FAQSection items={BEGINNER_FAQS} />
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}

export default HowItWorksPage;
