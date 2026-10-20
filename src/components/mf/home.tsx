import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Pill, Reveal, SiteLayout } from "./site-layout";

const TRY = ["facebook/react", "vercel/next.js", "tailwindlabs/tailwindcss", "fastapi/fastapi"];

const FEATURES = [
  { n: "01", t: "Architecture map", d: "A live dependency graph of every module, clustered by package, with coupling and complexity scored per node." },
  { n: "02", t: "Code flow", d: "Trace a request from entry point to data layer. Scrub through the call path one hop at a time." },
  { n: "03", t: "Drift timeline", d: "Step through commit history to assess blast radius, dependency deltas, and architectural drift before shipping." },
  { n: "04", t: "Ask DevLens", d: "A copilot grounded in the parsed AST. Every answer cites the files it came from." },
  { n: "05", t: "Onboarding doc", d: "A generated walkthrough: what matters, what's fragile, and where to start reading." },
];

const STEPS = [
  { t: "Paste a repo", d: "Any public GitHub URL — or connect GitHub for private ones." },
  { t: "We parse it", d: "Clone, build the file tree, resolve imports and construct the dependency graph." },
  { t: "You explore", d: "Navigate the map, trace flows, and interrogate the codebase in plain English." },
];

const MARQUEE = ["React", "Next.js", "FastAPI", "Django", "Rails", "Express", "Laravel", "Spring", "Svelte", "Vue", "Nest", "Go-Gin"];

const FAQ = [
  ["Does DevLens store my code?", "Repositories are cloned to an ephemeral worker, indexed, and discarded. Only the derived graph and embeddings are kept for your session."],
  ["Which languages are supported?", "TypeScript, JavaScript, Python, Go, Java, Rust, Ruby and PHP resolve imports natively. Everything else still gets a file tree and Q&A."],
  ["Can I analyze private repositories?", "Yes. Connect GitHub from the dashboard and grant read access to the repos you choose."],
  ["How long does analysis take?", "Most repos finish in under eight seconds. Very large monorepos take longer, and progress streams live."],
];

function Marquee() {
  const items = [...MARQUEE, ...MARQUEE];
  return (
    <div className="mf-marquee" aria-hidden>
      <div className="mf-marquee-track">{items.map((m, i) => <span key={i}>{m}</span>)}</div>
    </div>
  );
}

/* Mini graph used inside the product frame */
function MiniGraph() {
  const nodes = [
    [60, 70], [150, 40], [150, 120], [250, 80], [250, 170], [340, 40], [340, 130], [430, 90], [120, 200], [220, 250],
  ];
  const edges = [[0,1],[0,2],[1,3],[2,3],[2,4],[3,5],[3,6],[6,7],[4,6],[2,8],[8,9],[4,9]];
  return (
    <svg viewBox="0 0 500 300" width="100%" height="100%" role="img" aria-label="Sample dependency graph">
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="rgba(255,255,255,.28)" strokeWidth="1" />
      ))}
      {nodes.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={i === 3 ? 12 : 7} fill={i === 3 ? "#fff" : "#0a0a0a"} stroke="#fff" strokeWidth="1.5" />
          {i === 3 && <circle cx={x} cy={y} r="22" fill="none" stroke="rgba(255,255,255,.35)" strokeDasharray="3 4" />}
        </g>
      ))}
    </svg>
  );
}

