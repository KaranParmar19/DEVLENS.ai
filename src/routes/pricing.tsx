import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [{ title: "Pricing — DevLens AI" }],
  }),
});

// ── Tier data ─────────────────────────────────────────────────────────────────
type Feature = { text: string; included: boolean };

interface Tier {
  id: string;
  label: string;
  name: string;
  monthly: number;
  annual: number;
  featured: boolean;
  badge?: string;
  cta: string;
  ctaVariant: "outline" | "accent" | "muted";
  features: Feature[];
}

const TIERS: Tier[] = [
  {
    id: "free",
    label: "FREE_TIER",
    name: "Free",
    monthly: 0,
    annual: 0,
    featured: false,
    cta: "Start Free",
    ctaVariant: "muted",
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
    id: "pro",
    label: "PRO_TIER",
    name: "Pro",
    monthly: 19,
    annual: 15,
    featured: true,
    badge: "MOST POPULAR",
    cta: "Get Pro",
    ctaVariant: "accent",
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
    id: "team",
    label: "TEAM_TIER",
    name: "Team",
    monthly: 49,
    annual: 39,
    featured: false,
    cta: "Contact Sales",
    ctaVariant: "outline",
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

// ── Components ────────────────────────────────────────────────────────────────
function FeatureRow({ text, included }: Feature) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-zinc-900/60 last:border-b-0">
      <span
        className="font-mono text-[13px] shrink-0 mt-0.5"
        style={{ color: included ? "#00E5A0" : "#333" }}
      >
        {included ? "✓" : "○"}
      </span>
      <span
        className="font-mono text-[13px] leading-relaxed"
        style={{ color: included ? "#888" : "#333" }}
      >
        {text}
      </span>
    </div>
  );
}

function TierCard({ tier, annual }: { tier: Tier; annual: boolean }) {
  const price = annual ? tier.annual : tier.monthly;
  return (
    <div
      className="flex flex-col rounded-lg p-6 transition-all duration-300 relative"
      style={{
        background: "#111",
        border: `1px solid ${tier.featured ? "#00E5A0" : "#2A2A2A"}`,
        boxShadow: tier.featured ? "0 0 30px rgba(0,229,160,0.08), 0 0 60px rgba(0,229,160,0.04)" : "none",
      }}
    >
      {tier.badge && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-widest px-3 py-1 rounded-sm"
          style={{ background: "#00E5A0", color: "#09090b" }}
        >
          {tier.badge}
        </div>
      )}

      {/* Label */}
      <div className="font-mono text-[11px] uppercase tracking-widest mb-4"
        style={{ color: tier.featured ? "#00E5A0" : "#444" }}>
        {tier.label}
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold text-white tabular-nums">
            ${price}
          </span>
          <span className="font-mono text-[13px] text-zinc-600">
            {price === 0 ? "forever" : tier.id === "team" ? "/mo per seat" : "/mo"}
          </span>
        </div>
        {annual && price > 0 && (
          <div className="mt-1 font-mono text-[11px]" style={{ color: "#00E5A0" }}>
            ✦ 2 months free vs monthly
          </div>
        )}
      </div>

      {/* CTA */}
      <Link
        to="/"
        className={`w-full py-2.5 rounded font-mono text-[12px] uppercase tracking-widest text-center transition-all mb-6 block ${
          tier.ctaVariant === "accent"
            ? "bg-[#00E5A0] text-[#09090b] hover:bg-[#1cf1b1] shadow-[0_0_20px_rgba(0,229,160,0.25)]"
            : tier.ctaVariant === "outline"
            ? "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
            : "border border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
        }`}
      >
        {tier.cta}
      </Link>

      {/* Divider */}
      <div className="h-px bg-zinc-900 mb-4" />

      {/* Features */}
      <div className="flex-1">
        {tier.features.map((f) => (
          <FeatureRow key={f.text} {...f} />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-mono text-[13px] font-semibold text-white tracking-tight">
          DEVLENS_V2
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/pricing" className="font-mono text-[11px] uppercase tracking-widest text-[#00E5A0]">
            Pricing
          </Link>
          <Link to="/" className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
            ← Back
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-24 lg:px-12">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="font-mono text-[11px] uppercase tracking-widest text-zinc-600 mb-6">
            PRICING_TIERS
          </div>
          <h1 className="text-5xl font-semibold leading-none tracking-tight text-white md:text-6xl">
            Simple, honest pricing.
          </h1>
          <p className="mt-6 text-base text-zinc-500 max-w-xl mx-auto">
            Start free. Upgrade when you need private repos, unlimited queries, or team features.
          </p>

          {/* Annual toggle */}
          <div className="mt-10 inline-flex items-center gap-3 p-1 rounded-lg border border-zinc-800 bg-zinc-900/50">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded font-mono text-[11px] uppercase tracking-widest transition-all ${
                !annual ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded font-mono text-[11px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                annual ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Annually
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#00E5A0]/20 text-[#00E5A0]">
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Tier grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((tier) => (
            <TierCard key={tier.id} tier={tier} annual={annual} />
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-16 text-center border-t border-zinc-900 pt-12">
          <p className="font-mono text-[12px] text-zinc-700">
            // All plans include GitHub OAuth · No credit card for free tier · Cancel anytime
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-8">
            {["SOC 2 Type II", "GDPR Compliant", "Zero Log Policy", "AES-256 Encryption"].map((badge) => (
              <div key={badge} className="flex items-center gap-2 font-mono text-[11px] text-zinc-600">
                <span className="size-1.5 rounded-full bg-zinc-700" />
                {badge}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
