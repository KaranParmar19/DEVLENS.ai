import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [{ title: "Pricing — DevLens AI" }],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" },
    ],
  }),
});

type Feature = { text: string; included: boolean };
interface Tier {
  id: string; label: string; name: string;
  monthly: number; annual: number; featured: boolean;
  badge?: string; cta: string; ctaHref: string;
  features: Feature[];
}

const TIERS: Tier[] = [
  {
    id: "free", label: "FREE_TIER", name: "Free",
    monthly: 0, annual: 0, featured: false, cta: "Start Free", ctaHref: "/onboarding",
    features: [
      { text: "Public repos only", included: true },
      { text: "5 analyses / day", included: true },
      { text: "50 Q&A queries / day", included: true },
      { text: "Architecture maps", included: true },
      { text: "Basic onboarding doc", included: true },
      { text: "Private repos", included: false },
      { text: "Code flow tracing", included: false },
      { text: "Export (MD, PDF)", included: false },
      { text: "Shared workspace", included: false },
      { text: "SSO + audit logs", included: false },
    ],
  },
  {
    id: "pro", label: "PRO_TIER", name: "Pro",
    monthly: 19, annual: 15, featured: true, badge: "MOST POPULAR", cta: "Get Pro", ctaHref: "/onboarding",
    features: [
      { text: "Public + Private repos", included: true },
      { text: "Unlimited analyses", included: true },
      { text: "Unlimited Q&A", included: true },
      { text: "Architecture maps", included: true },
      { text: "Full onboarding docs", included: true },
      { text: "Code flow tracing", included: true },
      { text: "Export (MD, PDF, Notion)", included: true },
      { text: "Priority support", included: true },
      { text: "Shared workspace", included: false },
      { text: "SSO + audit logs", included: false },
    ],
  },
  {
    id: "team", label: "TEAM_TIER", name: "Team",
    monthly: 49, annual: 39, featured: false, cta: "Contact Sales", ctaHref: "/",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Shared workspace", included: true },
      { text: "Invite team members", included: true },
      { text: "SSO + audit logs", included: true },
      { text: "Priority support", included: true },
      { text: "Custom retention", included: true },
      { text: "Dedicated onboarding", included: true },
      { text: "SLA guarantees", included: true },
      { text: "Custom integrations", included: true },
      { text: "Volume discounts", included: true },
    ],
  },
];

function FeatureRow({ text, included }: Feature) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "9px 0", borderBottom: "1px solid var(--dl-line-0)",
    }}>
      <span className="dl-mono" style={{
        fontSize: "0.75rem", flexShrink: 0, marginTop: 1,
        color: included ? "var(--dl-signal)" : "var(--dl-text-3)",
      }}>
        {included ? "✓" : "○"}
      </span>
      <span className="dl-mono" style={{
        fontSize: "0.75rem", lineHeight: 1.5,
        color: included ? "var(--dl-text-1)" : "var(--dl-text-3)",
      }}>
        {text}
      </span>
    </div>
  );
}

function TierCard({ tier, annual }: { tier: Tier; annual: boolean }) {
  const price = annual ? tier.annual : tier.monthly;
  return (
    <div className={`dl-tier-card${tier.featured ? " featured" : ""}`}>
      {tier.badge && (
        <div style={{
          position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
          fontFamily: "var(--font-mono)", fontSize: "0.5625rem", letterSpacing: "0.16em",
          padding: "3px 10px", borderRadius: "100px",
          background: "var(--dl-signal)", color: "var(--dl-void)",
          fontWeight: 700, whiteSpace: "nowrap",
        }}>
          {tier.badge}
        </div>
      )}

      {/* Label */}
      <div className="dl-mono" style={{
        fontSize: "0.625rem", letterSpacing: "0.14em", textTransform: "uppercase",
        color: tier.featured ? "var(--dl-signal)" : "var(--dl-text-3)", marginBottom: 20,
      }}>
        {tier.label}
      </div>

      {/* Price */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--dl-text-0)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em" }}>
            ${price}
          </span>
          <span className="dl-mono" style={{ fontSize: "0.75rem", color: "var(--dl-text-3)" }}>
            {price === 0 ? "forever" : tier.id === "team" ? "/mo per seat" : "/mo"}
          </span>
        </div>
        {annual && price > 0 && (
          <div className="dl-mono" style={{ fontSize: "0.625rem", color: "var(--dl-signal)", marginTop: 6, letterSpacing: "0.08em" }}>
            ✦ 2 months free vs monthly
          </div>
        )}
      </div>

      {/* CTA */}
      <Link
        to={tier.ctaHref as "/"}
        style={{
          display: "block", width: "100%", padding: "10px",
          textAlign: "center", borderRadius: "var(--radius-md)",
          fontFamily: "var(--font-mono)", fontSize: "0.6875rem",
          letterSpacing: "0.1em", textTransform: "uppercase",
          textDecoration: "none", marginBottom: 24,
          fontWeight: 600, transition: "all 0.2s ease",
          ...(tier.featured
            ? { background: "var(--dl-signal)", color: "var(--dl-void)", boxShadow: "0 0 24px rgba(0,214,143,0.25)" }
            : { border: "1px solid var(--dl-line-2)", color: "var(--dl-text-1)", background: "transparent" }
          ),
        }}
      >
        {tier.cta}
      </Link>

      <hr style={{ border: "none", borderTop: "1px solid var(--dl-line-0)", marginBottom: 16 }} />

      <div style={{ flex: 1 }}>
        {tier.features.map(f => <FeatureRow key={f.text} {...f} />)}
      </div>
    </div>
  );
}

