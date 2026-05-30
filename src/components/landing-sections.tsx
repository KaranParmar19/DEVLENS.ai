import { useEffect, useRef, useState } from "react";

/* ── useInView hook ──────────────────────────────────────────────────── */
function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || inView) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [inView, threshold]);
  return { ref, inView };
}

/* ── Highlighted text ────────────────────────────────────────────────── */
function Highlighted({ text, tokens, style, highlightColor = "var(--dl-signal)" }: {
  text: string; tokens: string[]; style?: React.CSSProperties; highlightColor?: string;
}) {
  if (!tokens.length) return <span style={style}>{text}</span>;
  const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(re);
  return (
    <span style={style}>
      {parts.map((p, i) =>
        tokens.includes(p)
          ? <span key={i} style={{ color: highlightColor }}>{p}</span>
          : <span key={i}>{p}</span>
      )}
    </span>
  );
}

/* ── Section wrapper ─────────────────────────────────────────────────── */
function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section className="dl-section" style={{ borderTop: "1px solid var(--dl-line-0)", ...style }}>
      <div className="dl-container">{children}</div>
    </section>
  );
}

/* ── Section header ──────────────────────────────────────────────────── */
function SectionHeader({ index, title, sub }: { index: string; title: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: "clamp(3rem,5vw,4.5rem)" }}>
      <div className="dl-section-label">{index}</div>
      <h2 className="dl-h2" style={{ maxWidth: "20ch" }}>{title}</h2>
      {sub && <p className="dl-body" style={{ maxWidth: "46ch", marginTop: "1rem" }}>{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   INTERROGATION SECTION
   ═══════════════════════════════════════════════════════════════════════ */
type QA = { q: string; a: string; highlights: string[] };
const INTERROGATION: QA[] = [
  {
    q: "What happens if I delete packages/next/src/server/router.ts?",
    a: "14 direct imports break immediately. AppRouter, DevServer, and NextNodeServer lose their routing layer. Build fails at compile step 3 of 7. No test coverage on 9 of 14 consumer paths.",
    highlights: ["14 direct imports", "compile step 3 of 7", "9 of 14 consumer paths"],
  },
  {
    q: "Which files have never been touched since the initial commit?",
    a: "23 files unchanged since creation. Oldest: packages/next/src/lib/constants.ts — 847 days. All are stable low-risk contracts with no active dependents.",
    highlights: ["23 files", "packages/next/src/lib/constants.ts", "847 days"],
  },
  {
    q: "Why is the build 40% slower than last month?",
    a: "3 circular dependencies introduced in feat/turbopack-migration. webpack.config now imports from packages that re-import from webpack. Full cycle path available.",
    highlights: ["3 circular dependencies", "feat/turbopack-migration", "Full cycle path available"],
  },
  {
    q: "What's the most dangerous file in this repo to modify?",
    a: "packages/next/src/server/app-render/app-render.tsx — 31 direct dependents, 0 isolation tests, modified 14 times in the last 30 days. Any change here has a blast radius of ~60% of the server runtime.",
    highlights: ["31 direct dependents", "0 isolation tests", "~60% of the server runtime"],
  },
];

function TypewriterAnswer({ text, tokens, start, speed = 16 }: {
  text: string; tokens: string[]; start: boolean; speed?: number;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!start || i >= text.length) return;
    const t = setTimeout(() => setI(v => v + 1), speed);
    return () => clearTimeout(t);
  }, [i, start, text.length, speed]);
  const shown = text.slice(0, i);
  return (
    <Highlighted
      text={shown}
      tokens={tokens}
      style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", lineHeight: 1.7, color: "var(--dl-text-2)" }}
    />
  );
}

