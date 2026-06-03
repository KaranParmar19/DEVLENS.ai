import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [{ title: "Pricing — DevLens AI" }],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" },
    ],
  }),
});

type Feature = { text: string; included: boolean; detail?: string };
interface Tier {
  id: string; label: string; name: string;
  monthly: number; annual: number; featured: boolean;
  badge?: string; cta: string; ctaHref: string;
  features: Feature[];
}

const TIERS: Tier[] = [
  {
    id: "free", label: "COMMUNITY_TIER", name: "Free",
    monthly: 0, annual: 0, featured: false, cta: "Initiate Free", ctaHref: "/",
    features: [
      { text: "Public repositories only", included: true, detail: "Up to 500MB each" },
      { text: "5 architectural analyses / day", included: true },
      { text: "50 semantic Q&A queries / day", included: true },
      { text: "Base architecture mapping", included: true },
      { text: "Private repo indexing", included: false },
      { text: "Code flow tracing", included: false },
      { text: "PDF / Notion Export", included: false },
      { text: "Enterprise SSO (SAML)", included: false },
    ],
  },
  {
    id: "pro", label: "PROFESSIONAL_TIER", name: "Pro",
    monthly: 29, annual: 24, featured: true, badge: "OPTIMUM", cta: "Upgrade to Pro", ctaHref: "/",
    features: [
      { text: "Public & Private repositories", included: true, detail: "Unlimited size" },
      { text: "Unlimited architectural analyses", included: true },
      { text: "Unlimited semantic Q&A", included: true },
      { text: "Advanced architecture mapping", included: true },
      { text: "Code flow tracing & debugging", included: true },
      { text: "PDF, Markdown, Notion Export", included: true },
      { text: "Priority ingestion queues", included: true },
      { text: "Enterprise SSO (SAML)", included: false },
    ],
  },
  {
    id: "team", label: "ENTERPRISE_TIER", name: "Team",
    monthly: 99, annual: 79, featured: false, cta: "Contact Protocol", ctaHref: "/",
    features: [
      { text: "Everything in Professional", included: true },
      { text: "Shared workspace & RBAC", included: true },
      { text: "Enterprise SSO (SAML) & Audit", included: true },
      { text: "Custom data retention policies", included: true },
      { text: "Dedicated indexing clusters", included: true },
      { text: "White-glove onboarding", included: true },
      { text: "SLA uptime guarantees", included: true },
      { text: "Volume licensing discounts", included: true },
    ],
  },
];

