import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingFlow,
  head: () => ({
    meta: [{ title: "Get Started — DevLens AI" }],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" },
    ],
  }),
});

type Step = 1 | 2 | 3;

const STEPS = [
  { num: 1, label: "Welcome" },
  { num: 2, label: "Analysis" },
  { num: 3, label: "Tour" },
];

const ANALYSIS_STEPS = [
  "Cloning repository",
  "Parsing file tree",
  "Building dependency graph",
  "Generating architecture map",
  "Indexing for Q&A",
];

const TOUR_TIPS = [
  { target: "ARCHITECTURE GRAPH", icon: "⬡", text: "This is your architecture map. Click any node to explore connections and see the blast radius of any change.", next: "Next", step: 1 },
  { target: "ASK DEVLENS PANEL", icon: "◈", text: "Ask anything about this repo. DevLens has read every line, every dependency, every pattern.", next: "Next", step: 2 },
  { target: "ONBOARDING DOC TAB", icon: "✦", text: "Switch to Onboarding Doc to get a shareable, GPT-4 generated guide for your team.", next: "Go to Dashboard", step: 3 },
];

/* ── Step Progress ───────────────────────────────────────────────────── */
function StepProgress({ current }: { current: Step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {STEPS.map((s, i) => (
        <div key={s.num} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: s.num === current ? "var(--dl-signal)" : s.num < current ? "var(--dl-text-3)" : "var(--dl-line-2)",
              boxShadow: s.num === current ? "0 0 10px var(--dl-signal)" : "none",
              transition: "all 0.3s ease",
            }} />
            <span className="dl-mono" style={{
              fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase",
              color: s.num === current ? "var(--dl-signal)" : "var(--dl-text-3)",
              transition: "color 0.3s ease",
            }}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{
              width: 28, height: 1, marginInline: 10,
              background: s.num < current ? "rgba(0,214,143,0.25)" : "var(--dl-line-1)",
              transition: "background 0.4s ease",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Welcome Step ────────────────────────────────────────────────────── */
function WelcomeStep({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "clamp(5rem,10vw,8rem) 1.5rem 3rem",
      textAlign: "center",
    }}>
      {/* Signal icon */}
      <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "var(--dl-signal)",
          boxShadow: "0 0 16px var(--dl-signal), 0 0 40px rgba(0,214,143,0.15)",
          animation: "dl-heartbeat 2s ease-in-out infinite",
        }} />
        <span className="dl-mono" style={{ fontSize: "0.625rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dl-text-2)" }}>
          DevLens AI — Ready
        </span>
      </div>

      <h1 className="dl-h1" style={{ maxWidth: "18ch" }}>
        Let's analyze your first repo.
      </h1>
      <p className="dl-body" style={{ maxWidth: "46ch", marginTop: "1rem" }}>
        Paste any GitHub URL to begin. Public repos work instantly.
        Private repos need a secure tunnel.
      </p>

      {/* Input */}
      <form
        onSubmit={e => { e.preventDefault(); onStart(); }}
        style={{ marginTop: "2.5rem", width: "100%", maxWidth: 480 }}
      >
        <div className="dl-input-wrap">
          <span className="dl-mono" style={{ color: "var(--dl-text-3)", fontSize: "0.8125rem", flexShrink: 0 }}>/connect</span>
          <input
            type="text"
            placeholder="github.com/org/repo"
            className="dl-input"
            autoFocus
          />
          <button type="submit" className="dl-btn dl-btn-primary dl-btn-sm">Analyze</button>
        </div>
      </form>

      <div style={{ marginTop: "1.25rem", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        {["Public & Private", "No Install"].map((t, i) => (
          <span key={i} className="dl-mono" style={{ fontSize: "0.625rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dl-text-3)" }}>
            {t}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="dl-mono"
        style={{
          position: "fixed", bottom: 24, right: 24,
          fontSize: "0.6875rem", color: "var(--dl-text-3)",
          background: "none", border: "none", cursor: "pointer",
          letterSpacing: "0.06em", padding: "6px 10px",
          borderRadius: "var(--radius-sm)", transition: "color 0.2s ease",
        }}
      >
        Skip tour →
      </button>
    </div>
  );
}

/* ── Analysis Step ───────────────────────────────────────────────────── */
function AnalysisStep({ onDone }: { onDone: () => void }) {
  const [activeStep, setActiveStep] = useState(0);
  const progressPct = Math.round((activeStep / ANALYSIS_STEPS.length) * 100);

  useEffect(() => {
    if (activeStep >= ANALYSIS_STEPS.length) return;
    const t = setTimeout(() => setActiveStep(s => s + 1), 900);
    return () => clearTimeout(t);
  }, [activeStep]);

  useEffect(() => {
    if (activeStep >= ANALYSIS_STEPS.length) {
      const t = setTimeout(onDone, 800);
      return () => clearTimeout(t);
    }
  }, [activeStep, onDone]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "clamp(5rem,10vw,8rem) 1.5rem",
    }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div className="dl-mono" style={{ fontSize: "0.625rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dl-signal)", marginBottom: 12 }}>
            FIRST ANALYSIS RUNNING
          </div>
          <h2 className="dl-h3">Your first analysis is running.</h2>
          <p className="dl-body-sm" style={{ marginTop: 8 }}>This will take about 8 seconds.</p>
        </div>

        <div className="dl-terminal">
          <div className="dl-terminal-bar">
            <span className="dl-terminal-dot" style={{ background: "#FF5F57" }} />
            <span className="dl-terminal-dot" style={{ background: "#FEBC2E" }} />
            <span className="dl-terminal-dot" style={{ background: "#28C840" }} />
            <span className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-2)", marginLeft: 8, flex: 1 }}>vercel/next.js</span>
            <span className="dl-mono" style={{ fontSize: "0.625rem", color: "var(--dl-text-3)" }}>
              ~{Math.max(0, ANALYSIS_STEPS.length - activeStep)}s remaining
            </span>
          </div>

          <div style={{ padding: "20px 20px 24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {ANALYSIS_STEPS.map((label, i) => {
                const status = i < activeStep ? "done" : i === activeStep ? "active" : "pending";
                return (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 18, height: 18, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      {status === "done" && (
                        <svg viewBox="0 0 16 16" style={{ width: 14, height: 14 }}>
                          <path d="M3 8.5l3 3 7-7" fill="none" stroke="var(--dl-signal)"
                            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {status === "active" && (
                        <span style={{
                          width: 12, height: 12, borderRadius: "50%",
                          border: "2px solid var(--dl-line-2)",
                          borderTopColor: "var(--dl-signal)",
                          animation: "dl-spin 0.8s linear infinite",
                          display: "inline-block",
                        }} />
                      )}
                      {status === "pending" && (
                        <span style={{ width: 6, height: 6, borderRadius: "50%", border: "1px solid var(--dl-line-2)", display: "inline-block" }} />
                      )}
                    </div>
                    <span className="dl-mono" style={{
                      fontSize: "0.75rem",
                      color: status === "done" ? "var(--dl-text-3)"
                        : status === "active" ? "var(--dl-text-0)"
                          : "var(--dl-text-3)",
                      textDecoration: status === "done" ? "line-through" : "none",
                    }}>
                      {label}{status === "active" && "..."}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div style={{ height: 2, background: "var(--dl-line-1)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: "linear-gradient(to right, var(--dl-signal), rgba(0,214,143,0.7))",
                width: `${progressPct}%`,
                transition: "width 800ms cubic-bezier(0.22,1,0.36,1)",
                boxShadow: "0 0 10px rgba(0,214,143,0.4)",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <span className="dl-mono" style={{ fontSize: "0.6rem", color: "var(--dl-text-3)", letterSpacing: "0.08em" }}>Processing</span>
              <span className="dl-mono" style={{ fontSize: "0.6rem", color: "var(--dl-text-2)" }}>{progressPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tour Step ───────────────────────────────────────────────────────── */
function TourStep({ onComplete }: { onComplete: () => void }) {
  const [tipIndex, setTipIndex] = useState(0);
  const tip = TOUR_TIPS[tipIndex];

  const handleNext = () => {
    if (tipIndex < TOUR_TIPS.length - 1) setTipIndex(tipIndex + 1);
    else onComplete();
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "clamp(5rem,10vw,8rem) 1.5rem 2rem",
    }}>
      {/* Mock dashboard */}
      <div style={{
        width: "100%", maxWidth: 800,
        height: "clamp(300px, 50vh, 420px)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--dl-line-1)",
        background: "var(--dl-raised)",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        {/* Top bar */}
        <div style={{
          height: 44, borderBottom: "1px solid var(--dl-line-1)",
          display: "flex", alignItems: "center", padding: "0 14px", gap: 10, flexShrink: 0,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--dl-signal)", boxShadow: "0 0 8px var(--dl-signal)" }} />
          <span className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-0)" }}>DEVLENS</span>
          <div style={{ width: 1, height: 14, background: "var(--dl-line-1)" }} />
          <span className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-2)" }}>vercel/next.js</span>
          <div style={{ flex: 1 }} />
          {["ARCHITECTURE", "CODE FLOW", "ONBOARDING DOC"].map((tab, i) => (
            <span key={tab} className="dl-mono" style={{
              fontSize: "0.5875rem", letterSpacing: "0.08em",
              color: i === 0 ? "var(--dl-text-0)" : "var(--dl-text-3)",
              padding: "4px 8px", borderRadius: "var(--radius-sm)",
              background: i === 0 ? "var(--dl-edge)" : "transparent",
            }}>{tab}</span>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Sidebar */}
          <div style={{ width: 170, borderRight: "1px solid var(--dl-line-0)", padding: 12, flexShrink: 0 }}>
            {["src/", "  components/", "  hooks/", "  services/", "  utils/", "package.json"].map(f => (
              <div key={f} className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-3)", padding: "3px 0", lineHeight: 1.5 }}>{f}</div>
            ))}
          </div>

          {/* Graph area */}
          <div style={{
            flex: 1, display: "grid", placeItems: "center", position: "relative",
            outline: tipIndex === 0 ? "1px solid rgba(0,214,143,0.2)" : "none",
            transition: "outline-color 0.3s ease",
          }}>
            <svg viewBox="0 0 200 150" style={{ width: "70%", opacity: 0.3 }}>
              <circle cx="100" cy="30" r="14" fill="var(--dl-raised)" stroke="var(--dl-line-2)" strokeWidth="1" />
              <circle cx="60" cy="90" r="14" fill="var(--dl-raised)" stroke="var(--dl-line-2)" strokeWidth="1" />
              <circle cx="140" cy="90" r="14" fill="var(--dl-raised)" stroke="var(--dl-signal)" strokeWidth="1.5" />
              <circle cx="100" cy="140" r="14" fill="var(--dl-raised)" stroke="var(--dl-line-2)" strokeWidth="1" />
              <line x1="100" y1="44" x2="60" y2="76" stroke="var(--dl-line-2)" strokeWidth="0.8" />
              <line x1="100" y1="44" x2="140" y2="76" stroke="var(--dl-signal)" strokeWidth="1" />
              <line x1="60" y1="104" x2="100" y2="126" stroke="var(--dl-line-2)" strokeWidth="0.8" />
            </svg>
          </div>

          {/* Q&A panel */}
          <div style={{
            width: 240, borderLeft: "1px solid var(--dl-line-0)",
            display: "flex", flexDirection: "column",
            outline: tipIndex === 1 ? "1px solid rgba(0,214,143,0.2)" : "none",
            transition: "outline-color 0.3s ease",
          }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--dl-line-0)" }}>
              <span className="dl-mono" style={{ fontSize: "0.625rem", color: "var(--dl-text-2)", letterSpacing: "0.08em" }}>● ASK DEVLENS</span>
            </div>
            <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
              <span className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-3)" }}>Ask anything...</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      <div
        key={tipIndex}
        className="dl-animate-fade-up"
        style={{
          marginTop: 20, width: "100%", maxWidth: 440,
          background: "rgba(0,214,143,0.03)",
          border: "1px solid rgba(0,214,143,0.2)",
          borderRadius: "var(--radius-lg)", padding: 20,
          boxShadow: "0 0 40px rgba(0,214,143,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span className="dl-mono" style={{ color: "var(--dl-signal)", fontSize: "1rem" }}>{tip.icon}</span>
          <span className="dl-mono" style={{ fontSize: "0.5875rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dl-signal)" }}>
            [{tip.step}/3] {tip.target}
          </span>
        </div>
        <p className="dl-body-sm" style={{ marginBottom: 16 }}>{tip.text}</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {TOUR_TIPS.map((_, i) => (
              <span key={i} style={{
                width: 5, height: 5, borderRadius: "50%",
                background: i === tipIndex ? "var(--dl-signal)" : "var(--dl-line-2)",
                transition: "background 0.3s ease",
              }} />
            ))}
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="dl-btn dl-btn-sm"
            style={{ border: "1px solid rgba(0,214,143,0.3)", color: "var(--dl-signal)", background: "transparent" }}
          >
            {tip.next} →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main flow ───────────────────────────────────────────────────────── */
function OnboardingFlow() {
  const [step, setStep] = useState<Step>(1);

  return (
    <div style={{ minHeight: "100vh", background: "var(--dl-base)", fontFamily: "var(--font-sans)", position: "relative" }}>
      {/* Nav */}
      <nav className="dl-nav">
        <div className="dl-nav-inner">
          <Link to="/" className="dl-nav-logo">
            <span className="dl-nav-logo-dot" />
            DEVLENS
            <span style={{ color: "var(--dl-text-3)", fontWeight: 400, fontSize: "0.6rem", letterSpacing: "0.2em" }}>AI</span>
          </Link>
          <div className="dl-nav-links">
            <StepProgress current={step} />
          </div>
        </div>
      </nav>

      <div style={{ paddingTop: 56 }}>
        {step === 1 && (
          <WelcomeStep
            onStart={() => setStep(2)}
            onSkip={() => { window.location.href = "/dashboard"; }}
          />
        )}
        {step === 2 && <AnalysisStep onDone={() => setStep(3)} />}
        {step === 3 && <TourStep onComplete={() => { window.location.href = "/dashboard"; }} />}
      </div>
    </div>
  );
}
