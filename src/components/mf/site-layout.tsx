import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

/* ── Reveal on scroll ─────────────────────────────────────────────── */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: {
  children: ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Comp = Tag as "div";
  return (
    <Comp ref={ref} className={`mf-reveal ${seen ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Comp>
  );
}

export function Pill({ children, live = false, dot = true }: { children: ReactNode; live?: boolean; dot?: boolean }) {
  return (
    <span className="mf-pill">
      {dot && <span className={`mf-dot ${live ? "live" : ""}`} />}
      {children}
    </span>
  );
}

export const NAV = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/pricing", label: "Pricing" },
] as const;

/* ── Navbar ───────────────────────────────────────────────────────── */
export function SiteNav() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAuthenticated, loginWithGitHub, logout } = useAuth();

  useEffect(() => {
    const on = () => setStuck(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [path]);

  return (
    <>
      <header className="mf-nav" data-stuck={stuck}>
        <div className="mf-wrap mf-nav-in">
          <Link to="/" className="mf-logo" aria-label="DevLens home">
            <span className="mf-logo-mark" /> DevLens<span className="mf-muted" style={{ fontWeight: 400 }}>.ai</span>
          </Link>
          <nav className="mf-links" aria-label="Primary">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="mf-link" data-active={path === n.to}>{n.label}</Link>
            ))}
          </nav>
          <div className="mf-nav-r">
            <a
              href="https://github.com/KaranParmar19/devlens-AI"
              target="_blank"
              rel="noreferrer"
              className="mf-btn ghost sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              title="DevLens GitHub Repository"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span>GitHub</span>
            </a>

            {isAuthenticated && user ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Link
                  to="/dashboard"
                  className="mf-btn sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                  title="Go to DevLens Workspace"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      style={{ width: 18, height: 18, borderRadius: "50%" }}
                    />
                  ) : null}
                  <span>@{user.username}</span>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="mf-btn ghost sm"
                  style={{ padding: "0 10px", fontSize: "0.75rem" }}
                  title="Sign out"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={loginWithGitHub}
                  className="mf-btn ghost sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  title="Connect your GitHub account"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                  <span>Connect</span>
                </button>
                <Link to="/dashboard" className="mf-btn sm">
                  <span>Dashboard</span> <span className="mf-arrow">↗</span>
                </Link>
              </div>
            )}
            <button className="mf-burger" onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{open ? "✕" : "≡"}</span>
            </button>
          </div>
        </div>
      </header>
      {open && (
        <div className="mf-sheet">
          {NAV.map((n) => <Link key={n.to} to={n.to}>{n.label}</Link>)}
          <Link to="/dashboard">Dashboard ↗</Link>
        </div>
      )}
    </>
  );
}

/* ── Footer ───────────────────────────────────────────────────────── */
export function SiteFooter() {
  return (
    <footer className="mf-dark" style={{ paddingTop: "clamp(64px,8vw,112px)", overflow: "hidden" }}>
      <div className="mf-wrap">
        <div className="mf-foot-cols">
          <div>
            <h3 className="mf-h2" style={{ maxWidth: "11em" }}>Read any codebase like you wrote it.</h3>
            <div style={{ marginTop: 28 }}>
              <Link to="/dashboard" className="mf-btn inv">Start mapping <span className="mf-arrow">↗</span></Link>
            </div>
          </div>
          <div>
            <div className="mf-mono mf-muted" style={{ marginBottom: 12 }}>Product</div>
            <Link to="/features">Features</Link>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/dashboard">Dashboard</Link>
          </div>
          <div>
            <div className="mf-mono mf-muted" style={{ marginBottom: 12 }}>Views</div>
            <Link to="/dashboard">Architecture map</Link>
            <Link to="/dashboard">Code flow</Link>
            <Link to="/dashboard">Onboarding doc</Link>
            <Link to="/dashboard">Ask DevLens</Link>
          </div>
          <div>
            <div className="mf-mono mf-muted" style={{ marginBottom: 12 }}>Elsewhere</div>
            <a href="https://github.com/KaranParmar19/devlens-AI" target="_blank" rel="noreferrer">GitHub ↗</a>
          </div>
        </div>
        <hr className="mf-rule" />
        <div style={{ display: "flex", justifyContent: "space-between", padding: "20px 0 8px", flexWrap: "wrap", gap: 12 }}>
          <span className="mf-mono mf-muted">© {new Date().getFullYear()} DevLens AI</span>
          <span className="mf-mono mf-muted">Built for engineers who inherit code</span>
        </div>
      </div>
      <div className="mf-foot-word" aria-hidden style={{ paddingInline: "var(--mf-pad)", marginBottom: "-0.06em" }}>devlens</div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mf-root">
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

/* ── Page header used by sub pages ────────────────────────────────── */
export function PageHero({ eyebrow, title, lead }: { eyebrow: string; title: ReactNode; lead: string }) {
  return (
    <section className="mf-hero" style={{ paddingBottom: 72 }}>
      <div className="mf-hero-grid-bg" />
      <div className="mf-wrap">
        <div className="mf-hero-top"><Pill live>{eyebrow}</Pill></div>
        <h1 className="mf-h1" style={{ maxWidth: "12em" }}>{title}</h1>
        <p className="mf-lead" style={{ marginTop: 28 }}>{lead}</p>
      </div>
    </section>
  );
}
