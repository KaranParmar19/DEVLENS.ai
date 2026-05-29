import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingFlow,
  head: () => ({
    meta: [{ title: "Get Started — DevLens AI" }],
  }),
});

type Step = 1 | 2 | 3;

const STEPS_META = [
  { label: "Welcome", num: 1 },
  { label: "First Analysis", num: 2 },
  { label: "Dashboard Tour", num: 3 },
];

const ANALYSIS_STEPS = [
  "Cloning repo",
  "Parsing file tree",
  "Building dependency graph",
  "Generating architecture map",
  "Indexing for Q&A",
];

const TOUR_TIPS = [
  {
    target: "ARCHITECTURE GRAPH",
    icon: "⬡",
    text: "This is your architecture map. Click any node to explore connections and see blast radius.",
    next: "Next →",
    step: 1,
  },
  {
    target: "ASK DEVLENS PANEL",
    icon: "◈",
    text: "Ask anything about this repo. DevLens has read every line, every dependency, every pattern.",
    next: "Next →",
    step: 2,
  },
  {
    target: "ONBOARDING DOC TAB",
    icon: "✦",
    text: "Switch to Onboarding Doc to get a shareable, GPT-4 generated guide for your team.",
    next: "Got it",
    step: 3,
  },
];

function StepDots({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-3">
      {STEPS_META.map((s) => (
        <div
          key={s.num}
          className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest"
          style={{ color: s.num === current ? "#00E5A0" : s.num < current ? "#2a2a2a" : "#222" }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{
              background: s.num === current ? "#00E5A0" : s.num < current ? "#2a2a2a" : "#1a1a1a",
              boxShadow: s.num === current ? "0 0 8px rgba(0,229,160,0.5)" : "none",
            }}
          />
          {s.label}
        </div>
      ))}
    </div>
  );
}

