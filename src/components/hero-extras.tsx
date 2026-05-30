import { useEffect, useRef, useState } from "react";

const REPOS = [
  "vercel/next.js ★ 128k","facebook/react ★ 228k","microsoft/vscode ★ 163k",
  "torvalds/linux ★ 183k","denoland/deno ★ 95k","rust-lang/rust ★ 98k",
  "golang/go ★ 124k","sveltejs/svelte ★ 79k","nestjs/nest ★ 67k",
  "remix-run/remix ★ 30k","vitejs/vite ★ 68k","astro-build/astro ★ 47k",
  "shadcn-ui/ui ★ 72k","trpc/trpc ★ 35k","supabase/supabase ★ 73k",
  "prisma/prisma ★ 39k","tailwindlabs/tailwindcss ★ 83k","tanstack/query ★ 42k",
];

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

function TickerRow({ reverse = false }: { reverse?: boolean }) {
  const items = [...REPOS, ...REPOS];
  return (
    <div className="dl-mask-x" style={{ overflow: "hidden", padding: "4px 0" }}>
      <div style={{ display: "flex", gap: 10, whiteSpace: "nowrap",
        animation: `${reverse ? "dl-ticker-rev" : "dl-ticker-fwd"} 50s linear infinite` }}>
        {items.map((r, i) => (
          <span key={i} className="dl-mono" style={{
            fontSize: "0.6875rem", color: "var(--dl-text-2)", flexShrink: 0,
            padding: "5px 12px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--dl-line-1)", background: "var(--dl-raised)",
            letterSpacing: "0.02em",
          }}>{r}</span>
        ))}
      </div>
    </div>
  );
}

const CONFESSION_LINES = [
  { text: "$ git clone https://github.com/acme/platform", color: "var(--dl-text-2)" },
  { text: "# 4 days later...", color: "var(--dl-text-3)" },
  { text: "$ grep -r 'authMiddleware' . | wc -l", color: "var(--dl-text-2)" },
  { text: "312", color: "var(--dl-text-2)" },
  { text: "# still no idea what actually breaks if we change it", color: "var(--dl-text-3)" },
  { text: "$ git log --oneline src/auth/ | head -20", color: "var(--dl-text-2)" },
  { text: "# 47 commits. no docs. no tests. 3 authors, all quit.", color: "var(--dl-text-3)" },
  { text: "", color: "" },
  { text: "$ devlens connect github.com/acme/platform", color: "var(--dl-text-1)" },
  { text: "▸ CLONING...", color: "var(--dl-signal)" },
  { text: "▸ PARSING 4,812 FILES...", color: "var(--dl-signal)" },
  { text: "▸ BUILDING DEPENDENCY GRAPH...", color: "var(--dl-signal)" },
  { text: "INDEXED IN 7.2s. ASK ANYTHING.", color: "var(--dl-signal)" },
];

function TerminalConfession() {
  const { ref, inView } = useInView(0.1);
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (!inView || revealed >= CONFESSION_LINES.length) return;
    const delay = revealed < 8 ? 120 : revealed < 12 ? 80 : 200;
    const t = setTimeout(() => setRevealed(v => v + 1), delay);
    return () => clearTimeout(t);
  }, [inView, revealed]);

  return (
    <section className="dl-section" style={{ borderTop: "1px solid var(--dl-line-0)" }}>
      <div className="dl-container">
        <div className="dl-section-label">02 / TERMINAL_CONFESSION</div>
        <div ref={ref} className="dl-terminal">
          <div className="dl-terminal-bar">
            <span className="dl-terminal-dot" style={{ background: "#FF5F57" }} />
            <span className="dl-terminal-dot" style={{ background: "#FEBC2E" }} />
            <span className="dl-terminal-dot" style={{ background: "#28C840" }} />
            <span className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-2)", marginLeft: 8 }}>every_team_ever.sh</span>
          </div>
          <div style={{ padding: "20px 24px", minHeight: 260 }}>
            {CONFESSION_LINES.slice(0, revealed).map((line, i) => (
              <div key={i} className="dl-mono" style={{
                fontSize: "0.75rem", lineHeight: 1.8,
                color: line.color || "transparent",
              }}>
                {line.text || "\u00a0"}
                {i === revealed - 1 && i < CONFESSION_LINES.length - 1 && (
                  <span style={{ animation: "dl-blink 1s steps(2) infinite" }}>▌</span>
                )}
                {i === CONFESSION_LINES.length - 1 && (
                  <span style={{
                    display: "inline-block", width: 6, height: 13, marginLeft: 3,
                    background: "var(--dl-signal)", verticalAlign: "text-bottom",
                    animation: "dl-blink 1s steps(2) infinite",
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatItem({ value, label, suffix, inView }: { value: number; label: string; suffix: string; inView: boolean }) {
  const count = useCountUp(value, 1800, inView);
  const display = value >= 1000000
    ? `${(count / 1000000).toFixed(1)}M`
    : value >= 1000
    ? `${(count / 1000).toFixed(1)}k`
    : `${count}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="dl-mono" style={{
        fontSize: "clamp(1.75rem, 4vw, 2.75rem)", fontWeight: 700,
        color: "var(--dl-text-0)", letterSpacing: "-0.03em", lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}>
        {display}{suffix}
      </div>
      <div className="dl-label" style={{ marginBottom: 0 }}>{label}</div>
    </div>
  );
}

export function HeroExtras() {
  const { ref: statsRef, inView: statsInView } = useInView(0.3);
  const stats = [
    { value: 14203, label: "Repos Analyzed", suffix: "" },
    { value: 8, label: "Avg Seconds", suffix: "s" },
    { value: 2100000, label: "Files Parsed", suffix: "+" },
    { value: 10000, label: "Engineers Using", suffix: "+" },
  ];

  return (
    <>
      <TerminalConfession />

      {/* Ticker */}
      <section style={{ borderTop: "1px solid var(--dl-line-0)", borderBottom: "1px solid var(--dl-line-0)", padding: "2.5rem 0" }}>
        <div className="dl-container">
          <div className="dl-label" style={{ marginBottom: "1rem", marginLeft: 0 }}>Repos already analyzed</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <TickerRow />
          <TickerRow reverse />
        </div>
      </section>

      {/* Stats */}
      <section className="dl-section" style={{ borderBottom: "1px solid var(--dl-line-0)" }}>
        <div className="dl-container">
          <div ref={statsRef} style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: "clamp(2rem,4vw,4rem)",
          }}>
            {stats.map(s => <StatItem key={s.label} {...s} inView={statsInView} />)}
          </div>
        </div>
      </section>
    </>
  );
}

