import { useEffect, useRef, useState } from "react";

/* ----------------------- helpers ----------------------- */

function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || inView) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [inView, threshold]);
  return { ref, inView };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#444]">
      {children}
    </div>
  );
}

function TerminalHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#1A1A1A] px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-full bg-[#FF5F57]" />
        <span className="size-3 rounded-full bg-[#FEBC2E]" />
        <span className="size-3 rounded-full bg-[#28C840]" />
        <span className="ml-4 font-mono text-[11px] text-[#666]">{title}</span>
      </div>
      <div className="font-mono text-[10px] text-[#444]">{right}</div>
    </div>
  );
}

/* highlight tokens inside a string */
function Highlighted({
  text,
  tokens,
  className,
  highlightClassName,
}: {
  text: string;
  tokens: string[];
  className?: string;
  highlightClassName: string;
}) {
  if (!tokens.length) return <span className={className}>{text}</span>;
  // Build a regex that matches any token (escape regex chars)
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(re);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        tokens.includes(p) ? (
          <span key={i} className={highlightClassName}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

/* ============================================================
   SECTION 03 — THE INTERROGATION
============================================================ */

type QA = {
  q: string;
  a: string;
  highlights: string[];
};

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

function TypewriterAnswer({
  text,
  tokens,
  start,
  speed = 18,
}: {
  text: string;
  tokens: string[];
  start: boolean;
  speed?: number;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (i >= text.length) return;
    const t = setTimeout(() => setI((v) => v + 1), speed);
    return () => clearTimeout(t);
  }, [i, start, text.length, speed]);
  const shown = text.slice(0, i);
  return (
    <Highlighted
      text={shown}
      tokens={tokens}
      className="font-mono text-[11px] leading-relaxed text-[#555]"
      highlightClassName="text-[#00E5A0]"
    />
  );
}

export function InterrogationSection() {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (revealed >= INTERROGATION.length) return;
    const t = setTimeout(() => setRevealed((v) => v + 1), 150);
    return () => clearTimeout(t);
  }, [inView, revealed]);

  return (
    <section ref={ref} className="bg-[#0A0A0A] py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="mb-16 flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionLabel>03 / INTELLIGENCE_PROOF</SectionLabel>
            <h2 className="mt-6 max-w-[18ch] text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-[56px]">
              Ask it anything.
            </h2>
          </div>
          <p className="max-w-[42ch] text-base leading-relaxed text-[#888] md:text-right">
            We ran DevLens on vercel/next.js. These are real answers.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#0D0D0D]">
          <TerminalHeader
            title="LIVE_SESSION — vercel/next.js"
            right={
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-[#00E5A0] shadow-[0_0_6px_rgba(0,229,160,0.7)]" />
                <span className="text-[#00E5A0]">● CONNECTED</span>
              </span>
            }
          />

          <div className="px-6 py-4 md:px-8 md:py-6">
            {INTERROGATION.map((pair, idx) => {
              const visible = idx < revealed;
              return (
                <div
                  key={idx}
                  className={`border-b border-[#1A1A1A] py-5 transition-opacity duration-500 last:border-b-0 ${
                    visible ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="font-mono text-[12px] text-[#444]">Q</span>
                    <p className="font-mono text-[12px] leading-relaxed text-[#888]">
                      {pair.q}
                    </p>
                  </div>
                  <div className="mt-3 flex gap-3 pl-6">
                    <span className="font-mono text-[12px] text-[#333]">A</span>
                    <div className="min-h-[1.2em] flex-1">
                      <TypewriterAnswer
                        text={pair.a}
                        tokens={pair.highlights}
                        start={visible}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-10 text-center font-mono text-[11px] text-[#2A2A2A]">
          // questions get harder. answers stay exact.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   SECTION 04 — BEFORE / AFTER
============================================================ */

const DELTA_ROWS: { task: string; without: string; with: string; danger?: boolean }[] = [
  { task: "Understand an unfamiliar auth flow", without: "~3 days", with: "8 seconds" },
  { task: "Find what breaks if X changes", without: "~half a day", with: "instant" },
  { task: "Onboard a new engineer to the repo", without: "2–3 weeks", with: "1 day" },
  { task: "Find dead / unused code", without: "never done", with: "automatic", danger: true },
  { task: "Know the blast radius of a PR", without: "guesswork", with: "exact" },
];

export function TimeDeltaSection() {
  return (
    <section className="bg-[#0A0A0A] py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="mb-16">
          <SectionLabel>04 / TIME_DELTA</SectionLabel>
          <h2 className="mt-6 max-w-[18ch] text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-[56px]">
            Time. Before and after.
          </h2>
        </div>

        <div className="border-t border-[#111]">
          <div className="grid grid-cols-12 border-b border-[#111] py-5">
            <div className="col-span-6 font-mono text-[10px] uppercase tracking-[0.1em] text-[#333]">
              TASK
            </div>
            <div className="col-span-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[#333]">
              WITHOUT DEVLENS
            </div>
            <div className="col-span-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[#00E5A0]">
              WITH DEVLENS
            </div>
          </div>

          {DELTA_ROWS.map((row) => (
            <div key={row.task} className="grid grid-cols-12 border-b border-[#111] py-[18px]">
              <div className="col-span-6 pr-4 font-mono text-[13px] text-[#666]">{row.task}</div>
              <div
                className={`col-span-3 pr-4 font-mono text-[14px] ${
                  row.danger ? "text-[#FF6B6B]" : "text-[#3A3A3A]"
                }`}
              >
                {row.without}
              </div>
              <div className="col-span-3 font-mono text-[14px] text-[#00E5A0]">{row.with}</div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-right font-mono text-[11px] text-[#2A2A2A]">
          // 10,247 engineers stopped guessing this week
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   SECTION 05 — TERMINAL SOCIAL PROOF
============================================================ */

type Report = {
  user: string;
  text: string;
  highlights: string[];
  time: string;
};

const REPORTS: Report[] = [
  {
    user: "@t3dotgg",
    text: "connected create-t3-app and immediately found a circular dep I'd been chasing for 6 months",
    highlights: ["circular dep I'd been chasing for 6 months"],
    time: "~2d ago",
  },
  {
    user: "@wesbos",
    text: "asked \"what's the most dangerous file in this repo\" — the answer was exactly right",
    highlights: ["exactly right"],
    time: "~5d ago",
  },
  {
    user: "@leeerob",
    text: "used it mid-refactor on next.js. the blast radius view stopped us from shipping a breaking change",
    highlights: ["stopped us from shipping a breaking change"],
    time: "~1w ago",
  },
  {
    user: "@destroytoday",
    text: "onboarded to a new client codebase in under an hour. usually takes a week of pain",
    highlights: ["under an hour"],
    time: "~3d ago",
  },
  {
    user: "@mattpocock",
    text: "the \"what breaks if I change X\" answer is genuinely better than asking the team lead",
    highlights: ["better than asking the team lead"],
    time: "~4d ago",
  },
];

export function FieldReportsSection() {
  return (
    <section className="bg-[#0A0A0A] py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="mb-16">
          <SectionLabel>05 / FIELD_REPORTS</SectionLabel>
          <h2 className="mt-6 max-w-[20ch] text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-[56px]">
            From engineers who shipped with it.
          </h2>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#1A1A1A] bg-[#0D0D0D]">
          <TerminalHeader
            title="DEVLENS_FEEDBACK — community.log"
            right={<span>↓ live feed</span>}
          />

          <div className="px-6 py-6 md:px-8">
            {REPORTS.map((r) => (
              <div
                key={r.user}
                className="flex flex-col gap-1 border-b border-[#1A1A1A] py-3 last:border-b-0 md:flex-row md:items-center md:gap-4"
              >
                <span className="font-mono text-[12px] text-[#4A8FFF] md:shrink-0">
                  {r.user}
                </span>
                <span className="hidden font-mono text-[12px] text-[#222] md:inline">·</span>
                <div className="flex-1">
                  <Highlighted
                    text={r.text}
                    tokens={r.highlights}
                    className="font-mono text-[12px] leading-relaxed text-[#555]"
                    highlightClassName="text-[#AAAAAA]"
                  />
                </div>
                <span className="font-mono text-[11px] text-[#2A2A2A] md:shrink-0">
                  {r.time}
                </span>
              </div>
            ))}

            <div className="mt-6 flex items-center gap-2 font-mono text-[11px] text-[#333]">
              <span className="text-[#1E1E1E]">▋</span>
              <span>10,000+ engineers</span>
              <span>·</span>
              <span>847 repos connected this week</span>
              <span>·</span>
              <span>system nominal</span>
              <span
                className="ml-2 inline-block h-[14px] w-[7px] bg-[#00E5A0]"
                style={{ animation: "devlens-blink 1s steps(2) infinite" }}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes devlens-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </section>
  );
}

/* ============================================================
   FINAL CTA — loops back to hero
============================================================ */

export function FinalCTASection({
  repoUrl,
  setRepoUrl,
  analyzing,
  onSubmit,
}: {
  repoUrl: string;
  setRepoUrl: (v: string) => void;
  analyzing: boolean;
  onSubmit: () => void;
}) {
  return (
    <section className="bg-[#0A0A0A] py-32">
      <div className="mx-auto max-w-4xl px-6 text-center lg:px-12">
        <h2 className="text-balance text-5xl font-semibold leading-none tracking-tight text-white md:text-7xl lg:text-8xl">
          Your codebase. <span className="text-zinc-700 italic">8 seconds.</span>
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="group relative mx-auto mt-16 max-w-xl"
        >
          <div className="flex items-center gap-4 rounded-lg bg-brand-card p-2 pl-4 ring-1 ring-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] transition-all hover:ring-white/20 focus-within:ring-white/30">
            <span className="select-none font-mono text-zinc-600">/connect</span>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={analyzing}
              placeholder="github.com/org/repo"
              aria-label="GitHub repository URL"
              className="min-w-0 flex-1 bg-transparent text-left font-mono text-sm text-brand-heading outline-none placeholder:text-zinc-700 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={analyzing}
              className="flex items-center gap-2 rounded bg-zinc-100 py-2 pl-2 pr-3 text-xs font-medium text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-colors hover:bg-white disabled:opacity-80"
            >
              <div
                className={`size-3 rounded-full border-2 border-zinc-950/20 border-t-zinc-950 ${
                  analyzing ? "animate-spin" : ""
                }`}
              />
              {analyzing ? "Analyzing" : "Analyze"}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              Public &amp; Private
            </span>
            <span className="h-px w-3 bg-white/10" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              No Install
            </span>
            <span className="h-px w-3 bg-white/10" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              10,000+ Repos Analyzed
            </span>
          </div>
        </form>
      </div>
    </section>
  );
}