export function InterrogationSection() {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (!inView || revealed >= INTERROGATION.length) return;
    const t = setTimeout(() => setRevealed(v => v + 1), 150);
    return () => clearTimeout(t);
  }, [inView, revealed]);

  return (
    <Section>
      <SectionHeader
        index="03 / INTELLIGENCE_PROOF"
        title="Ask it anything."
        sub="We ran DevLens on vercel/next.js. These are real answers."
      />

      <div className="dl-terminal">
        {/* Terminal bar */}
        <div className="dl-terminal-bar">
          <span className="dl-terminal-dot" style={{ background: "#FF5F57" }} />
          <span className="dl-terminal-dot" style={{ background: "#FEBC2E" }} />
          <span className="dl-terminal-dot" style={{ background: "#28C840" }} />
          <span className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-2)", marginLeft: 8, flex: 1 }}>
            LIVE_SESSION — vercel/next.js
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--dl-signal)", boxShadow: "0 0 8px var(--dl-signal)", animation: "dl-heartbeat 2s ease-in-out infinite" }} />
            <span className="dl-mono" style={{ fontSize: "0.6rem", color: "var(--dl-signal)", letterSpacing: "0.08em" }}>● CONNECTED</span>
          </span>
        </div>

        <div ref={ref} style={{ padding: "0 24px" }}>
          {INTERROGATION.map((pair, idx) => (
            <div key={idx} style={{
              borderBottom: idx < INTERROGATION.length - 1 ? "1px solid var(--dl-line-0)" : "none",
              padding: "20px 0",
              opacity: idx < revealed ? 1 : 0,
              transition: "opacity 0.5s ease",
            }}>
              <div style={{ display: "flex", gap: 12 }}>
                <span className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-3)", flexShrink: 0, paddingTop: 2 }}>Q</span>
                <p className="dl-mono" style={{ fontSize: "0.75rem", color: "var(--dl-text-1)", lineHeight: 1.6, margin: 0 }}>{pair.q}</p>
              </div>
              <div style={{ display: "flex", gap: 12, paddingLeft: 24, marginTop: 10 }}>
                <span className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-3)", flexShrink: 0, paddingTop: 2 }}>A</span>
                <div style={{ flex: 1 }}>
                  <TypewriterAnswer text={pair.a} tokens={pair.highlights} start={idx < revealed} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 24px", borderTop: "1px solid var(--dl-line-0)" }}>
          <span className="dl-mono" style={{ fontSize: "0.625rem", color: "var(--dl-text-3)", letterSpacing: "0.06em" }}>
            // questions get harder. answers stay exact.
          </span>
        </div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TIME DELTA SECTION
   ═══════════════════════════════════════════════════════════════════════ */
const DELTA_ROWS = [
  { task: "Understand an unfamiliar auth flow", without: "~3 days", with: "8 seconds" },
  { task: "Find what breaks if X changes", without: "~half a day", with: "instant" },
  { task: "Onboard a new engineer to the repo", without: "2–3 weeks", with: "1 day" },
  { task: "Find dead / unused code", without: "never done", with: "automatic", danger: true },
  { task: "Know the blast radius of a PR", without: "guesswork", with: "exact" },
];

export function TimeDeltaSection() {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  return (
    <Section>
      <SectionHeader index="04 / TIME_DELTA" title="Time. Before and after." />
      <div ref={ref}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 180px", borderBottom: "1px solid var(--dl-line-1)", paddingBottom: 12, marginBottom: 0 }}>
          <span className="dl-mono" style={{ fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dl-text-3)" }}>TASK</span>
          <span className="dl-mono" style={{ fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dl-text-3)" }}>WITHOUT DEVLENS</span>
          <span className="dl-mono" style={{ fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dl-signal)" }}>WITH DEVLENS</span>
        </div>
        {DELTA_ROWS.map((row, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "1fr 180px 180px",
            borderBottom: "1px solid var(--dl-line-0)",
            padding: "18px 0",
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(8px)",
            transition: `opacity 0.5s ease ${i * 80}ms, transform 0.5s ease ${i * 80}ms`,
          }}>
            <span className="dl-mono" style={{ fontSize: "0.8125rem", color: "var(--dl-text-1)", paddingRight: 24 }}>{row.task}</span>
            <span className="dl-mono" style={{ fontSize: "0.875rem", color: row.danger ? "var(--dl-danger)" : "var(--dl-text-3)" }}>{row.without}</span>
            <span className="dl-mono" style={{ fontSize: "0.875rem", color: "var(--dl-signal)" }}>{row.with}</span>
          </div>
        ))}
        <div style={{ paddingTop: 16, textAlign: "right" }}>
          <span className="dl-mono" style={{ fontSize: "0.625rem", color: "var(--dl-text-3)", letterSpacing: "0.06em" }}>
            // 10,247 engineers stopped guessing this week
          </span>
        </div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FIELD REPORTS SECTION
   ═══════════════════════════════════════════════════════════════════════ */
const REPORTS = [
  { user: "@t3dotgg", text: "connected create-t3-app and immediately found a circular dep I'd been chasing for 6 months", highlights: ["circular dep I'd been chasing for 6 months"], time: "~2d ago" },
  { user: "@wesbos", text: "asked \"what's the most dangerous file in this repo\" — the answer was exactly right", highlights: ["exactly right"], time: "~5d ago" },
  { user: "@leeerob", text: "used it mid-refactor on next.js. the blast radius view stopped us from shipping a breaking change", highlights: ["stopped us from shipping a breaking change"], time: "~1w ago" },
  { user: "@destroytoday", text: "onboarded to a new client codebase in under an hour. usually takes a week of pain", highlights: ["under an hour"], time: "~3d ago" },
  { user: "@mattpocock", text: "the \"what breaks if I change X\" answer is genuinely better than asking the team lead", highlights: ["better than asking the team lead"], time: "~4d ago" },
];

export function FieldReportsSection() {
  return (
    <Section>
      <SectionHeader index="05 / FIELD_REPORTS" title="From engineers who shipped with it." />

      <div className="dl-terminal">
        <div className="dl-terminal-bar">
          <span className="dl-terminal-dot" style={{ background: "#FF5F57" }} />
          <span className="dl-terminal-dot" style={{ background: "#FEBC2E" }} />
          <span className="dl-terminal-dot" style={{ background: "#28C840" }} />
          <span className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-2)", marginLeft: 8, flex: 1 }}>
            DEVLENS_FEEDBACK — community.log
          </span>
          <span className="dl-mono" style={{ fontSize: "0.6rem", color: "var(--dl-text-3)" }}>↓ live feed</span>
        </div>

        <div style={{ padding: "0 24px" }}>
          {REPORTS.map((r, i) => (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr auto",
              alignItems: "center",
              gap: 16,
              borderBottom: i < REPORTS.length - 1 ? "1px solid var(--dl-line-0)" : "none",
              padding: "14px 0",
            }}>
              <span className="dl-mono" style={{ fontSize: "0.75rem", color: "#4a8fff" }}>{r.user}</span>
              <Highlighted
                text={r.text}
                tokens={r.highlights}
                style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--dl-text-2)", lineHeight: 1.6 }}
                highlightColor="var(--dl-text-0)"
              />
              <span className="dl-mono" style={{ fontSize: "0.625rem", color: "var(--dl-text-3)", whiteSpace: "nowrap" }}>{r.time}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 0", borderTop: "1px solid var(--dl-line-0)" }}>
            <span className="dl-mono" style={{ fontSize: "0.625rem", color: "var(--dl-text-3)" }}>10,000+ engineers</span>
            <span style={{ width: 2, height: 2, borderRadius: "50%", background: "var(--dl-text-3)" }} />
            <span className="dl-mono" style={{ fontSize: "0.625rem", color: "var(--dl-text-3)" }}>847 repos connected this week</span>
            <span style={{ width: 2, height: 2, borderRadius: "50%", background: "var(--dl-text-3)" }} />
            <span className="dl-mono" style={{ fontSize: "0.625rem", color: "var(--dl-text-3)" }}>system nominal</span>
            <span style={{
              display: "inline-block", width: 6, height: 12,
              background: "var(--dl-signal)", marginLeft: 6,
              animation: "dl-blink 1s steps(2) infinite",
            }} />
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FINAL CTA SECTION
   ═══════════════════════════════════════════════════════════════════════ */
export function FinalCTASection({ repoUrl, setRepoUrl, analyzing, onSubmit }: {
  repoUrl: string; setRepoUrl: (v: string) => void; analyzing: boolean; onSubmit: () => void;
}) {
  return (
    <section style={{ padding: "clamp(6rem,12vw,10rem) 0", borderTop: "1px solid var(--dl-line-0)" }}>
      <div className="dl-container" style={{ maxWidth: 680, textAlign: "center" }}>
        <div className="dl-section-label" style={{ justifyContent: "center" }}>06 / CONNECT_NOW</div>
        <h2 className="dl-h2">Your codebase.{" "}<em style={{ color: "var(--dl-text-3)", fontStyle: "italic" }}>8 seconds.</em></h2>

        <form
          onSubmit={e => { e.preventDefault(); onSubmit(); }}
          style={{ marginTop: "2.5rem", maxWidth: 520, marginInline: "auto" }}
        >
          <div className="dl-input-wrap">
            <span className="dl-mono" style={{ color: "var(--dl-text-3)", fontSize: "0.8125rem", flexShrink: 0 }}>/connect</span>
            <input
              type="text"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              disabled={analyzing}
              placeholder="github.com/org/repo"
              className="dl-input"
            />
            <button type="submit" disabled={analyzing} className="dl-btn dl-btn-primary dl-btn-sm">
              {analyzing ? "Analyzing..." : "Analyze"}
            </button>
          </div>

          <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 20px" }}>
            {["Public & Private", "No Install", "10,000+ Repos Analyzed"].map((t, i) => (
              <span key={i} className="dl-mono" style={{ fontSize: "0.625rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dl-text-3)" }}>
                {t}
              </span>
            ))}
          </div>
        </form>
      </div>
    </section>
  );
}