function ProductFrame() {
  return (
    <div className="mf-frame">
      <div className="mf-frame-bar"><i /><i /><i /><span className="mf-mono">devlens / vercel-next.js / main</span></div>
      <div className="mf-frame-body">
        <div>
          <div className="mf-mono" style={{ color: "#8a8a8a", marginBottom: 12 }}>Files</div>
          {["packages/next", "  src/server", "    router.ts", "    app-render.tsx", "  src/client", "  src/lib", "packages/create-next-app", "examples"].map((f, i) => (
            <div key={i} style={{ fontFamily: "var(--mf-mono)", fontSize: 12, padding: "5px 8px", borderRadius: 6, whiteSpace: "pre", background: i === 3 ? "#262626" : "transparent", color: i === 3 ? "#fff" : "#9a9a9a" }}>{f}</div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill dot={false}>Architecture</Pill><span className="mf-pill" style={{ opacity: .5 }}>Code flow</span><span className="mf-pill" style={{ opacity: .5 }}>Drift timeline</span><span className="mf-pill" style={{ opacity: .5 }}>Onboarding</span>
          </div>
          <div style={{ flex: 1, minHeight: 260 }}><MiniGraph /></div>
        </div>
        <div>
          <div className="mf-mono" style={{ color: "#8a8a8a", marginBottom: 12 }}>Ask DevLens</div>
          <div style={{ background: "#171717", borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.45, marginBottom: 10 }}>What breaks if I delete router.ts?</div>
          <div style={{ border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.5, color: "#d4d4d4" }}>
            <strong style={{ color: "#fff" }}>14 direct imports</strong> break. AppRouter and DevServer lose their routing layer; 9 of 14 consumer paths have no tests.
            <div className="mf-mono" style={{ marginTop: 10, color: "#8a8a8a" }}>↳ server/router.ts · app-render.tsx</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const [repo, setRepo] = useState("");

  const go = (value: string) => {
    const raw = value.trim();
    if (!raw) { navigate({ to: "/dashboard" }); return; }
    navigate({ to: "/dashboard", search: { repo: raw.startsWith("http") ? raw : `https://github.com/${raw}` } });
  };

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="mf-hero">
        <div className="mf-hero-grid-bg" />
        <div className="mf-wrap">
          <div className="mf-hero-top">
            <Pill live>Now indexing public &amp; private repos</Pill>
            <span className="mf-mono mf-muted">Est. 2026 · Map · Trace · Ask</span>
          </div>
          <h1 className="mf-mega">
            See the <span className="mf-serif-i">shape</span><br />of any codebase.
          </h1>
          <div className="mf-hero-foot">
            <div style={{ flex: "1 1 520px" }}>
              <p className="mf-lead" style={{ marginBottom: 28 }}>
                DevLens turns a GitHub repository into an interactive architecture map, traceable code flows and a copilot that cites its sources — in under eight seconds.
              </p>
              <form className="mf-ingest" onSubmit={(e) => { e.preventDefault(); go(repo); }}>
                <span className="mf-mono mf-muted">github.com/</span>
                <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo" aria-label="Repository" spellCheck={false} />
                <button className="mf-btn" type="submit">Analyze <span className="mf-arrow">↗</span></button>
              </form>
              <div className="mf-chips">
                {TRY.map((t) => <button key={t} type="button" className="mf-pill mf-chip" onClick={() => go(t)}>{t}</button>)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mf-big-stat">&lt;8s</div>
              <div className="mf-mono mf-muted" style={{ marginTop: 10 }}>Median time to first map</div>
            </div>
          </div>
        </div>
      </section>

      <div className="mf-wrap" style={{ paddingBottom: 72 }}>
        <Reveal><ProductFrame /></Reveal>
      </div>

      <Marquee />

      {/* Features index */}
      <section className="mf-section">
        <div className="mf-wrap">
          <div className="mf-sec-head">
            <Reveal><h2 className="mf-h1" style={{ maxWidth: "9em" }}>Four lenses on one repository.</h2></Reveal>
            <Link to="/features" className="mf-btn ghost">All features <span className="mf-arrow">↗</span></Link>
          </div>
          <div>
            {FEATURES.map((f) => (
              <Link to="/features" key={f.n} className="mf-row">
                <span className="mf-num">{f.n}</span>
                <span className="mf-row-title">{f.t}</span>
                <span className="mf-body">{f.d}</span>
                <span className="mf-arrow" style={{ fontSize: 24 }}>↗</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bento */}
      <section className="mf-section" style={{ paddingTop: 0 }}>
        <div className="mf-wrap">
          <div className="mf-grid c3">
            {[
              ["14×", "faster onboarding to a new service, measured against reading the source cold."],
              ["9/14", "consumer paths flagged without tests when you ask what a file's blast radius is."],
              ["0", "lines of your code retained after the session ends."],
            ].map(([a, b], i) => (
              <Reveal key={a} delay={i * 90}>
                <div className={`mf-card ${i === 1 ? "ink" : "soft"}`} style={{ height: "100%", justifyContent: "space-between" }}>
                  <div className="mf-big-stat">{a}</div>
                  <p className="mf-body" style={{ maxWidth: "22em" }}>{b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="mf-section mf-dark">
        <div className="mf-wrap">
          <div className="mf-sec-head">
            <Reveal><Pill>Process</Pill></Reveal>
            <Reveal><h2 className="mf-h1" style={{ maxWidth: "9em" }}>From URL to understanding in three moves.</h2></Reveal>
          </div>
          {STEPS.map((s, i) => (
            <Reveal key={s.t}>
              <div className="mf-step">
                <span className="mf-step-n">0{i + 1}</span>
                <h3 className="mf-h2">{s.t}</h3>
                <p className="mf-lead">{s.d}</p>
              </div>
            </Reveal>
          ))}
          <div style={{ marginTop: 40 }}>
            <Link to="/how-it-works" className="mf-btn inv">See the pipeline <span className="mf-arrow">↗</span></Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mf-section">
        <div className="mf-wrap" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.6fr)", gap: 48 }}>
          <div>
            <Pill>FAQ</Pill>
            <h2 className="mf-h1" style={{ marginTop: 24 }}>Questions, answered.</h2>
          </div>
          <div>
            {FAQ.map(([q, a]) => (
              <details className="mf-faq" key={q}>
                <summary>{q}</summary>
                <p className="mf-body">{a}</p>
              </details>
            ))}
            <div className="mf-faq" />
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
