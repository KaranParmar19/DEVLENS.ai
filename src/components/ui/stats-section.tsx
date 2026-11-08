import React, { useEffect, useRef, useState } from "react";

export interface StatMetaSnippet {
  type: "chips" | "lenses" | "citation" | "security";
  items?: string[];
  text?: string;
  subtext?: string;
}

export interface StatMetric {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  description?: string;
  index?: string;
  pill?: string;
  metaSnippet?: StatMetaSnippet;
}

export interface StatsSectionProps {
  stats?: StatMetric[];
  duration?: number;
  separator?: boolean;
  triggerOnView?: boolean;
  divider?: boolean;
  className?: string;
  cardStyle?: boolean;
  columns?: number;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function AnimatedNumber({
  end,
  duration = 2,
  prefix = "",
  suffix = "",
  decimals = 0,
  separator = true,
  shouldStart = false,
}: {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  separator?: boolean;
  shouldStart?: boolean;
}) {
  const [display, setDisplay] = useState("0");
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldStart) return;
    if (raf.current) cancelAnimationFrame(raf.current);

    const startTime = performance.now();
    const durationMs = duration * 1000;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = easeOutExpo(progress);
      const current = eased * end;

      const formatted = separator
        ? current.toLocaleString("en-US", {
            minimumIntegerDigits: end < 10 && end > 0 && decimals === 0 ? 2 : 1,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : current.toFixed(decimals);

      setDisplay(formatted);

      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      }
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [shouldStart, end, duration, decimals, separator]);

  return (
    <span className="mf-stat-number" style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix && <span className="mf-stat-prefix">{prefix}</span>}
      <span className="mf-stat-digits">{display}</span>
      {suffix && <span className="mf-stat-suffix">{suffix}</span>}
    </span>
  );
}

export const DEFAULT_DEVLENS_STATS: StatMetric[] = [
  {
    value: 8,
    prefix: "",
    suffix: "",
    decimals: 0,
    index: "01",
    pill: "PARSERS",
    label: "Languages supported",
    description: "Resolves imports and symbols across backends and frontends down to function definitions.",
    metaSnippet: {
      type: "chips",
      items: ["TS", "JS", "PY", "GO", "RS", "JAVA", "RUBY", "PHP"],
      subtext: "Native Tree-sitter grammars",
    },
  },
  {
    value: 5,
    prefix: "",
    suffix: "",
    decimals: 0,
    index: "02",
    pill: "LENSES",
    label: "Interactive views",
    description: "Switch seamlessly between graph, request trace, commit drift, Q&A, and onboarding dossier.",
    metaSnippet: {
      type: "lenses",
      items: ["Map", "Flow", "Drift", "Copilot", "Dossier"],
      subtext: "One shared syntax graph",
    },
  },
  {
    value: 100,
    prefix: "",
    suffix: "%",
    decimals: 0,
    index: "03",
    pill: "VERIFIED",
    label: "Answers linked to code",
    description: "Every architectural insight and Copilot response cites the exact repository file and line range.",
    metaSnippet: {
      type: "citation",
      text: "src/auth.ts:42-88",
      subtext: "Deterministic AST grounding",
    },
  },
  {
    value: 0,
    prefix: "",
    suffix: " MB",
    decimals: 0,
    index: "04",
    pill: "SECURITY",
    label: "Code kept on disk",
    description: "Repositories clone into a temporary in-memory container and are completely wiped after indexing.",
    metaSnippet: {
      type: "security",
      text: "Ephemeral RAM sandbox",
      subtext: "Auto-purged on disconnect",
    },
  },
];

export function StatsSection({
  stats = DEFAULT_DEVLENS_STATS,
  duration = 2,
  separator = true,
  triggerOnView = true,
  divider = false,
  className = "",
  cardStyle = true,
  columns,
}: StatsSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!triggerOnView) {
      setStarted(true);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [triggerOnView]);

  return (
    <div
      ref={containerRef}
      data-cols={columns ?? stats.length}
      className={`mf-stats-deck ${className}`}
    >
      {/* Telemetry Header Bar */}
      <div className="mf-stats-deck-bar">
        <div className="mf-stats-deck-left">
          <span className="mf-stats-deck-dot" />
          <span className="mf-stats-deck-title mf-mono">ENGINE ARCHITECTURE</span>
          <span className="mf-stats-deck-sep">/</span>
          <span className="mf-stats-deck-sub mf-mono">SPECIFICATIONS &amp; BENCHMARKS</span>
        </div>
        <div className="mf-stats-deck-right mf-mono">
          <span className="mf-stats-deck-tag">TREE-SITTER AST</span>
          <span className="mf-stats-deck-tag">EPHEMERAL RUNTIME</span>
        </div>
      </div>

      {/* Bento Spec Cards */}
      <div className="mf-stats-grid">
        {stats.map((stat, i) => (
          <div key={i} className="mf-stat-card">
            {/* Top Row: Index and Category Pill */}
            <div className="mf-stat-card-top">
              <div className="mf-stat-card-badge">
                <span className="mf-stat-card-dot" />
                <span className="mf-stat-card-index mf-mono">
                  {stat.index ?? `0${i + 1}`}
                </span>
              </div>
              {stat.pill && (
                <span className="mf-stat-card-pill mf-mono">{stat.pill}</span>
              )}
            </div>

            {/* Giant Number Row */}
            <div className="mf-stat-val-wrap">
              <AnimatedNumber
                end={stat.value}
                duration={duration}
                prefix={stat.prefix}
                suffix={stat.suffix}
                decimals={stat.decimals ?? 0}
                separator={separator}
                shouldStart={started}
              />
            </div>

            {/* Title & Description */}
            <div className="mf-stat-card-body">
              <h4 className="mf-stat-label">{stat.label}</h4>
              {stat.description && (
                <p className="mf-stat-desc">{stat.description}</p>
              )}
            </div>

            {/* Interactive / Visual Micro-Component Footer */}
            {stat.metaSnippet && (
              <div className="mf-stat-card-foot">
                {stat.metaSnippet.type === "chips" && stat.metaSnippet.items && (
                  <div className="mf-stat-chips-rack">
                    {stat.metaSnippet.items.map((chip) => (
                      <span key={chip} className="mf-stat-chip mf-mono">
                        {chip}
                      </span>
                    ))}
                  </div>
                )}

                {stat.metaSnippet.type === "lenses" && stat.metaSnippet.items && (
                  <div className="mf-stat-lenses-rack">
                    {stat.metaSnippet.items.map((lens) => (
                      <span key={lens} className="mf-stat-lens-tag mf-mono">
                        {lens}
                      </span>
                    ))}
                  </div>
                )}

                {stat.metaSnippet.type === "citation" && (
                  <div className="mf-stat-cite-box">
                    <span className="mf-stat-cite-pill mf-mono">
                      <span className="mf-stat-cite-bullet" />
                      {stat.metaSnippet.text}
                    </span>
                    {stat.metaSnippet.subtext && (
                      <span className="mf-stat-micro-note mf-mono">
                        {stat.metaSnippet.subtext}
                      </span>
                    )}
                  </div>
                )}

                {stat.metaSnippet.type === "security" && (
                  <div className="mf-stat-sec-box">
                    <span className="mf-stat-sec-pill mf-mono">
                      <span className="mf-stat-lock-icon">🔒</span>
                      {stat.metaSnippet.text}
                    </span>
                    {stat.metaSnippet.subtext && (
                      <span className="mf-stat-micro-note mf-mono">
                        {stat.metaSnippet.subtext}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default StatsSection;