function FeatureRow({ text, included, detail }: Feature) {
  return (
    <div className="dl-feature-row">
      <div className={`dl-feature-indicator ${included ? 'active' : ''}`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="dl-mono" style={{
            fontSize: "0.75rem", lineHeight: 1.5,
            color: included ? "var(--dl-text-0)" : "var(--dl-text-3)",
            transition: "color 0.2s ease"
          }}>
            {text}
          </span>
          {detail && (
            <span className="dl-mono" style={{ fontSize: "0.625rem", color: "var(--dl-text-2)" }}>
              {detail}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TierCard({ tier, annual }: { tier: Tier; annual: boolean }) {
  const price = annual ? tier.annual : tier.monthly;
  return (
    <div className={`dl-tier-card ${tier.featured ? "featured" : ""}`} style={{
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column'
    }}>
      {tier.featured && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, var(--dl-signal), transparent)',
          opacity: 0.8
        }} />
      )}
      
      {tier.badge && (
        <div className="dl-animate-fade-in" style={{
          position: "absolute", top: 16, right: 24,
          fontFamily: "var(--font-mono)", fontSize: "0.6rem", letterSpacing: "0.16em",
          padding: "4px 12px", borderRadius: "100px",
          background: "var(--dl-signal-lo)", color: "var(--dl-signal)",
          border: "1px solid var(--dl-signal-md)",
          fontWeight: 700, whiteSpace: "nowrap",
        }}>
          {tier.badge}
        </div>
      )}

      {/* Label */}
      <div className="dl-mono dl-animate-fade-up" style={{
        fontSize: "0.6875rem", letterSpacing: "0.14em", textTransform: "uppercase",
        color: tier.featured ? "var(--dl-signal)" : "var(--dl-text-2)", marginBottom: 24,
      }}>
        {tier.label}
      </div>

      {/* Price */}
      <div className="dl-animate-fade-up dl-delay-100" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: "3.5rem", fontWeight: 600, color: "var(--dl-text-0)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em", lineHeight: 1 }}>
            ${price}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
             <span className="dl-mono" style={{ fontSize: "0.75rem", color: "var(--dl-text-2)" }}>
               {price === 0 ? "forever" : tier.id === "team" ? "/mo per seat" : "/mo"}
             </span>
             {annual && price > 0 && (
               <span className="dl-mono" style={{ fontSize: "0.6rem", color: "var(--dl-signal)", letterSpacing: "0.08em" }}>
                 Billed Annually
               </span>
             )}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="dl-animate-fade-up dl-delay-200" style={{ marginBottom: 32 }}>
        <Link
          to={tier.ctaHref as "/"}
          className={`dl-btn ${tier.featured ? 'dl-btn-signal' : 'dl-btn-primary'}`}
          style={{ width: "100%", padding: "14px", fontSize: "0.75rem" }}
        >
          {tier.cta}
        </Link>
      </div>

      <div className="dl-animate-fade-up dl-delay-300" style={{ flex: 1 }}>
        <div className="dl-mono" style={{ fontSize: "0.6rem", color: "var(--dl-text-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
          Features Included
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {tier.features.map(f => <FeatureRow key={f.text} {...f} />)}
        </div>
      </div>
    </div>
  );
}

function PricingPage() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="dl-page" style={{ fontFamily: "var(--font-sans)", paddingLeft: 240, minHeight: '100vh', background: 'var(--dl-base)' }}>
      {/* Background Ambience */}
      <div className="dl-noise" />
      <div style={{
        position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)",
        width: "100vw", height: "80vh", pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse at top, var(--dl-signal-lo) 0%, transparent 60%)",
      }} />

      {/* Nav */}
      <nav className="dl-nav" style={{ zIndex: 50 }}>
        <div className="dl-nav-inner">
          <Link to="/" className="dl-nav-logo">
            <span className="dl-nav-logo-dot" />
            DEVLENS
            <span style={{ color: "var(--dl-text-0)", fontWeight: 400, fontSize: "0.6rem", letterSpacing: "0.2em" }}>AI</span>
          </Link>
          <div className="dl-nav-links">
            <Link to="/" className="dl-nav-link">Home</Link>
            <Link to="/pricing" className="dl-nav-link" data-active="">Pricing</Link>
            <Link to="/dashboard" className="dl-nav-link">Dashboard</Link>
          </div>
        </div>
      </nav>

      <main style={{ position: 'relative', zIndex: 10 }}>
        {/* Hero */}
        <div className="dl-section" style={{ textAlign: "center", paddingBottom: "4rem" }}>
          <div className="dl-container" style={{ maxWidth: 800 }}>
            <div className="dl-section-label dl-animate-fade-up" style={{ justifyContent: "center" }}>LICENSING_MODELS</div>
            <h1 className="dl-display dl-animate-fade-up dl-delay-100" style={{ marginBottom: "1.5rem" }}>
              Scale your intelligence.
            </h1>
            <p className="dl-body dl-animate-fade-up dl-delay-200" style={{ maxWidth: '60ch', margin: '0 auto', fontSize: '1.125rem' }}>
              From open-source contributors to enterprise engineering teams. Secure, private, and exceptionally powerful architecture mapping.
            </p>

            {/* Toggle */}
            <div className="dl-animate-fade-up dl-delay-300" style={{
              marginTop: "3rem", display: "inline-flex", alignItems: "center", gap: 4,
              padding: 6, borderRadius: "100px",
              border: "1px solid var(--dl-line-2)", background: "rgba(13, 13, 16, 0.6)",
              backdropFilter: 'blur(12px)',
            }}>
              <button
                type="button"
                onClick={() => setAnnual(false)}
                style={{
                  background: !annual ? "var(--dl-text-0)" : "transparent",
                  color: !annual ? "var(--dl-base)" : "var(--dl-text-2)",
                  border: "none", padding: "8px 24px", borderRadius: "100px",
                  fontFamily: "var(--font-mono)", fontSize: "0.6875rem", fontWeight: 600,
                  letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              >Monthly</button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                style={{
                  background: annual ? "var(--dl-text-0)" : "transparent",
                  color: annual ? "var(--dl-base)" : "var(--dl-text-2)",
                  border: "none", padding: "8px 24px", borderRadius: "100px",
                  fontFamily: "var(--font-mono)", fontSize: "0.6875rem", fontWeight: 600,
                  letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
                  transition: "all 0.3s ease", display: "flex", alignItems: "center", gap: 8,
                }}
              >
                Annually
                <span style={{
                  fontSize: "0.55rem", padding: "2px 6px", borderRadius: "100px",
                  background: annual ? "rgba(0, 214, 143, 0.2)" : "var(--dl-signal-lo)", 
                  color: annual ? "var(--dl-base)" : "var(--dl-signal)",
                  fontWeight: 700,
                }}>-20%</span>
              </button>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="dl-section" style={{ paddingTop: 0 }}>
          <div className="dl-container">
            <div className="dl-animate-fade-up dl-delay-300" style={{ 
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", 
              gap: 24, alignItems: 'stretch' 
            }}>
              {TIERS.map(tier => <TierCard key={tier.id} tier={tier} annual={annual} />)}
            </div>

            {/* Footer Trust Badges */}
            <div className="dl-animate-fade-up dl-delay-500" style={{ 
              marginTop: "5rem", paddingTop: "3rem", borderTop: "1px solid var(--dl-line-1)", 
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem'
            }}>
              <p className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-3)", letterSpacing: "0.06em" }}>
                // Infrastructure secured by AWS & Cloudflare. AES-256 at rest, TLS 1.3 in transit.
              </p>
              <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "2rem 3rem" }}>
                {[
                  { label: "SOC 2 Type II", icon: "🛡" },
                  { label: "GDPR Compliant", icon: "⚖" },
                  { label: "Zero Log Policy", icon: "👁‍🗨" },
                  { label: "End-to-End Encrypted", icon: "🔒" }
                ].map(badge => (
                  <div key={badge.label} style={{ display: "flex", alignItems: "center", gap: 8, background: 'var(--dl-raised)', padding: '8px 16px', borderRadius: '100px', border: '1px solid var(--dl-line-1)' }}>
                    <span style={{ color: 'var(--dl-signal)', fontSize: '0.9rem' }}>{badge.icon}</span>
                    <span className="dl-mono" style={{ fontSize: "0.6875rem", color: "var(--dl-text-1)", fontWeight: 500 }}>{badge.label}</span>
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

