import { useEffect, useRef, useState } from "react";

// ── Real-ish repo names + star counts ──────────────────────────────────────────
const REPOS = [
  "vercel/next.js ★ 128k",
  "facebook/react ★ 228k",
  "microsoft/vscode ★ 163k",
  "torvalds/linux ★ 183k",
  "denoland/deno ★ 95k",
  "rust-lang/rust ★ 98k",
  "golang/go ★ 124k",
  "sveltejs/svelte ★ 79k",
  "nestjs/nest ★ 67k",
  "remix-run/remix ★ 30k",
  "vitejs/vite ★ 68k",
  "astro-build/astro ★ 47k",
  "shadcn-ui/ui ★ 72k",
  "trpc/trpc ★ 35k",
  "supabase/supabase ★ 73k",
  "prisma/prisma ★ 39k",
  "tailwindlabs/tailwindcss ★ 83k",
  "tanstack/query ★ 42k",
  "pmndrs/zustand ★ 48k",
  "redwoodjs/redwood ★ 17k",
];

// ── Count-up hook ──────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1800, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return val;
}

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView, threshold]);
  return { ref, inView };
}

// ── Ticker row ────────────────────────────────────────────────────────────────
function TickerRow({ reverse = false }: { reverse?: boolean }) {
  // Duplicate for seamless loop
  const items = [...REPOS, ...REPOS];
  return (
    <div className="overflow-hidden py-2 mask-gradient-x">
      <div
        className="flex gap-8 whitespace-nowrap"
        style={{
          animation: `ticker-${reverse ? "reverse" : "forward"} 40s linear infinite`,
        }}
      >
        {items.map((r, i) => (
          <span
            key={i}
            className="font-mono text-[13px] text-zinc-600 shrink-0 px-3 py-1 rounded border border-zinc-800/60 bg-zinc-900/30"
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Stats row ─────────────────────────────────────────────────────────────────
function StatItem({ value, label, inView }: { value: number; label: string; inView: boolean }) {
  const count = useCountUp(value, 1800, inView);
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="font-mono text-3xl font-semibold text-white tabular-nums">
        {count.toLocaleString()}
      </div>
      <div className="font-mono text-[11px] uppercase tracking-widest text-zinc-600">
        {label}
      </div>
    </div>
  );
}

// ── Terminal confession ────────────────────────────────────────────────────────
const CONFESSION_LINES = [
  { text: "$ git clone https://github.com/acme/platform", color: "#555" },
  { text: "# 4 days later...", color: "#333" },
  { text: "$ grep -r 'authMiddleware' . | wc -l", color: "#555" },
  { text: "312", color: "#444" },
  { text: "# still no idea what actually breaks if we change it", color: "#333" },
  { text: "$ git log --oneline src/auth/ | head -20", color: "#555" },
  { text: "# 47 commits. no docs. no tests. 3 authors, all quit.", color: "#333" },
  { text: "", color: "" },
  { text: "$ devlens connect github.com/acme/platform", color: "#888" },
  { text: "▸ CLONING...", color: "#00E5A0" },
  { text: "▸ PARSING 4,812 FILES...", color: "#00E5A0" },
  { text: "▸ BUILDING DEPENDENCY GRAPH...", color: "#00E5A0" },
  { text: "INDEXED IN 7.2s. ASK ANYTHING.", color: "#00E5A0" },
];

function TerminalConfession() {
  const { ref, inView } = useInView(0.1);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (revealed >= CONFESSION_LINES.length) return;
    const delay = revealed < 8 ? 120 : revealed < 12 ? 80 : 200;
    const t = setTimeout(() => setRevealed((v) => v + 1), delay);
    return () => clearTimeout(t);
  }, [inView, revealed]);

  return (
    <section className="py-24 bg-[#0A0A0A]">
      <div className="mx-auto max-w-4xl px-6 lg:px-12">
        <div className="font-mono text-[11px] uppercase tracking-widest text-zinc-700 mb-10">
          02 / TERMINAL_CONFESSION
        </div>
        <div
          ref={ref}
          className="rounded-xl overflow-hidden border border-zinc-800/60 bg-[#0c0c0e]"
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/60">
            <span className="size-3 rounded-full bg-[#FF5F57]" />
            <span className="size-3 rounded-full bg-[#FEBC2E]" />
            <span className="size-3 rounded-full bg-[#28C840]" />
            <span className="ml-4 font-mono text-[11px] text-zinc-600">
              every_team_ever.sh
            </span>
          </div>
          <div className="p-6 space-y-1 min-h-[280px]">
            {CONFESSION_LINES.slice(0, revealed).map((line, i) => (
              <div
                key={i}
                className={`font-mono text-[12px] leading-relaxed ${
                  i === revealed - 1 && i < CONFESSION_LINES.length - 1
                    ? "after:content-['▌'] after:animate-pulse"
                    : ""
                }`}
                style={{ color: line.color || "transparent" }}
              >
                {line.text || "\u00a0"}
                {i === CONFESSION_LINES.length - 1 && (
                  <span
                    className="ml-1 inline-block bg-[#00E5A0]"
                    style={{
                      width: 7,
                      height: 14,
                      verticalAlign: "text-bottom",
                      animation: "blink-cursor 1s steps(2) infinite",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function HeroExtras() {
  const { ref: statsRef, inView: statsInView } = useInView(0.3);

  return (
    <>
      <style>{`
        @keyframes ticker-forward {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes ticker-reverse {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
        @keyframes blink-cursor {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .mask-gradient-x {
          -webkit-mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
          mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
        }
      `}</style>

      {/* Terminal Confession */}
      <TerminalConfession />

      {/* Repo Ticker */}
      <section className="py-16 bg-[#0A0A0A] overflow-hidden border-y border-zinc-900">
        <div className="font-mono text-[11px] uppercase tracking-widest text-zinc-700 mb-6 text-center">
          Repos already analyzed
        </div>
        <div className="space-y-2">
          <TickerRow />
          <TickerRow reverse />
        </div>
      </section>

      {/* Stats Row */}
      <section className="py-20 bg-[#0A0A0A] border-b border-zinc-900">
        <div
          ref={statsRef}
          className="mx-auto max-w-4xl px-6 grid grid-cols-2 md:grid-cols-4 gap-10"
        >
          <StatItem value={14203} label="Repos Analyzed" inView={statsInView} />
          <StatItem value={8} label="Avg Seconds" inView={statsInView} />
          <StatItem value={2100000} label="Files Parsed" inView={statsInView} />
          <StatItem value={10000} label="Engineers Using" inView={statsInView} />
        </div>
        <p className="mt-10 text-center font-mono text-[11px] text-zinc-800">
          // TypeScript #1 language · React #1 framework · Growing
        </p>
      </section>
    </>
  );
}