function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="dl-page" style={{ fontFamily: "var(--font-sans)" }}>
      {/* Nav */}
      <nav className="dl-nav">
        <div className="dl-nav-inner">
          <Link to="/" className="dl-nav-logo">
            <span className="dl-nav-logo-dot" />
            DEVLENS
            <span style={{ color: "var(--dl-text-3)", fontWeight: 400, fontSize: "0.6rem", letterSpacing: "0.2em" }}>AI</span>
          </Link>
          <div className="dl-nav-links">
            <Link to="/" className="dl-nav-link">Home</Link>
            <Link to="/pricing" className="dl-nav-link" data-active="">Pricing</Link>
            <Link to="/onboarding" className="dl-nav-link">Get Started</Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero */}
        <div className="dl-section" style={{ textAlign: "center", borderBottom: "1px solid var(--dl-line-0)" }}>
          <div className="dl-container" style={{ maxWidth: 680 }}>
            <div className="dl-section-label" style={{ justifyContent: "center" }}>PRICING_TIERS</div>
            <h1 className="dl-h1">Simple, honest pricing.</h1>
            <p className="dl-body" style={{ marginTop: "1rem" }}>
              Start free. Upgrade when you need private repos, unlimited queries, or team features.
            </p>

            {/* Toggle */}
            <div style={{
              marginTop: "2rem", display: "inline-flex", alignItems: "center", gap: 2,
              padding: 4, borderRadius: "var(--radius-md)",
              border: "1px solid var(--dl-line-1)", background: "var(--dl-raised)",
            }}>
              <button
                type="button"
                onClick={() => setAnnual(false)}
                className="dl-btn dl-btn-sm"
                style={{
                  background: !annual ? "var(--dl-edge)" : "transparent",
                  color: !annual ? "var(--dl-text-0)" : "var(--dl-text-2)",
                  border: "none",
                }}
              >Monthly</button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                className="dl-btn dl-btn-sm"
                style={{
                  background: annual ? "var(--dl-edge)" : "transparent",
                  color: annual ? "var(--dl-text-0)" : "var(--dl-text-2)",
                  border: "none", display: "flex", alignItems: "center", gap: 6,
                }}
              >
                Annually
                <span className="dl-mono" style={{
                  fontSize: "0.5rem", padding: "2px 6px", borderRadius: "100px",
                  background: "rgba(0,214,143,0.15)", color: "var(--dl-signal)",
                }}>-20%</span>
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="dl-section">
          <div className="dl-container">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
              {TIERS.map(tier => <TierCard key={tier.id} tier={tier} annual={annual} />)}
            </div>

            {/* Footer */}
            <div style={{ marginTop: "4rem", paddingTop: "2.5rem", borderTop: "1px solid var(--dl-line-0)", textAlign: "center" }}>
              <p className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-3)", letterSpacing: "0.06em" }}>
                // All plans include GitHub OAuth · No credit card for free tier · Cancel anytime
              </p>
              <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "1rem 2.5rem" }}>
                {["SOC 2 Type II", "GDPR Compliant", "Zero Log Policy", "AES-256 Encryption"].map(badge => (
                  <div key={badge} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--dl-text-3)", flexShrink: 0 }} />
                    <span className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-2)" }}>{badge}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
