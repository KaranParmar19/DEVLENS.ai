import React, { useEffect, useRef, useState } from "react";

export interface StatMetric {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  description?: string;
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
    label: "Languages supported",
    description: "Resolves imports and symbols across TypeScript, JavaScript, Python, Go, Java, Rust, Ruby, and PHP.",
  },
  {
    value: 5,
    prefix: "",
    suffix: "",
    decimals: 0,
    label: "Interactive views",
    description: "Switch between the dependency map, request tracer, commit history, Q&A, and onboarding notes.",
  },
  {
    value: 100,
    prefix: "",
    suffix: "%",
    decimals: 0,
    label: "Answers linked to code",
    description: "Every Q&A response cites the exact file path and line range it used.",
  },
  {
    value: 0,
    prefix: "",
    suffix: " MB",
    decimals: 0,
    label: "Code kept on disk",
    description: "Repositories are cloned into a temporary directory for parsing and deleted when your session ends.",
  },
];

export function StatsSection({
  stats = DEFAULT_DEVLENS_STATS,
  duration = 2,
  separator = true,
  triggerOnView = true,
  divider = true,
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
      className={`mf-stats-section ${cardStyle ? "card-framed" : ""} ${className}`}
    >
      <div className="mf-stats-grid">
        {stats.map((stat, i) => (
          <div key={i} className="mf-stat-col">
            {divider && i > 0 && <div className="mf-stat-divider" aria-hidden="true" />}
            <div className="mf-stat-item">
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
              <h4 className="mf-stat-label">{stat.label}</h4>
              {stat.description && (
                <p className="mf-stat-desc">{stat.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StatsSection;
