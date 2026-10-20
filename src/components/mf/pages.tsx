import { Link } from "@tanstack/react-router";
import { PageHero, Pill, Reveal, SiteLayout } from "./site-layout";

/* ═══ FEATURES ═══════════════════════════════════════════════════════ */
const DETAIL = [
  { n: "01", t: "Architecture map", d: "Every file becomes a node, every import an edge. Nodes are clustered by package and sized by coupling, so the load-bearing files are obvious at a glance.", pts: ["Force-directed layout with module hulls", "Complexity & coupling scores per node", "Blast-radius highlight on selection", "Export to Mermaid, PlantUML or JSON"] },
  { n: "02", t: "Code flow", d: "Pick an entry point and follow the call path down to the data layer. Step forward and back to see how a request actually moves.", pts: ["Entry-point detection", "Hop-by-hop stepper", "Cycle and hotspot flags", "Deep link to any step"] },
  { n: "03", t: "Drift timeline", d: "Track architectural shifts and dependency blast radius across Git commit history. Spot regressions and structural decay before merging.", pts: ["Commit-by-commit timeline stepper", "Automated drift risk ratings (Low/Mod/High)", "Dependency delta & touched files breakdown", "One-click AI copilot architectural audits"] },
  { n: "04", t: "Ask DevLens", d: "A streaming copilot grounded in the parsed repository. Mention files with @ to pin context, and every answer lists its sources.", pts: ["Citations to file and line", "@mention to force context", "Suggested questions per repo", "Conversation memory per session"] },
  { n: "05", t: "Onboarding doc", d: "A readable guide generated from the graph: architecture overview, invariants, critical files and the traps to avoid.", pts: ["Markdown you can ship to your wiki", "Updates when you re-index", "Copy-ready code snippets", "Share by link"] },
];

export function FeaturesPage() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Features" title={<>Everything you need to <span className="mf-serif-i">understand</span> a repo.</>} lead="Five views over one parsed representation of your code — so the map, the flow, the drift, the answers and the docs never disagree." />
      <section style={{ paddingBottom: "clamp(72px,10vw,144px)" }}>
        <div className="mf-wrap">
          {DETAIL.map((f, i) => (
            <Reveal key={f.n}>
              <div className="mf-grid c2" style={{ borderTop: "1px solid var(--mf-line)", padding: "48px 0", gap: 48 }}>
                <div>
                  <span className="mf-num">{f.n}</span>
                  <h2 className="mf-h1" style={{ marginTop: 16 }}>{f.t}</h2>
                </div>
                <div>
                  <p className="mf-lead">{f.d}</p>
                  <ul className="mf-list" style={{ marginTop: 28 }}>{f.pts.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              </div>
            </Reveal>
          ))}
          <div style={{ borderTop: "1px solid var(--mf-line)", paddingTop: 40 }}>
            <Link to="/dashboard" className="mf-btn">Try it on a repo <span className="mf-arrow">↗</span></Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

/* ═══ HOW IT WORKS ═══════════════════════════════════════════════════ */
const PIPE = [
  ["Clone", "A shallow clone on an ephemeral worker. Private repos use your GitHub token, never ours."],
  ["Parse file tree", "Languages are detected, vendored and generated files are skipped, entry points are located."],
  ["Build dependency graph", "Imports are resolved per language into edges; cycles and hubs are measured."],
  ["Generate architecture map", "Nodes are laid out, clustered into modules and scored for coupling and complexity."],
  ["Index for Q&A", "Chunks are embedded so the copilot can retrieve the right files for every question."],
];

export function HowItWorksPage() {
  return (
    <SiteLayout>
      <PageHero eyebrow="How it works" title={<>Five stages. <span className="mf-serif-i">Streamed</span> live.</>} lead="You watch every stage complete in real time over a WebSocket. When the last one lands, the workspace opens." />
      <section className="mf-section mf-dark" style={{ paddingTop: "clamp(48px,6vw,80px)" }}>
        <div className="mf-wrap">
          {PIPE.map(([t, d], i) => (
            <Reveal key={t}>
              <div className="mf-step">
                <span className="mf-step-n" style={{ color: "#5a5a5a" }}>0{i + 1}</span>
                <h3 className="mf-h2">{t}</h3>
                <p className="mf-lead">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="mf-section">
        <div className="mf-wrap" style={{ textAlign: "center" }}>
          <Pill live>Ready when you are</Pill>
          <h2 className="mf-h1" style={{ margin: "24px auto 32px", maxWidth: "10em" }}>Run the pipeline on your repo.</h2>
          <Link to="/dashboard" className="mf-btn">Open dashboard <span className="mf-arrow">↗</span></Link>
        </div>
      </section>
    </SiteLayout>
  );
}

/* ═══ PRICING ════════════════════════════════════════════════════════ */
const PLANS = [
  { name: "Explorer", price: "$0", per: "forever", feat: ["5 public repos / month", "Architecture map & code flow", "Ask DevLens (50 questions)", "Mermaid export"], cta: "Start free", ink: false },
  { name: "Builder", price: "$19", per: "per month", feat: ["Unlimited public repos", "Private repos via GitHub", "Unlimited questions", "Onboarding doc generation", "Share links"], cta: "Go Builder", ink: true },
  { name: "Team", price: "$49", per: "per seat / month", feat: ["Everything in Builder", "Shared workspaces", "SSO & audit log", "Priority indexing", "Dedicated support"], cta: "Talk to us", ink: false },
];

export function PricingPage() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Pricing" title={<>Simple, <span className="mf-serif-i">honest</span> pricing.</>} lead="Start free. Upgrade when your team starts mapping more than a repo a week." />
      <section style={{ paddingBottom: "clamp(72px,10vw,144px)" }}>
        <div className="mf-wrap">
          <div className="mf-grid c3">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 90}>
                <div className={`mf-card ${p.ink ? "ink" : ""}`} style={{ minHeight: 480, height: "100%", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="mf-h3">{p.name}</span>
                      {p.ink && <Pill>Popular</Pill>}
                    </div>
                    <div><div className="mf-price">{p.price}</div><div className="mf-mono mf-muted" style={{ marginTop: 8 }}>{p.per}</div></div>
                    <ul className="mf-list">{p.feat.map((f) => <li key={f}>{f}</li>)}</ul>
                  </div>
                  <Link to="/dashboard" className={`mf-btn ${p.ink ? "inv" : "ghost"}`}>{p.cta} <span className="mf-arrow">↗</span></Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