function WelcomeStep({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] px-6 text-center">
      {/* Logo */}
      <div className="font-mono text-[11px] uppercase tracking-widest text-zinc-600 mb-8">
        DEVLENS_V2
      </div>
      <div className="mb-2">
        <span className="size-3 rounded-full bg-[#00E5A0] inline-block shadow-[0_0_12px_rgba(0,229,160,0.6)]" />
      </div>

      <h1 className="text-5xl font-semibold text-white tracking-tight mt-6">
        Let's analyze your first repo.
      </h1>
      <p className="mt-6 text-base text-zinc-500 max-w-xl">
        Paste any GitHub URL to begin. Public repos work instantly. Private repos need a secure tunnel.
      </p>

      {/* Input bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); onStart(); }}
        className="mt-12 w-full max-w-lg"
      >
        <div className="flex items-center gap-4 bg-[#111] p-2 pl-4 rounded-lg border border-zinc-800 focus-within:border-[#00E5A0] transition-colors shadow-[0_0_0_0_rgba(0,229,160,0)] focus-within:shadow-[0_0_16px_rgba(0,229,160,0.12)]">
          <span className="font-mono text-zinc-600 text-sm select-none">/connect</span>
          <input
            type="text"
            placeholder="github.com/org/repo"
            className="flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-zinc-700"
            autoFocus
          />
          <button
            type="submit"
            className="bg-zinc-100 text-zinc-950 font-medium text-xs py-2 pl-2 pr-3 rounded flex items-center gap-2 hover:bg-white transition-colors"
          >
            Analyze
          </button>
        </div>
      </form>

      <div className="mt-6 flex items-center gap-6">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-700">Public & Private</span>
        <span className="h-px w-4 bg-zinc-800" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-700">No Install</span>
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="absolute bottom-8 right-8 font-mono text-[11px] text-zinc-700 hover:text-zinc-500 transition-colors"
      >
        Skip tour →
      </button>
    </div>
  );
}

function AnalysisStep({ onDone }: { onDone: () => void }) {
  const [activeStep, setActiveStep] = useState(0);
  const [progressPct, setProgressPct] = useState(0);

  useEffect(() => {
    if (activeStep >= ANALYSIS_STEPS.length) return;
    const t = setTimeout(() => {
      setActiveStep((s) => s + 1);
      setProgressPct(Math.round(((activeStep + 1) / ANALYSIS_STEPS.length) * 100));
    }, 900);
    return () => clearTimeout(t);
  }, [activeStep]);

  useEffect(() => {
    if (activeStep >= ANALYSIS_STEPS.length) {
      const t = setTimeout(onDone, 800);
      return () => clearTimeout(t);
    }
  }, [activeStep, onDone]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] px-6">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="font-mono text-[11px] uppercase tracking-widest text-[#00E5A0] mb-2">
            FIRST ANALYSIS RUNNING
          </div>
          <h2 className="text-2xl font-semibold text-white">
            Your first analysis is running.
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            This will take about 8 seconds.
          </p>
        </div>

        <div className="rounded-xl bg-[#0c0c0e] border border-zinc-800/60 p-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="font-mono text-sm text-white">vercel/next.js</div>
            <div className="font-mono text-[10px] text-zinc-500">
              ~{Math.max(0, ANALYSIS_STEPS.length - activeStep)}s remaining
            </div>
          </div>

          <div className="space-y-3 mb-8">
            {ANALYSIS_STEPS.map((label, i) => {
              const status = i < activeStep ? "done" : i === activeStep ? "active" : "pending";
              return (
                <div key={label} className="flex items-center gap-3">
                  <div className="size-5 grid place-items-center shrink-0">
                    {status === "done" && (
                      <svg viewBox="0 0 16 16" className="size-4">
                        <path d="M3 8.5l3 3 7-7" fill="none" stroke="#00E5A0"
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {status === "active" && (
                      <span className="size-3 rounded-full border-2 border-zinc-700 border-t-[#00E5A0] animate-spin" />
                    )}
                    {status === "pending" && (
                      <span className="size-2 rounded-full border border-zinc-700" />
                    )}
                  </div>
                  <span className={`text-sm ${
                    status === "done" ? "text-zinc-600 line-through decoration-zinc-800"
                    : status === "active" ? "text-white" : "text-zinc-700"
                  }`}>
                    {label}{status === "active" && "..."}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div>
            <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progressPct}%`,
                  background: "linear-gradient(to right, #00E5A0, #1cf1b1)",
                  transition: "width 800ms cubic-bezier(0.22,1,0.36,1)",
                  boxShadow: "0 0 12px rgba(0,229,160,0.4)",
                }}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-zinc-600">
              <span>Processing</span>
              <span>{progressPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TourStep({ onComplete }: { onComplete: () => void }) {
  const [tipIndex, setTipIndex] = useState(0);
  const tip = TOUR_TIPS[tipIndex];

  const handleNext = () => {
    if (tipIndex < TOUR_TIPS.length - 1) {
      setTipIndex(tipIndex + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] px-6 relative">
      {/* Mock dashboard preview */}
      <div className="w-full max-w-4xl h-[60vh] rounded-xl border border-zinc-800/60 bg-[#0c0c0e] overflow-hidden relative">
        {/* Top bar */}
        <div className="h-12 border-b border-zinc-800/60 flex items-center px-4 gap-3">
          <span className="size-1.5 rounded-full bg-[#00E5A0] shadow-[0_0_6px_rgba(0,229,160,0.5)]" />
          <span className="font-mono text-[11px] text-white">DEVLENS_V2</span>
          <span className="h-4 w-px bg-zinc-800" />
          <span className="font-mono text-[11px] text-zinc-500">repo: vercel/next.js</span>
          <span className="flex-1" />
          <span className="font-mono text-[10px] text-zinc-600 border border-zinc-800 rounded px-2 py-0.5">ARCHITECTURE</span>
          <span className="font-mono text-[10px] text-zinc-700 px-2 py-0.5">CODE FLOW</span>
          <span className="font-mono text-[10px] text-zinc-700 px-2 py-0.5">ONBOARDING DOC</span>
        </div>
        {/* Content */}
        <div className="flex h-full">
          {/* Left */}
          <div className="w-[200px] border-r border-zinc-800/60 p-3">
            <div className="space-y-1">
              {["src/","  components/","  hooks/","  services/","  utils/","package.json"].map(f => (
                <div key={f} className="font-mono text-[11px] text-zinc-700 py-0.5">{f}</div>
              ))}
            </div>
          </div>
          {/* Center — graph */}
          <div className={`flex-1 grid place-items-center relative ${tipIndex === 0 ? "ring-1 ring-[#00E5A0]/30" : ""}`}>
            <div className="text-zinc-800 font-mono text-[11px]">Architecture Graph</div>
            {/* Simple node preview */}
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <svg viewBox="0 0 200 150" className="w-full h-full">
                <circle cx="100" cy="30" r="15" fill="#1C1C1C" stroke="#2A2A2A" />
                <circle cx="60" cy="90" r="15" fill="#1C1C1C" stroke="#2A2A2A" />
                <circle cx="140" cy="90" r="15" fill="#1C1C1C" stroke="#00E5A0" strokeWidth="2" />
                <circle cx="100" cy="140" r="15" fill="#1C1C1C" stroke="#2A2A2A" />
                <line x1="100" y1="45" x2="60" y2="75" stroke="#333" />
                <line x1="100" y1="45" x2="140" y2="75" stroke="#00E5A0" strokeWidth="1.5" />
                <line x1="60" y1="105" x2="100" y2="125" stroke="#333" />
              </svg>
            </div>
          </div>
          {/* Right */}
          <div className={`w-[280px] border-l border-zinc-800/60 flex flex-col ${tipIndex === 1 ? "ring-1 ring-[#00E5A0]/30" : ""}`}>
            <div className="p-3 border-b border-zinc-800/60 font-mono text-[10px] text-zinc-600">● ASK DEVLENS</div>
            <div className="flex-1 grid place-items-center text-zinc-800 font-mono text-[11px]">
              Ask anything...
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      <div
        key={tipIndex}
        className="mt-6 max-w-md w-full rounded-lg p-5 border border-[#00E5A0]/40 bg-[#0c1a14] shadow-[0_0_30px_rgba(0,229,160,0.08)]"
        style={{ animation: "dl-fade-up 300ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[#00E5A0] text-lg">{tip.icon}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#00E5A0]">
            [{tip.step}/3] {tip.target}
          </span>
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed mb-4">{tip.text}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {TOUR_TIPS.map((_, i) => (
              <span
                key={i}
                className="size-1.5 rounded-full transition-colors"
                style={{ background: i === tipIndex ? "#00E5A0" : "#2A2A2A" }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="font-mono text-[11px] text-[#00E5A0] hover:text-white transition-colors border border-[#00E5A0]/30 px-3 py-1.5 rounded"
          >
            {tip.next}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Onboarding Flow ──────────────────────────────────────────────────────
function OnboardingFlow() {
  const [step, setStep] = useState<Step>(1);

  return (
    <div className="relative min-h-screen bg-[#09090b] font-sans">
      <style>{`
        @keyframes dl-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Step indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
        <StepDots current={step} />
      </div>

      {step === 1 && (
        <WelcomeStep
          onStart={() => setStep(2)}
          onSkip={() => window.location.href = "/"}
        />
      )}
      {step === 2 && <AnalysisStep onDone={() => setStep(3)} />}
      {step === 3 && <TourStep onComplete={() => { window.location.href = "/"; }} />}
    </div>
  );
}
